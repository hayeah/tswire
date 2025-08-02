import type * as ts from "typescript";
import { InitArgProvider } from "./providers/InitArgProvider";
import { Resolver } from "./Resolver";
import type { ProviderInterface, WireTypeChecker } from "./types";

export class Initializer {
  private resolver: Resolver;

  constructor(
    private checker: WireTypeChecker,
    public declaration: ts.FunctionDeclaration,
    // public signature: ts.Signature,
    public providersEntry: ts.Expression,
  ) {
    this.resolver = new Resolver(this.providersEntry, this.checker);
  }

  get name(): string {
    return this.declaration.name?.text || "<anonymous>";
  }

  get returnType(): ts.Type {
    if (!this.declaration.type) {
      throw new Error("Function declaration has no return type annotation");
    }
    return this.checker.getTypeAtLocationWithAliasSymbol(this.declaration.type);
  }

  private initArgProviders(): ProviderInterface[] {
    return this.declaration.parameters.map(
      (p) => new InitArgProvider(p, this.checker),
    );
  }

  public providers(): ProviderInterface[] {
    return [
      ...this.resolver.collectProviders(this.providersEntry),
      ...this.initArgProviders(),
    ];
  }

  public linearizedProviders(): ProviderInterface[] {
    return this.resolver.linearizeProvidersForReturnType(
      this.providers(),
      this.returnType,
    );
  }
}
