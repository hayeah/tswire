import * as ts from "typescript"
import { topologicalSort } from "./topsort"
import path from "path"

const nonInjectableReturnTypes =
  ts.TypeFlags.Void |
  ts.TypeFlags.Any |
  ts.TypeFlags.Undefined |
  ts.TypeFlags.Never

// Initialize a Set of JavaScript keywords at the module scope
const keywords = new Set([
  "abstract",
  "arguments",
  "await",
  "boolean",
  "break",
  "byte",
  "case",
  "catch",
  "char",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "double",
  "else",
  "enum",
  "eval",
  "export",
  "extends",
  "false",
  "final",
  "finally",
  "float",
  "for",
  "function",
  "goto",
  "if",
  "implements",
  "import",
  "in",
  "instanceof",
  "int",
  "interface",
  "let",
  "long",
  "native",
  "new",
  "null",
  "package",
  "private",
  "protected",
  "public",
  "return",
  "short",
  "static",
  "super",
  "switch",
  "synchronized",
  "this",
  "throw",
  "throws",
  "transient",
  "true",
  "try",
  "typeof",
  "var",
  "void",
  "volatile",
  "while",
  "with",
  "yield",
])

function escapeKeyword(name: string): string {
  // Check if the name is a keyword and prefix it with '$' if it is
  if (keywords.has(name)) {
    return `$${name}`
  }

  return name
}

function lowerFirstChar(str: string): string {
  if (str.length === 0) return str // Check if the string is empty
  return str.charAt(0).toLowerCase() + str.slice(1)
}

function variableNameForType(type: ts.Type): string {
  // if a keyword, prefix it with "$"
  return escapeKeyword(lowerFirstChar(typeName(type)))
}

function findSourceFile(node: ts.Node): ts.SourceFile {
  let current: ts.Node = node
  while (current && !ts.isSourceFile(current)) {
    current = current.parent
  }
  return current as ts.SourceFile
}

