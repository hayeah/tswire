import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import * as path from "node:path";
import { initAnalyzer } from "./di_gen";
import type { Initializer } from "./Initializer";
import type { InjectionAnalyzer } from "./InjectionAnalyzer";
import type { ProviderInterface } from "./types";
import { relativeImportPath, typeName } from "./utils";

test("relativeImportPath", () => {
  const importPath = relativeImportPath(
    "tests/type_aliasing_gen.ts",
    "tests/type_aliasing.ts",
  );
  expect(importPath).toEqual("./type_aliasing");
});

describe("code generation", () => {
  const glob = new Bun.Glob("tests/*.ts");
  const testsDir = path.join(__dirname, "tests");

  // Collect all test files first
  const testFiles: string[] = [];
  const testFilePaths: string[] = [];
  for (const file of glob.scanSync({ cwd: __dirname })) {
    if (file.endsWith("_gen.ts") || file.startsWith("_")) {
      continue;
    }
    testFiles.push(file);
    testFilePaths.push(path.join(__dirname, file));
  }

  // Create single analyzer for all files
  const analyzer = initAnalyzer({ rootFiles: testFilePaths });

  // Run the actual tests
  for (const file of testFiles) {
    test(file, () => {
      const originalFilePath = path.join(__dirname, file);
      const generatedFilePath = originalFilePath.replace(".ts", "_gen.ts");

      const generatedCode = analyzer.codeFor(originalFilePath); // Get generated code for specific file
      const expectedCode = fs.readFileSync(generatedFilePath, "utf8"); // Read expected generated code

      expect(generatedCode).toEqual(expectedCode);
    });
  }
});

class TestContext {
  public analyzer: InjectionAnalyzer;
  constructor(file: string) {
    const rootFile = path.join(__dirname, file);
    this.analyzer = initAnalyzer({ rootFiles: [rootFile] });
  }
  get initializers(): Initializer[] {
    return this.analyzer.findInitializers();
  }

  get initializer(): Initializer {
    return this.initializers[0];
  }

  get providers(): ProviderInterface[] {
    return this.initializer.providers();
  }

  get linearizedProviders(): ProviderInterface[] {
    return this.initializer.linearizedProviders();
  }
}

describe("basic tests", () => {
  const context = new TestContext("tests/mixed.ts");

  test("Injection Analyzer - Initializer Detection and Return Type", () => {
    const { initializers } = context;
    const initializersInfo = initializers.map((init) => {
      return {
        name: init.name,
        returnType: typeName(init.returnType),
      };
    });

    const expectedInitializers = [
      { name: "initBaz", returnType: "Baz" },
      { name: "initFoo", returnType: "Foo" },
    ];

    expect(initializersInfo).toEqual(expectedInitializers);
  });

  // Test collection and linearization of providers
  test("Resolvers - Collect & Linearize Providers", () => {
    const { providers } = context;

    const resolvedProviderNames = providers
      .map((provider) => typeName(provider.outputType()))
      .sort();

    const expectedProviderNames = ["Bar", "Baz", "Foo", "FooClass"].sort();

    expect(resolvedProviderNames).toEqual(expectedProviderNames);
  });

  // // Test linearization of providers for a given return type
  test("Resolvers - Linearize Providers", () => {
    const { linearizedProviders } = context;

    const resolvedProviderNames = linearizedProviders.map((provider) =>
      typeName(provider.outputType()),
    );

    const expectedProviderNames = ["Foo", "Bar", "FooClass", "Baz"];
    expect(resolvedProviderNames).toEqual(expectedProviderNames);
  });
});
