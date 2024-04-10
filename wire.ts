import * as ts from "typescript"
import { topologicalSort } from "./topsort"
import { program } from "commander"
import path from "path"

program
  .arguments("<rootFile>")
  .option("-f, --foo", "use foo", false)
  .parse(process.argv)

const args = program.args
const opts = program.opts()

const rootFile = args[0]
const rootFiles = [rootFile]
const tsprogram = ts.createProgram(rootFiles, { allowJs: true })
const checker = tsprogram.getTypeChecker()

function kindOf(node: ts.Node): string {
  return ts.SyntaxKind[node.kind]
}

// isInjectionFunctionDeclaration checks that a function declaration has `wire` call.
function isInjectionFunctionDeclaration(
  node: ts.Node
): node is ts.FunctionDeclaration {
  if (!ts.isFunctionDeclaration(node)) {
    return false
  }

  if (!node.body || node.body.statements.length === 0) {
    return false
  }

  if (!node.name) {
    return false
  }

  const functionName = node.name.text

  const firstStatement = node.body.statements[0]

  if (
    ts.isExpressionStatement(firstStatement) &&
    ts.isCallExpression(firstStatement.expression) &&
    firstStatement.expression.expression.getText() === "tswire"
  ) {
    processWireCallArguments(firstStatement.expression)
    return true
  } else {
    return false
  }
}

// `providerMap` is a mapping from provider function names to their respective information.
// The key is a string representing the name of the provider function.
// The value is an object of type `ProviderInfo`, which contains:
//   - `functionName`: The name of the provider function as a string.
//   - `returnType`: The TypeScript type object representing the return type of the provider function.
//   - `paramTypes`: An array of TypeScript type objects representing the types of parameters the provider function expects.
// This map is used to quickly access the metadata about each provider function by its name,
// including what it returns and what inputs it requires.
const providerMap: Map<ts.Type, ts.FunctionDeclaration> = new Map()

// `dependencyGraph` is a mapping that represents the dependencies between types in the DI system.
// The key is a string representing the name of a type (the return type of a provider).
// The value is a Set of strings, where each string represents the name of a type that the key type depends on (parameter types of the provider).
// For example, if a provider function returns a type `A` and requires types `B` and `C` as inputs,
// the graph will have an entry with `A` as the key, and a set containing `B` and `C`.
// This graph is used to determine the order in which provider functions should be called to satisfy dependencies,
// ensuring that all inputs for a given provider are available before it is invoked.
const dependencyGraph: Map<ts.Type, Set<ts.Type>> = new Map()

// Extract provider information
function extractProviderInfo(fndef: ts.FunctionDeclaration): void {
  if (!fndef.name) return

  const signature = checker.getSignatureFromDeclaration(fndef)
  if (!signature) return

  const returnType = signature.getReturnType()

  const paramTypes = signature.getParameters().map((param) => {
    const type = checker.getTypeAtLocation(param.valueDeclaration!)
    return type
  })

  providerMap.set(returnType, fndef)

  let dependencies = dependencyGraph.get(returnType)
  if (!dependencies) {
    dependencies = new Set()
    dependencyGraph.set(returnType, dependencies)
  }

  for (const paramType of paramTypes) {
    dependencies.add(paramType)
  }
}

const injectionFunctionDeclarations: ts.FunctionDeclaration[] = []

function visit(node: ts.Node) {
  if (isInjectionFunctionDeclaration(node)) {
    injectionFunctionDeclarations.push(node)
  }
}

function isArrayLiteral(node: ts.Node): node is ts.ArrayLiteralExpression {
  return node.kind === ts.SyntaxKind.ArrayLiteralExpression
}

function isVariableDeclaration(node: ts.Node): node is ts.VariableDeclaration {
  return node.kind === ts.SyntaxKind.VariableDeclaration
}

function isFunctionDeclaration(node: ts.Node): node is ts.FunctionDeclaration {
  return node.kind === ts.SyntaxKind.FunctionDeclaration
}

function relativeImportPath(
  outputModuleFile: string,
  declarationFileName: string
): string {
  // const declarationFileName = declaration.getSourceFile().fileName;
  // Calculate the relative path from the declaration file to the outputModuleFile
  let importPath = path
    .relative(path.dirname(outputModuleFile), declarationFileName)
    // Remove the file extension
    .replace(/\.\w+$/, "")
    // Ensure import path format (replace \ with / for non-UNIX systems)
    .replace(/\\/g, "/")
  // If the path does not start with '.', add './' to make it a relative path
  if (!importPath.startsWith(".")) {
    importPath = "./" + importPath
  }

  return importPath
}

var providerDeclarations: ts.FunctionDeclaration[] = []

