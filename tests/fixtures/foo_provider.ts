import { type Foo } from "./types"

export function provideFoo(): Foo {
  return { foo: "foo" }
}