import { expect, test } from "bun:test"
import { InjectionAnalyzer } from "./wire"
import * as path from "path"

const providersFilePath = path.join(__dirname, "tests/providers.ts")

test("Injection Analyzer - Initializer Detection and Return Type", () => {
  const analyzer = new InjectionAnalyzer(providersFilePath)
  const initializers = analyzer.findInitializers()

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
