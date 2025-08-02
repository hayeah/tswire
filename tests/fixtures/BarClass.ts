export interface Foo {
  foo: string
}

export class BarClass {
  constructor(public foo: Foo) {}
}