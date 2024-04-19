import { provideFoo } from "./mixed";
import { provideBar } from "./mixed";
import { FooClass } from "./mixed";
import { provideBaz } from "./mixed";

export function init() {
  const foo = provideFoo();
  const bar = provideBar(foo);
  const fooclass = new FooClass(bar);
  const baz = provideBaz(foo, bar, fooclass);
  return baz;
}