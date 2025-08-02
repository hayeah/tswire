import { type Foo, type Bar } from "./types"

export function provideBar(foo: Foo): Bar {
  return { bar: "bar", foo }
}