export function relativeImportPath(
  outputModuleFile: string,
  declarationFileName: string,
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

export interface ProviderInterface {
  node(): ts.Node

  exportName(): string

  inputTypes(): ts.Type[]
  outputType(): ts.Type
}

export class ClassProvider implements ProviderInterface {
  constructor(
    protected declaration: ts.ClassDeclaration,
    protected checker: WireTypeChecker,
  ) {}

  node(): ts.Node {
    return this.declaration
  }

  exportName(): string {
    return this.declaration.name!.text
  }

  inputTypes(): ts.Type[] {
    const constructor = this.findConstructor()
    if (!constructor) {
      // If no constructor is found, return an empty array indicating no inputs are needed.
      return []
    }

    // Map each parameter in the constructor to its type.
    return constructor.parameters.map((param) =>
      this.checker.getTypeAtLocationWithAliasSymbol(param.type!),
    )
  }

  outputType(): ts.Type {
    // The output type is the class type itself.
    return this.checker.getTypeAtLocation(this.declaration.name!)
  }

  private findConstructor(): ts.ConstructorDeclaration | null {
    let currentClass: ts.ClassDeclaration = this.declaration

    while (currentClass) {
      const constructor = currentClass.members.find(
        ts.isConstructorDeclaration,
      ) as ts.ConstructorDeclaration | undefined
      if (constructor) {
        return constructor
      }

      // Move up to the superclass (if any)
      const superclass = this.findSuperClass(currentClass)
      if (!superclass) {
        return null
      }
      currentClass = superclass
    }
    return null
  }

  private findSuperClass(
    classDeclaration: ts.ClassDeclaration,
  ): ts.ClassDeclaration | null {
    const heritageClause = classDeclaration.heritageClauses?.find(
      (h) => h.token === ts.SyntaxKind.ExtendsKeyword,
    )
    if (!heritageClause || heritageClause.types.length === 0) {
      return null
    }

    const type = this.checker.getTypeAtLocation(heritageClause.types[0])
    if (!type.symbol) {
      return null
    }

    const declarations = type.symbol.declarations
    const classDecl = declarations?.find(
      (decl) => decl.kind === ts.SyntaxKind.ClassDeclaration,
    ) as ts.ClassDeclaration | undefined

    return classDecl || null
  }
}

export interface AliasType extends ts.Type {
  tswireTypeAliasSymbol: ts.Symbol
}

export function isAliasType(type: ts.Type): type is AliasType {
  return "tswireTypeAliasSymbol" in type
}

export class FunctionProvider implements ProviderInterface {
  constructor(
    protected declaration: ts.FunctionDeclaration,
    protected checker: WireTypeChecker,
  ) {}

  node(): ts.Node {
    return this.declaration
  }

  exportName(): string {
    return this.declaration.name!.text
  }

  get isAsync(): boolean {
    return !!this.declaration.modifiers?.some(
      (mod) => mod.kind === ts.SyntaxKind.AsyncKeyword,
    )
  }

  unwrapAsyncPromiseType(returnType: ts.Type): ts.Type {
    if (returnType.symbol.name !== "Promise") {
      throw new Error("Expected a Promise type")
    }

    // I can't figure out if there is a type narrow in the compiler API
    const targs: ts.Type[] | undefined = (returnType as any)
      .resolvedTypeArguments

    if (targs && targs.length == 1) {
      return targs[0]
    }

    throw new Error("No type argument found for Promise type")
  }

  outputType(): ts.Type {
    let typeNode = this.declaration.type!

    // if (type.getText().startsWith("Promise<")) {}
    if (this.isAsync) {
      // Expect this to be the case if isAsync is true
      typeNode = (typeNode as ts.NodeWithTypeArguments).typeArguments![0]
    }

    // this.declaration.type.getText() // "Promise<Foo>"
    // this.declaration.type.typeArguments[0].getText() // Foo
    return this.checker.getTypeAtLocationWithAliasSymbol(typeNode)
  }

  private _inputTypes?: ts.Type[]
  inputTypes(): ts.Type[] {
    if (this._inputTypes) {
      return this._inputTypes
    }

    this._inputTypes = this.declaration.parameters.map((param) => {
      return this.checker.getTypeAtLocationWithAliasSymbol(param.type!)
    })

    // this._inputTypes = this.signature.getParameters().map((param) => {
    //   return this.getTypeAtLocationWithAliasSymbol(param.type)
    // })

    return this._inputTypes
  }
}

// `DependencyGraph` is a mapping that represents the dependencies between types in the DI system.
// The key is a string representing the name of a type (the return type of a provider).
// The value is a Set of strings, where each string represents the name of a type that the key type depends on (parameter types of the provider).
// For example, if a provider function returns a type `A` and requires types `B` and `C` as inputs,
// the graph will have an entry with `A` as the key, and a set containing `B` and `C`.
// This graph is used to determine the order in which provider functions should be called to satisfy dependencies,
// ensuring that all inputs for a given provider are available before it is invoked.
type DependencyGraph = Map<ts.Type, Set<ts.Type>>

interface WireTypeChecker extends ts.TypeChecker {
  getTypeAtLocationWithAliasSymbol(node: ts.Node): ts.Type
}

function monkeyPatchTypeChecker(checker: ts.TypeChecker): WireTypeChecker {
  const wc = Object.create(checker)

  const cache = new Map<ts.Symbol, ts.Type>()

  // getTypeAtLocationPreserveReference returns the type, with type alias symbol
  // if applicable. It resolves to the same object instance for the same aliased
  // type symbol, to preserve mapping identity.
  wc.getTypeAtLocationWithAliasSymbol = function (node: ts.Node): ts.Type {
    // getTypeAtLocation gives the resolved type for type aliases
    let type = checker.getTypeAtLocation(node)

    if (ts.isTypeReferenceNode(node)) {
      const symbol = checker.getSymbolAtLocation(node.typeName)!

      if (!symbol) {
        throw new Error("symbol not found")
      }

      const isIntrinsic = type.symbol == undefined

      // idea: detect if the resolved type has a different symbol from the type
      // name we are looking at right now, then it's a type alias.
      const isTypeAlias = isIntrinsic || type.symbol != symbol

      if (!isTypeAlias) {
        return type
      }

      // need to return the same wrapped ts.Type for this symbol, so object
      // identity works for using ts.Type as key in Map
      if (cache.has(symbol)) {
        return cache.get(symbol)!
      }

      // Notes on the type returned by checker. No immediate type could be
      // extracted from symbols, it seems. For a type alias, the checker always
      // gives the resolved underlying type.
      //
      // const aliasDeclaration: ts.TypeAliasDeclaration =
      //   symbol.declarations![0] as any
      //   this.checker.getTypeAtLocation(aliasDeclaration.name) // TypeObject
      //   number this.checker.getTypeFromTypeNode(node) // TypeObject number
      //   this.checker.getTypeFromTypeNode(aliasDeclaration.type) // TypeObject
      //   number this.checker.getTypeOfSymbol(symbol) // TypeObject error
      //   this.checker.getDeclaredTypeOfSymbol(symbol) // TypeObject number

      // the ts.Type interface in fact has aliasSymbol, but that doesn't seem to
      // get populated for type aliases.
      const aliasedType: AliasType = Object.create(type, {
        tswireTypeAliasSymbol: {
          value: symbol,
          // writable: true,
          // enumerable: true,
          // configurable: true
        },
      })

      cache.set(symbol, aliasedType)

      type = aliasedType
    }

    return type
  }

  return wc
}

export function typeName(type: ts.Type): string {
  if (isAliasType(type)) {
    return type.tswireTypeAliasSymbol.name
  }

  if (type.symbol) {
    return type.symbol.name
  }

  if ("intrinsicName" in type) {
    return type.intrinsicName as string
  }

  return ""
}

export class Resolver {
  constructor(public entry: ts.Expression, public checker: WireTypeChecker) {}

  /**
   * Resolves and collects all provider declarations from a given expression.
   * Recursively processes arrays of providers or individual provider identifiers.
   * @param arg The expression to resolve for provider declarations.
   * @returns An array of function declarations corresponding to providers.
   */
  public collectProviders(arg: ts.Expression): ProviderInterface[] {
    const providerDeclarations: ProviderInterface[] = []
    const checker = this.checker

    function processExpression(expression: ts.Node): void {
      if (ts.isPropertyAccessExpression(expression)) {
        const symbol = checker.getSymbolAtLocation(expression)

        if (!symbol) {
          throw new Error(`Unknown symbol found: ${expression.getText()}`)
        }

        const declaration = symbol?.valueDeclaration

        if (!declaration) {
          throw new Error(`undeclared symbol found: ${symbol.name}`)
        }

        processExpression(declaration)
      } else if (ts.isIdentifier(expression)) {
        let symbol = checker.getSymbolAtLocation(expression)
        if (!symbol) {
          throw new Error(`Unknown symbol found: ${expression.getText()}`)
        }

        // detect module reference, and resolved the aliased (i.e. imported)
        // symbol
        if (!symbol.valueDeclaration && ts.isModuleReference(expression)) {
          // q: or just test for ~symbol.valueDeclaration?
          // resolve module import
          symbol = checker.getAliasedSymbol(symbol)
        }

        const declaration = symbol.valueDeclaration
        if (!declaration) {
          throw new Error(`undeclared symbol found: ${symbol.name}`)
        }

        // ts.isTypeAliasDeclaration(expression)
        // ts.isImportTypeNode(expression)
        // ts.isTypeReferenceNode(expression)
        // ts.isModuleReference(expression)
        // ts.isExternalModuleReference(expression)
        // ts.isConstTypeReference(expression)

        processExpression(declaration)

        // dereference the variable declaration initializer
      } else if (ts.isVariableDeclaration(expression)) {
        if (expression.initializer) {
          processExpression(expression.initializer)
        } else {
          throw new Error("Variable does not have an initializer")
        }
      } else if (ts.isArrayLiteralExpression(expression)) {
        // Process each element in the array literal
        for (let elem of expression.elements) {
          processExpression(elem)
        }
      } else if (ts.isClassDeclaration(expression)) {
        providerDeclarations.push(new ClassProvider(expression, checker))
      } else if (ts.isFunctionDeclaration(expression)) {
        const isExported = expression.modifiers?.some(
          (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
        )

        if (!isExported) {
          throw new Error("Provider function must be exported")
        }

        providerDeclarations.push(new FunctionProvider(expression, checker))
      }
    }

    processExpression(arg)

    return providerDeclarations
  }

  /**
   * Builds a dependency graph from collected provider declarations.
   * This graph maps the return types of provider functions to a set of types they depend on.
   * @returns The DependencyGraph mapping provider return types to their dependencies.
   */
  public buildDependencyGraph(): DependencyGraph {
    const dependencyGraph: DependencyGraph = new Map()
    const providers = this.collectProviders(this.entry)

    for (const provider of providers) {
      const outputType = provider.outputType()
      const inputTypes = provider.inputTypes()

      let dependencies = dependencyGraph.get(outputType)
      if (!dependencies) {
        dependencies = new Set<ts.Type>()
        dependencyGraph.set(outputType, dependencies)
      }

      for (const paramType of inputTypes) {
        dependencies.add(paramType)
      }
    }

    return dependencyGraph
  }

  public linearizeProvidersForReturnType(
    providers: ProviderInterface[],
    returnType: ts.Type,
  ): ProviderInterface[] {
    const providerMap: Map<ts.Type, ProviderInterface> = new Map()

    // populate providerMap with providers. This is just a map from the return
    // type of the provider to the provider.
    for (let provider of providers) {
      const returnType = provider.outputType()

      providerMap.set(returnType, provider)
    }

    const dependencyGraph = this.buildDependencyGraph()
    const deps = topologicalSort(returnType, dependencyGraph)

    const linearizedProviders = deps.map((dep) => {
      const provider = providerMap.get(dep)

      const symbol = dep.symbol
      if ("intrinsicName" in dep && !("tswireTypeAliasSymbol" in dep)) {
        throw new Error(`intrinsic types not supported: ${dep.intrinsicName}`)
      }

      if (!provider) {
        throw new Error(`cannot find provider: ${dep.symbol.getName()}`)
      }
      return provider
    })

    return linearizedProviders
  }

  // `generateInitFunction` constructs the TypeScript code for an initialization function
  // that uses the sorted providers to satisfy dependencies for a target type.
  // The function constructs the required import statements dynamically to avoid naming conflicts
  // and ensure that only necessary provider functions are imported and used.
  // `providers`: An array of FunctionDeclaration objects representing the sorted providers.
  // `targetType`: The Type object representing the type we aim to construct.
  // Returns a string containing the TypeScript code for the initialization function and necessary imports.
  public generateInitFunction(
    outputModuleFile: string,
    providers: ProviderInterface[],
    targetType: ts.Type,
  ): string {
    const typeToVariableNameMap: Map<string, string> = new Map()
    const importStatements: string[] = []
    const providerCalls: string[] = []
    const usedNames: Set<string> = new Set() // Tracks used names to avoid collisions.

    for (let provider of providers) {
      const outputType: ts.Type = provider.outputType()

      const outputTypeName: string = typeName(outputType)
      const baseName: string = variableNameForType(outputType)
      let uniqueName = baseName
      let counter = 1
      while (usedNames.has(uniqueName)) {
        uniqueName = `${baseName}${counter}`
        counter++
      }
      usedNames.add(uniqueName)
      typeToVariableNameMap.set(outputTypeName, uniqueName)

      const providerTypeName = provider.exportName()

      // Generate import statement for the provider.
      // const importName = usedNames.has(providerTypeName)
      //   ? `${providerTypeName} as ${providerTypeName}Instance`
      //   : providerTypeName

      // fully qualified file path name
      const declarationFileName = findSourceFile(provider.node()).fileName

      const importPath = relativeImportPath(
        outputModuleFile,
        declarationFileName,
      )

      importStatements.push(
        `import { ${providerTypeName} } from "${importPath}";`,
      )

      // Construct the call to the provider function or class construction, including passing the required parameters.
      const params: string[] = provider.inputTypes().map((type) => {
        const paramType = typeName(type)
        if (!typeToVariableNameMap.has(paramType)) {
          throw new Error(`No provider found for type ${paramType}`)
        }
        return typeToVariableNameMap.get(paramType)!
      })

      if (provider instanceof FunctionProvider) {
        const call = provider.isAsync
          ? `  const ${uniqueName} = await ${providerTypeName}(${params.join(
              ", ",
            )});`
          : `  const ${uniqueName} = ${providerTypeName}(${params.join(", ")});`
        providerCalls.push(call)
      } else if (provider instanceof ClassProvider) {
        providerCalls.push(
          `  const ${uniqueName} = new ${providerTypeName}(${params.join(
            ", ",
          )});`,
        )
      }
    }

    const targetTypeSymbol = targetType.getSymbol()
    const targetTypeName = targetTypeSymbol ? targetTypeSymbol.getName() : ""
    const imports = importStatements.join("\n")
    const body = providerCalls.join("\n")
    const returnVariableName =
      typeToVariableNameMap.get(
        targetType.getSymbol()?.getEscapedName().toString() || "",
      ) || ""
    const returnStatement = `return ${returnVariableName};`

    const asyncKeyword = providers.some(
      (provider) => provider instanceof FunctionProvider && provider.isAsync,
    )
      ? "async "
      : ""

    const output = `${imports}\n\nexport ${asyncKeyword}function init() {\n${body}\n  ${returnStatement}\n}`
    return output
  }
}

export class Initializer {
  private resolver: Resolver

  constructor(
    private context: InjectionAnalyzer,
    public declaration: ts.FunctionDeclaration,
    // public signature: ts.Signature,
    public providersEntry: ts.Expression,
  ) {
    this.resolver = new Resolver(this.providersEntry, this.context.checker)
  }

  get checker() {
    return this.context.checker
  }

  get name(): string {
    return this.declaration.name!.text
  }

  get returnType(): ts.Type {
    return this.checker.getTypeAtLocationWithAliasSymbol(this.declaration.type!)
  }

  public providers(): ProviderInterface[] {
    return this.resolver.collectProviders(this.providersEntry)
  }

  public linearizedProviders(): ProviderInterface[] {
    return this.resolver.linearizeProvidersForReturnType(
      this.providers(),
      this.returnType,
    )
  }

  public initializationCode(): string {
    const moduleFile = this.context.rootFile
    const providers = this.linearizedProviders()

    return this.resolver
      .generateInitFunction(moduleFile, providers, this.returnType)
      .trim()
  }
}

// `wireOutputPath` generates a new file path with `_wire` appended to the
// filename before the extension, using Node.js `path` module for handling file
// paths. This approach is more robust and handles edge cases well, such as
// files without extensions. `inputFilePath`: A string representing the path to
// the input file. Returns a string representing the path to the output file
// with `_wire` appended to the filename.
function wireOutputPath(inputFilePath: string): string {
  // Extract the directory, filename without extension, and extension from the input path.
  const dirname = path.dirname(inputFilePath)
  const extname = path.extname(inputFilePath)
  const basename = path.basename(inputFilePath, extname)

  // Append '_gen' to the basename, then reconstruct the path.
  const outputFileName = `${basename}_gen${extname}`
  const outputFilePath = path.join(dirname, outputFileName)

  return outputFilePath
}

export class InjectionAnalyzer {
  public program: ts.Program
  public checker: WireTypeChecker

  constructor(public rootFile: string) {
    this.program = ts.createProgram([rootFile], { allowJs: true })
    this.checker = monkeyPatchTypeChecker(this.program.getTypeChecker())
  }

  public code(): string {
    const inits = this.findInitializers()
    const init = inits[0]
    return init.initializationCode()
  }

  public async writeCode(outputFile?: string) {
    if (!outputFile) {
      outputFile = wireOutputPath(this.rootFile)
    }
    await Bun.write(outputFile, this.code())
  }

  public findInitializers(): Initializer[] {
    const inits: Initializer[] = []

    const checker = this.checker
    const self = this

    // checkAndReturnInitializer returns Initializer if a node is a function declaration with a `tswire` call.
    function checkAndReturnInitializer(node: ts.Node): Initializer | undefined {
      if (!ts.isFunctionDeclaration(node)) {
        return
      }

      if (!node.body || node.body.statements.length === 0) {
        return
      }

      if (!node.name) {
        return
      }

      const signature = checker.getSignatureFromDeclaration(node)
      if (!signature) {
        return
      }

      // check return type is not void...
      const rtype = signature.getReturnType()
      if (rtype.flags & nonInjectableReturnTypes) {
        return
      }

      const firstStatement = node.body.statements[0]

      if (
        ts.isExpressionStatement(firstStatement) &&
        ts.isCallExpression(firstStatement.expression) &&
        firstStatement.expression.expression.getText() === "tswire" &&
        firstStatement.expression.arguments.length == 1
      ) {
        const providers = firstStatement.expression.arguments[0]
        return new Initializer(self, node, providers)
      }
    }

    function visit(node: ts.Node) {
      const init = checkAndReturnInitializer(node)
      if (init) {
        inits.push(init)
      }
    }

    const sourceFile = this.program.getSourceFile(this.rootFile)
    if (!sourceFile) {
      throw new Error(`source file not found: ${this.rootFile}`)
    }

    ts.forEachChild(sourceFile, visit)

    return inits
  }
}
