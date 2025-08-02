import * as ts from "typescript";
import { ClassProvider } from "./ClassProvider";
import { keywords } from "./constants";
import { FunctionProvider } from "./FunctionProvider";
import { InitArgProvider } from "./InitArgProvider";
import { Initializer } from "./Initializer";
import type { WireTypeChecker } from "./types";
import {
  findSourceFile,
  monkeyPatchTypeChecker,
  relativeImportPath,
  typeName,
  wireOutputPath,
} from "./utils";

const nonInjectableReturnTypes =
  ts.TypeFlags.Void |
  ts.TypeFlags.Any |
  ts.TypeFlags.Undefined |
  ts.TypeFlags.Never;

export class InjectionAnalyzer {
  public program: ts.Program;
  public checker: WireTypeChecker;

  constructor(public rootFile: string) {
    this.program = ts.createProgram([rootFile], { allowJs: true });
    this.checker = monkeyPatchTypeChecker(this.program.getTypeChecker());
  }

  public async writeCode(outputFile?: string) {
    if (!outputFile) {
      outputFile = wireOutputPath(this.rootFile);
    }
    await Bun.write(outputFile, this.code());
  }

  public findInitializers(): Initializer[] {
    const inits: Initializer[] = [];

    const checker = this.checker;
    const self = this;

    // checkAndReturnInitializer returns Initializer if a node is a function declaration with a `tswire` call.
    function checkAndReturnInitializer(node: ts.Node): Initializer | undefined {
      if (!ts.isFunctionDeclaration(node)) {
        return;
      }

      if (!node.body || node.body.statements.length === 0) {
        return;
      }

      if (!node.name) {
        return;
      }

      const signature = checker.getSignatureFromDeclaration(node);
      if (!signature) {
        return;
      }

      // check return type is not void...
      const rtype = signature.getReturnType();
      if (rtype.flags & nonInjectableReturnTypes) {
        return;
      }

      const firstStatement = node.body.statements[0];

      if (
        ts.isExpressionStatement(firstStatement) &&
        ts.isCallExpression(firstStatement.expression) &&
        firstStatement.expression.expression.getText() === "tswire" &&
        firstStatement.expression.arguments.length === 1
      ) {
        const providers = firstStatement.expression.arguments[0];
        return new Initializer(self.checker, node, providers);
      }
    }

    function visit(node: ts.Node) {
      const init = checkAndReturnInitializer(node);
      if (init) {
        inits.push(init);
      }
    }

    const sourceFile = this.program.getSourceFile(this.rootFile);
    if (!sourceFile) {
      throw new Error(`source file not found: ${this.rootFile}`);
    }

    ts.forEachChild(sourceFile, visit);

    return inits;
  }

  public code(): string {
    const inits = this.findInitializers();
    // Track both regular and type-only imports
    const importsMap: Map<
      string,
      { regular: Set<string>; typeOnly: Set<string> }
    > = new Map();
    const functions: string[] = [];

    // Collect all necessary imports and function bodies from initializers
    for (const init of inits) {
      const { functionBody } = this.generateInitFunction(init, importsMap);
      functions.push(functionBody);
    }

    // Generate the combined import statements
    const importStatements: string[] = [];
    for (const [path, { regular, typeOnly }] of importsMap) {
      if (regular.size > 0) {
        importStatements.push(
          `import { ${Array.from(regular).join(", ")} } from "${path}";`,
        );
      }
      if (typeOnly.size > 0) {
        importStatements.push(
          `import type { ${Array.from(typeOnly).join(", ")} } from "${path}";`,
        );
      }
    }
    const imports = importStatements.join("\n");

    // Combine all parts into one output
    return `${imports}\n\n${functions.join("\n\n")}`;
  }

