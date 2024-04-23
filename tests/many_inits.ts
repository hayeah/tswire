import { tswire } from ".."

interface Foo {
  foo: string
}

export function provideFoo(): Foo {
  return { foo: "foo" }
}

interface Bar {
  bar: string
}

export function provideBar(): Bar {
  return { bar: "bar" }
}

function initFoo(): Foo {
  tswire([provideFoo])
  return null as any
}

function initBar(): Bar {
  tswire([provideBar])
  return null as any
}
