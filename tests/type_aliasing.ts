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

function init(): Bar {
  tswire([provideBar, provideFoo])
  return null as any
}

// function init(): Foo {
//   return duration
//   // return null as any
// }
