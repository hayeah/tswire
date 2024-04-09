import * as ts from "typescript";
import { topologicalSort } from "./topsort";

import path from "path";

// Load your TypeScript file
const fileNames = ["di.ts"];
const program = ts.createProgram(fileNames, { allowJs: true });
const checker = program.getTypeChecker();

function kindOf(node: ts.Node): string {
  return ts.SyntaxKind[node.kind];
}

// isInjectionFunctionDeclaration checks that a function declaration has `wire` call.
function isInjectionFunctionDeclaration(
  node: ts.Node
): node is ts.FunctionDeclaration {
  if (!ts.isFunctionDeclaration(node)) {
    return false;
  }

  if (!node.body || node.body.statements.length === 0) {
    return false;
  }

  if (!node.name) {
    return false;
  }

  const functionName = node.name.text;

  const firstStatement = node.body.statements[0];

  if (
    ts.isExpressionStatement(firstStatement) &&
    ts.isCallExpression(firstStatement.expression) &&
    firstStatement.expression.expression.getText() === "wire"
  ) {
    processWireCallArguments(firstStatement.expression);
    return true;
  } else {
    return false;
  }
}

interface ProviderInfo {
  functionName: string;
  returnType: ts.Type;
  paramTypes: ts.Type[];
}

// `providerMap` is a mapping from provider function names to their respective information.
// The key is a string representing the name of the provider function.
// The value is an object of type `ProviderInfo`, which contains:
//   - `functionName`: The name of the provider function as a string.
//   - `returnType`: The TypeScript type object representing the return type of the provider function.
//   - `paramTypes`: An array of TypeScript type objects representing the types of parameters the provider function expects.
// This map is used to quickly access the metadata about each provider function by its name,
// including what it returns and what inputs it requires.
const providerMap: Map<string, ProviderInfo> = new Map();

// `dependencyGraph` is a mapping that represents the dependencies between types in the DI system.
// The key is a string representing the name of a type (the return type of a provider).
// The value is a Set of strings, where each string represents the name of a type that the key type depends on (parameter types of the provider).
// For example, if a provider function returns a type `A` and requires types `B` and `C` as inputs,
// the graph will have an entry with `A` as the key, and a set containing `B` and `C`.
// This graph is used to determine the order in which provider functions should be called to satisfy dependencies,
// ensuring that all inputs for a given provider are available before it is invoked.
const dependencyGraph: Map<string, Set<string>> = new Map();

// Extract provider information
function extractProviderInfo(node: ts.FunctionDeclaration): void {
  if (!node.name) return;
  const functionName = node.name.text;

  const signature = checker.getSignatureFromDeclaration(node);
  if (!signature) return;

  const returnType = checker.typeToString(signature.getReturnType());
  const paramTypes = signature.getParameters().map((param) => {
    const type = checker.getTypeAtLocation(param.valueDeclaration!);
    return checker.typeToString(type);
  });

  providerMap.set(returnType, {
    functionName,
    returnType: signature.getReturnType(),
    paramTypes: signature
      .getParameters()
      .map((param) => checker.getTypeAtLocation(param.valueDeclaration!)),
  });

  let dependencies = dependencyGraph.get(returnType);
  if (!dependencies) {
    dependencies = new Set();
    dependencyGraph.set(returnType, dependencies);
  }

  for (const paramType of paramTypes) {
    dependencies.add(paramType);
  }
}

const injectionFunctionDeclarations: ts.FunctionDeclaration[] = [];

function visit(node: ts.Node) {
  if (isInjectionFunctionDeclaration(node)) {
    injectionFunctionDeclarations.push(node);
  }
}

function generateInitFunction(
  providers: ProviderInfo[],
  targetType: string
): string {
  let functionBody = "";
  const variablesMap = new Map<string, string>(); // Maps return types to variable names

  // Iterate over providers to generate the function body
  providers.forEach((provider) => {
    const variableName = provider.returnType.symbol.name; // Simple variable naming strategy
    variablesMap.set(provider.returnType.symbol.name, variableName);

    const dependencyArgs = provider.paramTypes
      .map((dep) => variablesMap.get(dep.symbol.name))
      .join(", ");
    functionBody += `  const ${variableName} = ${provider.functionName}(${dependencyArgs});\n`;
  });

  // Assuming the last provider's return type is the target type
  functionBody += `  return ${variablesMap.get(targetType)};`;

  return `function init(): ${targetType} {\n${functionBody}\n}`;
}

