import { expect, test } from "bun:test"
import { InjectionAnalyzer, Resolver } from "./wire"
import * as path from "path"

const providersFilePath = path.join(__dirname, "tests/providers.ts")
const analyzer = new InjectionAnalyzer(providersFilePath)
const checker = analyzer.checker
const initializers = analyzer.findInitializers()

test("Injection Analyzer - Initializer Detection and Return Type", () => {
  const initializersInfo = initializers.map((init) => {
    const returnType = analyzer.checker.typeToString(init.returnType)

    return {
      name: init.name,
      returnType: returnType,
    }
  })

  const expectedInitializers = [
    { name: "initWithArrayValue", returnType: "Baz" },
    { name: "initWithReference", returnType: "Baz" },
    { name: "initWithImportedProviders", returnType: "ModuleFoo" },
    { name: "initWithAsyncProviders", returnType: "Foo" },
  ]

  // Assert that each initializer is detected correctly with the expected return type
  expect(initializersInfo).toEqual(expectedInitializers)
})

test("Resolvers - Collect Providers", () => {
  const initializer = initializers[0]

  const resolver = new Resolver(initializer.providers, checker)

  const providers = resolver.resolveProviders(initializer.providers)

  const resolvedProviderNames = providers.map((provider) => provider.name?.text)

  // Define expected provider names based on what you anticipate the initializer to include
  const expectedProviderNames = ["provideFoo", "provideBar", "provideBaz"]

  // Perform the test assertion to check if all providers are collected and resolved correctly
  expect(resolvedProviderNames).toEqual(expectedProviderNames)
})
