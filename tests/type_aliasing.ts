import { tswire } from ".."

type Foo = number

interface Bar {
  foo: Foo
}

// type Bar = number

var foo: Foo = 10

export function provideFoo(): Foo {
  return foo
}

export function provideBar(foo: Foo): Bar {
  return { foo }
}

export class Class {
  constructor(public foo: Foo, public bar: Bar) {}
}

function init(): Class {
  tswire([Class, provideBar, provideFoo])
  return null as any
}
