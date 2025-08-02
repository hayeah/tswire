import type * as ts from "typescript";
import type { ProviderInterface, WireTypeChecker } from "../types";

export class InitArgProvider implements ProviderInterface {
  constructor(
    private param: ts.ParameterDeclaration,
    private checker: WireTypeChecker,
  ) {}

  node(): ts.Node {
    return this.param;
  }

  exportName(): string {
    return this.param.name.getText();
  }

  inputTypes(): ts.Type[] {
    return [];
  }

  outputType(): ts.Type {
    if (!this.param.type) {
      throw new Error("Parameter has no type annotation");
    }
    return this.checker.getTypeAtLocationWithAliasSymbol(this.param.type);
  }
}
