import * as ts from "typescript";
import { ClassProvider } from "./ClassProvider";
import { FunctionProvider } from "./FunctionProvider";
import { topologicalSort } from "./topsort";
import type {
  DependencyGraph,
  ProviderInterface,
  WireTypeChecker,
} from "./types";
import { canonicalSymbol, findSourceFile, typeName } from "./utils";

export class Resolver {
  constructor(
    public entry: ts.Expression,
    public checker: WireTypeChecker,
  ) {}

  /**
   * Gets the canonical symbol for a type, throwing an error if not found.
   * @param type The type to get the symbol for
   * @returns The canonical symbol
   * @throws Error if the symbol is not found
   */
  public canonicalSymbol(type: ts.Type): ts.Symbol {
    const symbol = canonicalSymbol(type, this.checker);

    if (!symbol) {
      throw new Error(`Type has no symbol: ${typeName(type)}`);
    }

    return symbol;
  }

  /**
   * Resolves and collects all provider declarations from a given expression.
   * Recursively processes arrays of providers or individual provider identifiers.
   * @param arg The expression to resolve for provider declarations.
   * @returns An array of function declarations corresponding to providers.
   */
  public collectProviders(arg: ts.Expression): ProviderInterface[] {
    const providerDeclarations: ProviderInterface[] = [];
    const checker = this.checker;
    const sourceFile = findSourceFile(arg);

    function processExpression(expression: ts.Node): void {
      if (ts.isPropertyAccessExpression(expression)) {
        const symbol = checker.getSymbolAtLocation(expression);

        if (!symbol) {
          throw new Error(`Unknown symbol found: ${expression.getText()}`);
        }

        const declaration = symbol?.valueDeclaration;

        if (!declaration) {
          throw new Error(`undeclared symbol found: ${symbol.name}`);
        }

        processExpression(declaration);
      } else if (ts.isIdentifier(expression)) {
        let symbol = checker.getSymbolAtLocation(expression);
        if (!symbol) {
          throw new Error(`Unknown symbol found: ${expression.getText()}`);
        }

        // detect module reference, and resolved the aliased (i.e. imported)
        // symbol
        if (!symbol.valueDeclaration && ts.isModuleReference(expression)) {
          // q: or just test for ~symbol.valueDeclaration?
          // resolve module import
          symbol = checker.getAliasedSymbol(symbol);
        }

        const declaration = symbol.valueDeclaration;
        if (!declaration) {
          throw new Error(`undeclared symbol found: ${symbol.name}`);
        }

        // ts.isTypeAliasDeclaration(expression)
        // ts.isImportTypeNode(expression)
        // ts.isTypeReferenceNode(expression)
        // ts.isModuleReference(expression)
        // ts.isExternalModuleReference(expression)
        // ts.isConstTypeReference(expression)

        processExpression(declaration);

        // dereference the variable declaration initializer
      } else if (ts.isVariableDeclaration(expression)) {
        if (expression.initializer) {
          processExpression(expression.initializer);
        } else {
          throw new Error("Variable does not have an initializer");
        }
      } else if (ts.isArrayLiteralExpression(expression)) {
        // Process each element in the array literal
        for (const elem of expression.elements) {
          processExpression(elem);
        }
      } else if (ts.isClassDeclaration(expression)) {
        providerDeclarations.push(new ClassProvider(expression, checker));
      } else if (ts.isFunctionDeclaration(expression)) {
        const isExported = expression.modifiers?.some(
          (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
        );

        if (!isExported) {
          throw new Error("Provider function must be exported");
        }

        // Check for explicit return type annotation
        if (!expression.type) {
          const { line, character } = ts.getLineAndCharacterOfPosition(
            sourceFile,
            expression.getStart(),
          );
          const name = expression.name?.getText() || "<anonymous>";
          throw new Error(
            `tswire: provider "${name}" at ${sourceFile.fileName}:${line + 1}:${
              character + 1
            } must declare an explicit return-type annotation`,
          );
        }

        providerDeclarations.push(new FunctionProvider(expression, checker));
      } else if (
        ts.isArrowFunction(expression) ||
        ts.isFunctionExpression(expression) ||
        ts.isMethodDeclaration(expression)
      ) {
        const { line, character } = ts.getLineAndCharacterOfPosition(
          sourceFile,
          expression.getStart(),
        );
        const name = expression
          .getText(sourceFile)
          .slice(0, 40)
          .replace(/\s+/g, " ");
        throw new Error(
          `tswire: provider starting with "${name}..." at ${sourceFile.fileName}:${
            line + 1
          }:${character + 1} must be a function or class declaration, ` +
            `not a variable, arrow function, or import reference`,
        );
      }
    }

    processExpression(arg);

    return providerDeclarations;
  }

  /**
   * Builds a dependency graph from collected provider declarations.
   * This graph maps the return types of provider functions to a set of types they depend on.
   * @returns The DependencyGraph mapping provider return types to their dependencies.
   */
  public buildDependencyGraph(
    providers?: ProviderInterface[],
  ): DependencyGraph {
    const dependencyGraph: DependencyGraph = new Map();
    if (!providers) {
      providers = this.collectProviders(this.entry);
    }

    for (const provider of providers) {
      const outputType = provider.outputType();
      const outputSymbol = this.canonicalSymbol(outputType);

      const inputTypes = provider.inputTypes();

      let dependencies = dependencyGraph.get(outputSymbol);
      if (!dependencies) {
        dependencies = new Set<ts.Symbol>();
        dependencyGraph.set(outputSymbol, dependencies);
      }

      for (const paramType of inputTypes) {
        const paramSymbol = this.canonicalSymbol(paramType);
        dependencies.add(paramSymbol);
      }
    }

    return dependencyGraph;
  }

  public linearizeProvidersForReturnType(
    providers: ProviderInterface[],
    returnType: ts.Type,
  ): ProviderInterface[] {
    const providerMap = new Map<ts.Symbol, ProviderInterface>();

    // populate providerMap with providers. This is just a map from the return
    // type symbol of the provider to the provider.
    for (const provider of providers) {
      const outputType = provider.outputType();
      const outputSymbol = this.canonicalSymbol(outputType);

      providerMap.set(outputSymbol, provider);
    }

    const dependencyGraph = this.buildDependencyGraph(providers);
    const returnSymbol = this.canonicalSymbol(returnType);

    const order = topologicalSort(returnSymbol, dependencyGraph);

    const linearizedProviders: ProviderInterface[] = [];
    const seen = new Set<ts.Symbol>();

    for (const sym of order) {
      if (seen.has(sym)) {
        continue;
      }
      seen.add(sym);

      const provider = providerMap.get(sym);
      if (!provider) {
        throw new Error(`cannot find provider: ${sym.getName()}`);
      }
      linearizedProviders.push(provider);
    }

    return linearizedProviders;
  }
}
