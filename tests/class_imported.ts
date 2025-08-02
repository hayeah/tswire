import { tswire } from "..";
import { BarClass, type Foo } from "./fixtures/BarClass";

export function provideFoo(): Foo {
  return { foo: "foo" };
}

export function init(): BarClass {
  tswire([provideFoo, BarClass]);
  return null as any;
}