function isArrayLiteral(node: ts.Node): node is ts.ArrayLiteralExpression {
  return node.kind === ts.SyntaxKind.ArrayLiteralExpression;
}

function isVariableDeclaration(node: ts.Node): node is ts.VariableDeclaration {
  return node.kind === ts.SyntaxKind.VariableDeclaration;
}

function isFunctionDeclaration(node: ts.Node): node is ts.FunctionDeclaration {
  return node.kind === ts.SyntaxKind.FunctionDeclaration;
}

function relativeImportPath(
  outputModuleFile: string,
  declarationFileName: string
): string {
  // const declarationFileName = declaration.getSourceFile().fileName;
  // Calculate the relative path from the declaration file to the outputModuleFile
  let importPath = path
    .relative(path.dirname(outputModuleFile), declarationFileName)
    // Remove the file extension
    .replace(/\.\w+$/, "")
    // Ensure import path format (replace \ with / for non-UNIX systems)
    .replace(/\\/g, "/");
  // If the path does not start with '.', add './' to make it a relative path
  if (!importPath.startsWith(".")) {
    importPath = "./" + importPath;
  }

  return importPath;
}

var providerDeclarations: ts.FunctionDeclaration[] = [];

// processWireCallArguments collects the available providers on the `wire`
// function call arguments.
function processWireCallArguments(node: ts.CallExpression): void {
  // Assuming the wire function call is always the first statement of the function
  // and its arguments are directly referencing provider functions.
  //
  // It should have the form:
  //
  // wire(providers);

  if (node.arguments.length != 1) {
    throw new Error("wire function should have exactly one argument");
  }

  const arg = node.arguments[0];

  if (!ts.isIdentifier(arg)) {
    throw new Error("wire function argument should be a variable name");
  }

  let s = checker.getSymbolAtLocation(arg);
  let d = s?.valueDeclaration;
  if (!s || !d) {
    throw new Error("unknown symbol found for wire function argument");
  }

  // Check that wire argument is of the form:
  // const providers = [ provideFoo, provideBar, provideBaz ];
  if (
    isVariableDeclaration(d) &&
    d.initializer &&
    isArrayLiteral(d.initializer)
  ) {
    for (let e of d.initializer.elements) {
      if (!ts.isIdentifier(e)) {
        throw new Error("provider should be a function declaration");
      }

      const declaration = checker.getSymbolAtLocation(e)?.valueDeclaration;

      if (declaration && isFunctionDeclaration(declaration)) {
        const isExported = declaration.modifiers?.some(
          (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
        );

        if (!isExported) {
          throw new Error("provider function must be exported");
        }

        providerDeclarations.push(declaration);
      }
    }
  }
}

// main
for (const sourceFile of program.getSourceFiles()) {
  if (sourceFile.fileName !== "di.ts") {
    continue;
  }

  // TODO: example code for generating import paths:

  // const outputModuleFile = "di_gen.ts";
  // const outputModuleFile2 = "out/di_gen.ts";

  // const declarationFileName = declaration.getSourceFile().fileName;

  // // Calculate the relative path from the declaration file to the outputModuleFile

  // console.log(
  //   `Import path for ${outputModuleFile}:`,
  //   relativeImportPath(outputModuleFile, declarationFileName)
  // );
  // console.log(
  //   `Import path for ${outputModuleFile2}:`,
  //   relativeImportPath(outputModuleFile2, declarationFileName)
  // );

  ts.forEachChild(sourceFile, visit);

  for (let provider of providerDeclarations) {
    extractProviderInfo(provider);
  }

  // use the first injection function as init
  const initDeclaration = injectionFunctionDeclarations[0];

  const deps = topologicalSort("Baz", dependencyGraph);

  const initFn = generateInitFunction(
    deps.map((dep) => providerMap.get(dep)!),
    "Baz"
  );

  // complete code here ...

  console.log(initFn);
}
