import { tswire } from "."

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

export function provideFoo(): Foo {
  return { foo: "foo" }
}

export function provideBar(foo: Foo): Bar {
  return { bar: "bar", foo }
}

export function provideBaz(foo: Foo, bar: Bar): Baz {
  return { foo, bar }
}

// export const providers = [provideFoo, provideBar, provideBaz]

// The function's first statement uses the special `tswire` function to mark the
// function for dependency injection. The argument to the `tswire` function are
// the providers that are used to resolve the dependencies.
function init(): Baz {
  tswire([provideFoo, provideBar, provideBaz])
  return null as any
}

// Then we want to sort the depencnies in the order, then construct the init
// function:

// function init(): Bar {
//   const foo = provideFoo();
//   const bar = provideBar(foo);
//   return bar;
// }
