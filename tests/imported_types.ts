import { tswire } from ".."
import { type Foo, type Bar } from "./fixtures/types"

export function provideFoo(): Foo {
  return { foo: "foo" }
}

export function provideBar(foo: Foo): Bar {
  return { bar: "bar", foo }
}

export function init(): Bar {
  tswire([provideFoo, provideBar])
  return null as any
}