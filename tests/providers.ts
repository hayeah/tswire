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
  fooClass: FooClass
}

export async function providePromiseFoo(): Promise<Foo> {
  return { foo: "foo" }
}

export function provideNotUsed(): NotUsed {
  return { value: 42 }
}

export async function provideBar(foo: Foo): Promise<Bar> {
  return { bar: "bar", foo }
}

export function provideFoo(): Foo {
  return { foo: "foo" }
}

export function provideBaz(foo: Foo, bar: Bar, fooClass: FooClass): Baz {
  return { foo, bar, fooClass }
}

export class FooClass {
  constructor(public baz: Bar) {}
}

// not an initializer because it has no return type
function notInitFunction() {
  tswire([provideFoo, provideBar, provideBaz])
}

function initWithArrayValue(): Baz {
  tswire([provideBar, provideFoo, provideBaz, provideNotUsed, FooClass])
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

// function tsobject<T>(arg: any): T {
//   return null as any
// }

// function initWithInterface(): Foo {
//   let bar: Bar = null as any
//   tswire([tsobject<Bar>("*")])
//   return null as any
// }
