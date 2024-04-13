import * as ts from "typescript"

const nonInjectableReturnTypes =
  ts.TypeFlags.Void |
  ts.TypeFlags.Any |
  ts.TypeFlags.Undefined |
  ts.TypeFlags.Never

export class Resolver {
  constructor(public entry: ts.Expression, public checker: ts.TypeChecker) {}

  /**
   * Resolves and collects all provider declarations from a given expression.
   * Recursively processes arrays of providers or individual provider identifiers.
   * @param arg The expression to resolve for provider declarations.
   * @returns An array of function declarations corresponding to providers.
   */
  public resolveProviders(arg: ts.Expression): ts.FunctionDeclaration[] {
    const providerDeclarations: ts.FunctionDeclaration[] = []
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
      } else if (ts.isFunctionDeclaration(expression)) {
        const isExported = expression.modifiers?.some(
          (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
        )

        if (!isExported) {
          throw new Error("Provider function must be exported")
        }

        providerDeclarations.push(expression)
      }
    }

    processExpression(arg)

    return providerDeclarations
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
