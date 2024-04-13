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

  expect(initializersInfo).toEqual(expectedInitializers)
})

test("Resolvers - Collect & Linearize Providers", () => {
  const initializer = initializers[0]
  const resolver = new Resolver(initializer.providers, checker)

  const providers = resolver.collectProviders(initializer.providers)

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

test("Resolvers - Linearize Providers", () => {
  const initializer = initializers[0]
  const resolver = new Resolver(initializer.providers, checker)
  const providers = resolver.collectProviders(initializer.providers)

  const lproviders = resolver.linearizeProvidersForReturnType(
    providers,
    initializer.returnType
  )

  const resolvedProviderNames = lproviders.map(
    (provider) => provider.outputType().symbol.name
  )

  const expectedProviderNames = ["Foo", "Bar", "FooClass", "Baz"]
  expect(resolvedProviderNames).toEqual(expectedProviderNames)
})

test("Resolvers - Linearize Providers", () => {
  const initializer = initializers[0]
  const resolver = new Resolver(initializer.providers, checker)
  const providers = resolver.collectProviders(initializer.providers)

  const lproviders = resolver.linearizeProvidersForReturnType(
    providers,
    initializer.returnType
  )

  const initcode = resolver
    .generateInitFunction(lproviders, initializer.returnType)
    .trim()

  expect(initcode).toEqual(
    `
import { provideFoo } from "./di";
import { provideBar } from "./di";
import { provideBaz } from "./di";

export function init() {
  const foo = provideFoo();
  const bar = provideBar(foo);
  const baz = provideBaz(foo, bar);
  return baz;
}`.trim()
  )
})