// processWireCallArguments collects the available providers on the `wire`
// function call arguments.
function processWireCallArguments(node: ts.CallExpression): void {
  // Assuming the wire function call is always the first statement of the function
  // and its arguments are directly referencing provider functions.
  //
  // It should have the form:
  //
  // wire(providers);

  if (node.arguments.length != 1) {
    throw new Error("wire function should have exactly one argument")
  }

  const arg = node.arguments[0]

  if (!ts.isIdentifier(arg)) {
    throw new Error("wire function argument should be a variable name")
  }

  let s = checker.getSymbolAtLocation(arg)
  let d = s?.valueDeclaration
  if (!s || !d) {
    throw new Error("unknown symbol found for wire function argument")
  }

  // Check that wire argument is of the form:
  // const providers = [ provideFoo, provideBar, provideBaz ];
  if (
    isVariableDeclaration(d) &&
    d.initializer &&
    isArrayLiteral(d.initializer)
  ) {
    for (let e of d.initializer.elements) {
      if (!ts.isIdentifier(e)) {
        throw new Error("provider should be a function declaration")
      }

      const declaration = checker.getSymbolAtLocation(e)?.valueDeclaration

      if (declaration && isFunctionDeclaration(declaration)) {
        const isExported = declaration.modifiers?.some(
          (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
        )

        if (!isExported) {
          throw new Error("provider function must be exported")
        }

        providerDeclarations.push(declaration)
      }
    }
  }
}

// `generateInitFunction` constructs the TypeScript code for an initialization function
// that uses the sorted providers to satisfy dependencies for a target type.
// The function constructs the required import statements dynamically to avoid naming conflicts
// and ensure that only necessary provider functions are imported and used.
// `providers`: An array of FunctionDeclaration objects representing the sorted providers.
// `targetType`: The Type object representing the type we aim to construct.
// Returns a string containing the TypeScript code for the initialization function and necessary imports.
function generateInitFunction(
  providers: ts.FunctionDeclaration[],
  targetType: ts.Type
): string {
  // This maps the return type of each provider to its generated variable name.
  const typeToVariableNameMap: Map<string, string> = new Map()
  const importStatements: string[] = []
  const providerCalls: string[] = []
  const usedNames: Set<string> = new Set() // Tracks used names to avoid collisions.

  providers.forEach((provider) => {
    const sig = checker.getSignatureFromDeclaration(provider)!

    const returnType = provider.type!.getText() // Assuming provider has a return type annotation.
    const baseName = sig.getReturnType().symbol.getName().toLowerCase()
    let uniqueName = baseName
    let counter = 1
    while (usedNames.has(uniqueName)) {
      uniqueName = `${baseName}${counter}`
      counter++
    }
    usedNames.add(uniqueName)

    // Generate variable name for the return type of the provider.
    typeToVariableNameMap.set(returnType, uniqueName)

    // Generate import statement for the provider.
    const importName = usedNames.has(provider.name!.text)
      ? `${provider.name!.text} as ${provider.name!.text}Provider`
      : provider.name!.text
    importStatements.push(`import { ${provider.name!.text} } from "./di";`)

    // Construct the call to the provider function, including passing the required parameters.
    const paramVariableNames = provider.parameters.map((param) => {
      const paramType = param.type!.getText()
      if (!typeToVariableNameMap.has(paramType)) {
        throw new Error(`No provider found for type ${paramType}`)
      }
      return typeToVariableNameMap.get(paramType)
    })

    providerCalls.push(
      `  const ${uniqueName} = ${provider.name!.text}(${paramVariableNames.join(
        ", "
      )});`
    )
  })

  const targetTypeSymbol = targetType.getSymbol()
  const targetTypeName = targetTypeSymbol ? targetTypeSymbol.getName() : ""
  const imports = importStatements.join("\n")
  const body = providerCalls.join("\n")
  const returnVariableName =
    typeToVariableNameMap.get(
      targetType.getSymbol()?.getEscapedName().toString() || ""
    ) || ""
  const returnStatement = `  return ${returnVariableName};`

  // FIXME: attempt to import the returnType, and annotate the returnType of the generated init

  // Construct and return the final output including imports, the function definition, and the return statement.
  // const output = `${imports}\n\nexport function init(): ${targetTypeName} {\n${body}\n${returnStatement}\n}`
  const output = `${imports}\n\nexport function init() {\n${body}\n${returnStatement}\n}`
  return output
}

// `generateOutputFilePathUsingPath` generates a new file path with `_wire` appended to the filename
// before the extension, using Node.js `path` module for handling file paths.
// This approach is more robust and handles edge cases well, such as files without extensions.
// `inputFilePath`: A string representing the path to the input file.
// Returns a string representing the path to the output file with `_wire` appended to the filename.
function wireOutputPath(inputFilePath: string): string {
  // Extract the directory, filename without extension, and extension from the input path.
  const dirname = path.dirname(inputFilePath)
  const extname = path.extname(inputFilePath)
  const basename = path.basename(inputFilePath, extname)

  // Append '_wire' to the basename, then reconstruct the path.
  const outputFileName = `${basename}_wire${extname}`
  const outputFilePath = path.join(dirname, outputFileName)

  return outputFilePath
}

// main
// for (const sourceFile of tsprogram.getSourceFiles()) {
// }
for (const rootFile of rootFiles) {
  const sourceFile = tsprogram.getSourceFile(rootFile)
  if (!sourceFile) {
    throw new Error("source file not found")
  }

  ts.forEachChild(sourceFile, visit)

  for (let provider of providerDeclarations) {
    extractProviderInfo(provider)
  }

  // use the first injection function as init
  const initDeclaration = injectionFunctionDeclarations[0]

  const returnType = checker
    .getSignatureFromDeclaration(initDeclaration)
    ?.getReturnType()!

  const deps = topologicalSort(returnType, dependencyGraph)

  const linearizedProviders = deps.map((dep) => providerMap.get(dep)!)

  // print the calling order of the providers
  // for (let dep of deps) {
  //   const provider = providerMap.get(dep)!
  //   console.log(provider.getText())
  // }

  const initCode = generateInitFunction(linearizedProviders, returnType)
  console.log(initCode)

  const outputFile = wireOutputPath(sourceFile.fileName)

  await Bun.write(outputFile, initCode)
}
