import { describe, expect, test, beforeAll, beforeEach } from "bun:test"
import {
  Initializer,
  InjectionAnalyzer,
  relativeImportPath,
  typeName,
  type ProviderInterface,
} from "./wire"
import * as path from "path"

import fs from "fs"

function analyzerForFile(filePath: string): InjectionAnalyzer {
  const providersFilePath = path.join(__dirname, filePath)
  return new InjectionAnalyzer(providersFilePath)
}

test("relativeImportPath", () => {
  const importPath = relativeImportPath(
    "tests/type_aliasing_gen.ts",
    "tests/type_aliasing.ts",
  )
  expect(importPath).toEqual("./type_aliasing")
})

describe("code generation", () => {
  const glob = new Bun.Glob("./tests/*.ts")

  for (let file of glob.scanSync()) {
    if (file.endsWith("_gen.ts") || file.startsWith("_")) {
      continue
    }

    test(file, () => {
      const originalFilePath = file
      const generatedFilePath = file.replace(".ts", "_gen.ts")

      const analyzer = analyzerForFile(originalFilePath)
      const generatedCode = analyzer.code() // Get generated code from the analyzer
      const expectedCode = fs.readFileSync(generatedFilePath, "utf8") // Read expected generated code

      expect(generatedCode).toEqual(expectedCode)
    })
  }
})

class TestContext {
  public analyzer: InjectionAnalyzer
  constructor(file: string) {
    const rootFile = path.join(__dirname, file)
    this.analyzer = new InjectionAnalyzer(rootFile)
  }
  get initializers(): Initializer[] {
    return this.analyzer.findInitializers()
  }

  get initializer(): Initializer {
    return this.initializers[0]
  }

  get providers(): ProviderInterface[] {
    return this.initializer.providers()
  }

  get linearizedProviders(): ProviderInterface[] {
    return this.initializer.linearizedProviders()
  }
}

describe("basic tests", () => {
  const context = new TestContext("tests/mixed.ts")

  test("Injection Analyzer - Initializer Detection and Return Type", () => {
    const { initializers } = context
    const initializersInfo = initializers.map((init) => {
      return {
        name: init.name,
        returnType: typeName(init.returnType),
      }
    })

    const expectedInitializers = [
      { name: "initBaz", returnType: "Baz" },
      { name: "initFoo", returnType: "Foo" },
    ]

    expect(initializersInfo).toEqual(expectedInitializers)
  })

  // Test collection and linearization of providers
  test("Resolvers - Collect & Linearize Providers", () => {
    const { providers } = context

    const resolvedProviderNames = providers
      .map((provider) => typeName(provider.outputType()))
      .sort()

    const expectedProviderNames = ["Bar", "Baz", "Foo", "FooClass"].sort()

    expect(resolvedProviderNames).toEqual(expectedProviderNames)
  })

  // // Test linearization of providers for a given return type
  test("Resolvers - Linearize Providers", () => {
    const { linearizedProviders } = context

    const resolvedProviderNames = linearizedProviders.map((provider) =>
      typeName(provider.outputType()),
    )

    const expectedProviderNames = ["Foo", "Bar", "FooClass", "Baz"]
    expect(resolvedProviderNames).toEqual(expectedProviderNames)
  })
})
