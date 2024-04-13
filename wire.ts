import * as ts from "typescript"
import { topologicalSort } from "./topsort"

const nonInjectableReturnTypes =
  ts.TypeFlags.Void |
  ts.TypeFlags.Any |
  ts.TypeFlags.Undefined |
  ts.TypeFlags.Never

interface ProviderInterface {
  exportName(): string

  inputTypes(): ts.Type[]
  outputType(): ts.Type
}

export class ClassProvider implements ProviderInterface {
  constructor(
    protected declaration: ts.ClassDeclaration,
    protected checker: ts.TypeChecker
  ) {}

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
      this.checker.getTypeAtLocation(param)
    )
  }

  outputType(): ts.Type {
    // The output type is the class type itself.
    return this.checker.getTypeAtLocation(this.declaration.name!)
  }

  private findConstructor(): ts.ConstructorDeclaration | null {
    // Check if the class has its own constructor.
    const constructor = this.declaration.members.find(
      ts.isConstructorDeclaration
    ) as ts.ConstructorDeclaration | undefined

    if (constructor) {
      return constructor
    }

    // If there's no constructor, check superclasses recursively.
    // Note: This part can get complex if you need to handle inherited constructors from superclasses.
    // This implementation assumes no need to look into superclasses for simplification.
    return null
  }
}

export class FunctionProvider implements ProviderInterface {
  constructor(
    protected declaration: ts.FunctionDeclaration,
    protected checker: ts.TypeChecker
  ) {}

  exportName(): string {
    return this.declaration.name!.text
  }

  get isAsync(): boolean {
    return !!this.declaration.modifiers?.some(
      (mod) => mod.kind === ts.SyntaxKind.AsyncKeyword
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
    const signature = this.checker.getSignatureFromDeclaration(
      this.declaration as ts.FunctionDeclaration
    )

    if (!signature) {
      throw new Error("No signature found for provider function")
    }

    // this.checker.getTypeArguments(signature.getReturnType()!

    const returnType = signature.getReturnType()

    return this.isAsync ? this.unwrapAsyncPromiseType(returnType) : returnType
  }

  inputTypes(): ts.Type[] {
    const signature = this.checker.getSignatureFromDeclaration(
      this.declaration as ts.FunctionDeclaration
    )
    return signature
      ? signature
          .getParameters()
          .map((param) =>
            this.checker.getTypeAtLocation(param.valueDeclaration!)
          )
      : []
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

export class Resolver {
  constructor(public entry: ts.Expression, public checker: ts.TypeChecker) {}

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
      if (ts.isIdentifier(expression)) {
        const symbol = checker.getSymbolAtLocation(expression)
        const declaration = symbol?.valueDeclaration

        if (!symbol || !declaration) {
          throw new Error("Unknown symbol found for wire function argument")
        }

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
          (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
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
    returnType: ts.Type
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

    const linearizedProviders = deps.map((dep) => providerMap.get(dep)!)

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
    moduleImportName: string,
    providers: ProviderInterface[],
    targetType: ts.Type
  ): string {
    const typeToVariableNameMap: Map<string, string> = new Map()
    const importStatements: string[] = []
    const providerCalls: string[] = []
    const usedNames: Set<string> = new Set() // Tracks used names to avoid collisions.

    for (let provider of providers) {
      const outputType: ts.Type = provider.outputType()
      const returnType: string = this.checker.typeToString(outputType) // This gets the type as a string
      const baseName: string = returnType.toLowerCase()
      let uniqueName = baseName
      let counter = 1
      while (usedNames.has(uniqueName)) {
        uniqueName = `${baseName}${counter}`
        counter++
      }
      usedNames.add(uniqueName)
      typeToVariableNameMap.set(returnType, uniqueName)

      const providerTypeName = provider.exportName()

      // Generate import statement for the provider.
      // const importName = usedNames.has(providerTypeName)
      //   ? `${providerTypeName} as ${providerTypeName}Instance`
      //   : providerTypeName

      importStatements.push(
        `import { ${providerTypeName} } from "./${moduleImportName}";`
      )

      // Construct the call to the provider function or class construction, including passing the required parameters.
      const params: string[] = provider.inputTypes().map((type) => {
        const paramType = this.checker.typeToString(type)
        if (!typeToVariableNameMap.has(paramType)) {
          throw new Error(`No provider found for type ${paramType}`)
        }
        return typeToVariableNameMap.get(paramType)!
      })

      if (provider instanceof FunctionProvider) {
        const call = provider.isAsync
          ? `  const ${uniqueName} = await ${providerTypeName}(${params.join(
              ", "
            )});`
          : `  const ${uniqueName} = ${providerTypeName}(${params.join(", ")});`
        providerCalls.push(call)
      } else if (provider instanceof ClassProvider) {
        providerCalls.push(
          `  const ${uniqueName} = new ${providerTypeName}(${params.join(
            ", "
          )});`
        )
      }
    }

    const targetTypeSymbol = targetType.getSymbol()
    const targetTypeName = targetTypeSymbol ? targetTypeSymbol.getName() : ""
    const imports = importStatements.join("\n")
    const body = providerCalls.join("\n")
    const returnVariableName =
      typeToVariableNameMap.get(
        targetType.getSymbol()?.getEscapedName().toString() || ""
      ) || ""
    const returnStatement = `return ${returnVariableName};`

    const asyncKeyword = providers.some(
      (provider) => provider instanceof FunctionProvider && provider.isAsync
    )
      ? "async "
      : ""

    const output = `${imports}\n\nexport ${asyncKeyword}function init() {\n${body}\n  ${returnStatement}\n}`
    return output
  }
}

export class Initializer {
  constructor(
    public declaration: ts.FunctionDeclaration,
    public signature: ts.Signature,
    public providers: ts.Expression
  ) {}

  get name(): string {
    return this.declaration.name!.text
  }

  get returnType(): ts.Type {
    return this.signature.getReturnType()
  }
}

export class InjectionAnalyzer {
  public program: ts.Program
  public checker: ts.TypeChecker

  constructor(public rootFile: string) {
    this.program = ts.createProgram([rootFile], { allowJs: true })
    this.checker = this.program.getTypeChecker()
  }

  public findInitializers(): Initializer[] {
    const inits: Initializer[] = []

    const checker = this.checker

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
        return new Initializer(node, signature, providers)
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
      throw new Error("source file not found")
    }

    ts.forEachChild(sourceFile, visit)

    return inits
  }
}
