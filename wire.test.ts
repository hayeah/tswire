import { expect, test, beforeAll } from "bun:test"
import { Initializer, InjectionAnalyzer } from "./wire"
import * as path from "path"

// Set the path to the file containing the providers
const providersFilePath = path.join(__dirname, "tests/providers.ts")
// Create an instance of the analyzer
const analyzer = new InjectionAnalyzer(providersFilePath)

// Initialize variables to be used before all tests
let initializers: Initializer[]
let initializer: Initializer

beforeAll(() => {
  // Find all initializers defined in the provided file
  initializers = analyzer.findInitializers()
  initializer = initializers[0]
})

// Test for correct detection of initializers and their return types
test("Injection Analyzer - Initializer Detection and Return Type", () => {
  const initializersInfo = initializers.map((init) => {
    return {
      name: init.name,
      returnType: analyzer.checker.typeToString(init.returnType),
    }
  })

  const expectedInitializers = [
    { name: "initWithArrayValue", returnType: "Baz" },
    { name: "initWithReference", returnType: "Baz" },
    { name: "initWithImportedProviders", returnType: "ModuleFoo" },
    { name: "initWithAsyncProviders", returnType: "Foo" },
  ]

  expect(initializersInfo).toEqual(expectedInitializers)
})

// Test collection and linearization of providers
test("Resolvers - Collect & Linearize Providers", () => {
  const initializer = initializers[0]
  const providers = initializer.providers()

  const resolvedProviderNames = providers
    .map((provider) => provider.outputType().symbol.name)
    .sort()

  const expectedProviderNames = [
    "Bar",
    "Baz",
    "Foo",
    "FooClass",
    "NotUsed",
  ].sort()

  expect(resolvedProviderNames).toEqual(expectedProviderNames)
})

// Test linearization of providers for a given return type
test("Resolvers - Linearize Providers", () => {
  const lproviders = initializer.linearizedProviders()

  const resolvedProviderNames = lproviders.map(
    (provider) => provider.outputType().symbol.name
  )

  const expectedProviderNames = ["Foo", "Bar", "FooClass", "Baz"]
  expect(resolvedProviderNames).toEqual(expectedProviderNames)
})

// Test generation of initialization code
test("Resolvers - Generate Initialization Code", () => {
  const initCode = initializer.initializationCode()

  const expectedCode = `
import { provideFoo } from "./tests/providers";
import { provideBar } from "./tests/providers";
import { FooClass } from "./tests/providers";
import { provideBaz } from "./tests/providers";

export async function init() {
  const foo = provideFoo();
  const bar = await provideBar(foo);
  const fooclass = new FooClass(bar);
  const baz = provideBaz(foo, bar, fooclass);
  return baz;
}`.trim()

  console.log(initCode)

  expect(initCode).toEqual(expectedCode)
})