  private generateInitFunction(
    init: Initializer,
    importStatements: Map<
      string,
      { regular: Set<string>; typeOnly: Set<string> }
    >,
  ): {
    functionBody: string;
  } {
    const providers = init.linearizedProviders();
    const typeToVariableNameMap = new Map<string, string>();
    const providerCalls = [];
    const usedNames = new Set<string>(); // Tracks used names to avoid collisions

    // Before iterating over providers, handle init parameters
    for (const param of init.declaration.parameters) {
      const paramName = param.name.getText();
      if (!param.type) {
        throw new Error("Parameter has no type annotation");
      }
      const paramType = this.checker.getTypeAtLocationWithAliasSymbol(
        param.type,
      );
      const paramTypeName = typeName(paramType);
      typeToVariableNameMap.set(paramTypeName, paramName);
      usedNames.add(paramName);

      // Check if we need to import the parameter type
      const typeSymbol = paramType.getSymbol();
      if (typeSymbol?.declarations && typeSymbol.declarations.length > 0) {
        const declaration = typeSymbol.declarations[0];
        const sourceFile = declaration.getSourceFile();

        // Only import if it's from the same file and is exported
        if (sourceFile.fileName === init.declaration.getSourceFile().fileName) {
          const isExported = (declaration as any).modifiers?.some(
            (modifier: ts.Modifier) =>
              modifier.kind === ts.SyntaxKind.ExportKeyword,
          );

          if (isExported) {
            const importPath = relativeImportPath(
              this.rootFile,
              sourceFile.fileName,
            );
            let importInfo = importStatements.get(importPath);
            if (!importInfo) {
              importInfo = {
                regular: new Set<string>(),
                typeOnly: new Set<string>(),
              };
              importStatements.set(importPath, importInfo);
            }
            // Parameter types should be imported as type-only
            importInfo.typeOnly.add(paramTypeName);
          }
        }
      }
    }

    for (const provider of providers) {
      const outputType = provider.outputType();
      const outputTypeName = typeName(outputType);

      // Skip processing for InitArgProvider since variable names are already set from parameters
      if (provider instanceof InitArgProvider) {
        continue;
      }

      const baseName = variableNameForType(outputType);
      let uniqueName = baseName;
      let counter = 1;
      while (usedNames.has(uniqueName)) {
        uniqueName = `${baseName}${counter}`;
        counter++;
      }
      usedNames.add(uniqueName);
      typeToVariableNameMap.set(outputTypeName, uniqueName);

      const providerTypeName = provider.exportName();
      const declarationFileName = findSourceFile(provider.node()).fileName;
      const importPath = relativeImportPath(this.rootFile, declarationFileName);
      let importInfo = importStatements.get(importPath);
      if (!importInfo) {
        importInfo = {
          regular: new Set<string>(),
          typeOnly: new Set<string>(),
        };
        importStatements.set(importPath, importInfo);
      }
      // Providers (functions and classes) are regular imports
      importInfo.regular.add(providerTypeName);

      // Construct the call to the provider function or class construction, including passing the required parameters.
      const params: string[] = provider.inputTypes().map((type) => {
        const paramType = typeName(type);
        if (!typeToVariableNameMap.has(paramType)) {
          throw new Error(`No provider found for type ${paramType}`);
        }
        const name = typeToVariableNameMap.get(paramType);
        if (!name) {
          throw new Error(`No variable name found for type ${paramType}`);
        }
        return name;
      });

      if (provider instanceof FunctionProvider) {
        const call = provider.isAsync
          ? `  const ${uniqueName} = await ${providerTypeName}(${params.join(
              ", ",
            )});`
          : `  const ${uniqueName} = ${providerTypeName}(${params.join(", ")});`;
        providerCalls.push(call);
      } else if (provider instanceof ClassProvider) {
        providerCalls.push(
          `  const ${uniqueName} = new ${providerTypeName}(${params.join(
            ", ",
          )});`,
        );
      }
    }

    const targetTypeName = init.returnType.getSymbol()?.getName() || "";
    const returnVariableName = typeToVariableNameMap.get(targetTypeName) || "";
    const asyncKeyword = providers.some(
      (provider) => provider instanceof FunctionProvider && provider.isAsync,
    )
      ? "async "
      : "";

    // Emit function header with original parameter list
    const paramsString = init.declaration.parameters
      .map((p) => p.getText())
      .join(", ");
    const functionBody = `export ${asyncKeyword}function ${init.name}(${paramsString}) {\n${providerCalls.join("\n")}\n  return ${returnVariableName};\n}`;

    return { functionBody };
  }
}

function variableNameForType(type: ts.Type): string {
  // if a keyword, prefix it with "$"
  return escapeKeyword(lowerFirstChar(typeName(type)));
}

function escapeKeyword(name: string): string {
  // Check if the name is a keyword and prefix it with '$' if it is
  if (keywords.has(name)) {
    return `$${name}`;
  }

  return name;
}

function lowerFirstChar(str: string): string {
  if (str.length === 0) return str; // Check if the string is empty
  return str.charAt(0).toLowerCase() + str.slice(1);
}
