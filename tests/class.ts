import { tswire } from ".."

interface Foo {
  foo: string
}

export function provideFoo(): Foo {
  return { foo: "foo" }
}

export class BarClass {
  constructor(public foo: Foo) {}
}

export function init(): BarClass {
  tswire([provideFoo, BarClass])
  return null as any
}
