import type * as ts from "typescript";

export interface ProviderInterface {
  node(): ts.Node;
  exportName(): string;
  inputTypes(): ts.Type[];
  outputType(): ts.Type;
}

export interface AliasType extends ts.Type {
  tswireTypeAliasSymbol: ts.Symbol;
}

export function isAliasType(type: ts.Type): type is AliasType {
  return "tswireTypeAliasSymbol" in type;
}

export interface WireTypeChecker extends ts.TypeChecker {
  getTypeAtLocationWithAliasSymbol(node: ts.Node): ts.Type;
}

// `DependencyGraph` is a mapping that represents the dependencies between types in the DI system.
// The key is a string representing the name of a type (the return type of a provider).
// The value is a Set of strings, where each string represents the name of a type that the key type depends on (parameter types of the provider).
// For example, if a provider function returns a type `A` and requires types `B` and `C` as inputs,
// the graph will have an entry with `A` as the key, and a set containing `B` and `C`.
// This graph is used to determine the order in which provider functions should be called to satisfy dependencies,
// ensuring that all inputs for a given provider are available before it is invoked.
export type DependencyGraph = Map<ts.Symbol, Set<ts.Symbol>>;
