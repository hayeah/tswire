import { tswire } from "..";

interface Foo {
  foo: string;
}

export async function provideFoo(): Promise<Foo> {
  return { foo: "foo" };
}

export function init(): Foo {
  tswire([provideFoo]);
  return null as any;
}
