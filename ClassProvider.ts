import * as ts from "typescript";
import type { ProviderInterface, WireTypeChecker } from "./types";
import { findSourceFile } from "./utils";

export class ClassProvider implements ProviderInterface {
  constructor(
    protected declaration: ts.ClassDeclaration,
    protected checker: WireTypeChecker,
  ) {}

  node(): ts.Node {
    return this.declaration;
  }

  exportName(): string {
    return this.declaration.name?.text || "<anonymous>";
  }

  inputTypes(): ts.Type[] {
    const ctor = this.findConstructor();
    if (!ctor) {
      // If no constructor is found, return an empty array indicating no inputs are needed.
      return [];
    }

    // Map each parameter in the constructor to its type.
    return ctor.parameters.map((param, index) => {
      if (!param.type) {
        const sourceFile = findSourceFile(this.declaration);
        const { line, character } = ts.getLineAndCharacterOfPosition(
          sourceFile,
          param.getStart(),
        );
        const className = this.declaration.name?.getText() || "<anonymous>";
        const paramName = param.name?.getText() || `parameter ${index + 1}`;
        throw new Error(
          `tswire: parameter "${paramName}" of class "${className}" constructor at ${
            sourceFile.fileName
          }:${line + 1}:${character + 1} must have an explicit type annotation`,
        );
      }
      return this.checker.getTypeAtLocationWithAliasSymbol(param.type);
    });
  }

  outputType(): ts.Type {
    // The output type is the class type itself.
    if (!this.declaration.name) {
      throw new Error("Class declaration has no name");
    }
    return this.checker.getTypeAtLocation(this.declaration.name);
  }

  private findConstructor(): ts.ConstructorDeclaration | null {
    let currentClass: ts.ClassDeclaration = this.declaration;

    while (currentClass) {
      const ctor = currentClass.members.find(ts.isConstructorDeclaration) as
        | ts.ConstructorDeclaration
        | undefined;
      if (ctor) {
        return ctor;
      }

      // Move up to the superclass (if any)
      const superclass = this.findSuperClass(currentClass);
      if (!superclass) {
        return null;
      }
      currentClass = superclass;
    }
    return null;
  }

  private findSuperClass(
    classDeclaration: ts.ClassDeclaration,
  ): ts.ClassDeclaration | null {
    const heritageClause = classDeclaration.heritageClauses?.find(
      (h) => h.token === ts.SyntaxKind.ExtendsKeyword,
    );
    if (!heritageClause || heritageClause.types.length === 0) {
      return null;
    }

    const type = this.checker.getTypeAtLocation(heritageClause.types[0]);
    if (!type.symbol) {
      return null;
    }

    const declarations = type.symbol.declarations;
    const classDecl = declarations?.find(
      (decl) => decl.kind === ts.SyntaxKind.ClassDeclaration,
    ) as ts.ClassDeclaration | undefined;

    return classDecl || null;
  }
}
