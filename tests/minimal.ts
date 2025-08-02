import { tswire } from "..";

interface Foo {
  foo: string;
}

export function provideFoo(): Foo {
  return { foo: "foo" };
}

function _init(): Foo {
  tswire([provideFoo]);
  return null as any;
}
