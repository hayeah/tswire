import * as ts from "typescript";
import type { ProviderInterface, WireTypeChecker } from "./types";
import { findSourceFile } from "./utils";

export class FunctionProvider implements ProviderInterface {
  constructor(
    protected declaration: ts.FunctionDeclaration,
    protected checker: WireTypeChecker,
  ) {
    if (!declaration.type) {
      const sourceFile = findSourceFile(declaration);
      const { line, character } = ts.getLineAndCharacterOfPosition(
        sourceFile,
        declaration.getStart(),
      );
      const name = declaration.name?.getText() || "<anonymous>";
      throw new Error(
        `tswire: provider "${name}" at ${sourceFile.fileName}:${line + 1}:${
          character + 1
        } must declare an explicit return-type annotation`,
      );
    }
  }

  node(): ts.Node {
    return this.declaration;
  }

  exportName(): string {
    return this.declaration.name?.text || "<anonymous>";
  }

  get isAsync(): boolean {
    return !!this.declaration.modifiers?.some(
      (mod) => mod.kind === ts.SyntaxKind.AsyncKeyword,
    );
  }

  unwrapAsyncPromiseType(returnType: ts.Type): ts.Type {
    if (returnType.symbol.name !== "Promise") {
      throw new Error("Expected a Promise type");
    }

    // I can't figure out if there is a type narrow in the compiler API
    const targs: ts.Type[] | undefined = (returnType as any)
      .resolvedTypeArguments;

    if (targs && targs.length === 1) {
      return targs[0];
    }

    throw new Error("No type argument found for Promise type");
  }

  outputType(): ts.Type {
    if (!this.declaration.type) {
      const sourceFile = findSourceFile(this.declaration);
      const { line, character } = ts.getLineAndCharacterOfPosition(
        sourceFile,
        this.declaration.getStart(),
      );
      const name = this.declaration.name?.getText() || "<anonymous>";
      throw new Error(
        `tswire: provider "${name}" at ${sourceFile.fileName}:${line + 1}:${
          character + 1
        } must declare an explicit return-type annotation`,
      );
    }

    let typeNode = this.declaration.type;

    // if (type.getText().startsWith("Promise<")) {}
    if (this.isAsync) {
      // Expect this to be the case if isAsync is true
      const asyncType = typeNode as ts.NodeWithTypeArguments;
      if (!asyncType.typeArguments || asyncType.typeArguments.length === 0) {
        throw new Error("Async function return type should be Promise<T>");
      }
      typeNode = asyncType.typeArguments[0];
    }

    // this.declaration.type.getText() // "Promise<Foo>"
    // this.declaration.type.typeArguments[0].getText() // Foo
    return this.checker.getTypeAtLocationWithAliasSymbol(typeNode);
  }

  private _inputTypes?: ts.Type[];
  inputTypes(): ts.Type[] {
    if (this._inputTypes) {
      return this._inputTypes;
    }

    this._inputTypes = this.declaration.parameters.map((param, index) => {
      if (!param.type) {
        const sourceFile = findSourceFile(this.declaration);
        const { line, character } = ts.getLineAndCharacterOfPosition(
          sourceFile,
          param.getStart(),
        );
        const functionName = this.declaration.name?.getText() || "<anonymous>";
        const paramName = param.name?.getText() || `parameter ${index + 1}`;
        throw new Error(
          `tswire: parameter "${paramName}" of provider "${functionName}" at ${
            sourceFile.fileName
          }:${line + 1}:${character + 1} must have an explicit type annotation`,
        );
      }
      return this.checker.getTypeAtLocationWithAliasSymbol(param.type);
    });

    // this._inputTypes = this.signature.getParameters().map((param) => {
    //   return this.getTypeAtLocationWithAliasSymbol(param.type)
    // })

    return this._inputTypes;
  }
}
