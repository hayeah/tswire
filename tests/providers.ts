import { tswire } from ".."

interface NotUsed {
  value: number
}

interface Foo {
  foo: string
}

interface Bar {
  bar: string

  foo: Foo
}

interface Baz {
  foo: Foo
  bar: Bar
}

export async function providePromiseFoo(): Promise<Foo> {
  return { foo: "foo" }
}

export function providerNotUsed(): NotUsed {
  return { value: 42 }
}

export function provideBar(foo: Foo): Bar {
  return { bar: "bar", foo }
}

export function provideFoo(): Foo {
  return { foo: "foo" }
}

export function provideBaz(foo: Foo, bar: Bar): Baz {
  return { foo, bar }
}

// not an initializer because it has no return type
function notInitFunction() {
  tswire([provideFoo, provideBar, provideBaz])
}

function initWithArrayValue(): Baz {
  tswire([provideBar, provideFoo, provideBaz, providerNotUsed])
  return null as any
}

export const providers = [provideFoo, provideBar, provideBaz]
function initWithReference(): Baz {
  tswire(providers)
  return null as any
}

import { moduleProviders, type ModuleFoo } from "./moduleProviders"
function initWithImportedProviders(): ModuleFoo {
  tswire(moduleProviders)
  return null as any
}

function initWithAsyncProviders(): Foo {
  tswire([providePromiseFoo])
  return null as any
}
