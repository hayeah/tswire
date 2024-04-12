import * as ts from "typescript"

const nonInjectableReturnTypes =
  ts.TypeFlags.Void |
  ts.TypeFlags.Any |
  ts.TypeFlags.Undefined |
  ts.TypeFlags.Never

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

  // wire expression

  // get isAsync()
}

export class InjectionAnalyzer {
  program: ts.Program
  checker: ts.TypeChecker

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
