import { tswire } from "..";

interface Foo {
  foo: string;
}

interface Bar {
  bar: string;

  foo: Foo;
}

interface Baz {
  foo: Foo;
  bar: Bar;
  fooClass: FooClass;
}

export class FooClass {
  constructor(public baz: Bar) {}
}

export function provideBar(foo: Foo): Bar {
  return { bar: "bar", foo };
}

export function provideFoo(): Foo {
  return { foo: "foo" };
}

export function provideBaz(foo: Foo, bar: Bar, fooClass: FooClass): Baz {
  return { foo, bar, fooClass };
}

export function initBaz(): Baz {
  tswire([provideBar, provideFoo, provideBaz, FooClass]);
  return null as any;
}

export function initFoo(): Foo {
  tswire([provideFoo]);
  return null as any;
}

// not an initializer because it has no return type
// function notInitFunction() {
//   tswire([provideFoo, provideBar, provideBaz])
// }

// import { moduleProviders, type ModuleFoo } from "./moduleProviders"
// function initWithImportedProviders(): ModuleFoo {
//   tswire(moduleProviders)
//   return null as any
// }

// function tsobject<T>(arg: any): T {
//   return null as any
// }

// function initWithInterface(): Foo {
//   let bar: Bar = null as any
//   tswire([tsobject<Bar>("*")])
//   return null as any
// }
