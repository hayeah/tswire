import { provideFoo } from "./mixed";
import { provideBar } from "./mixed";
import { FooClass } from "./mixed";
import { provideBaz } from "./mixed";

export function init() {
  const foo = provideFoo();
  const bar = provideBar(foo);
  const fooClass = new FooClass(bar);
  const baz = provideBaz(foo, bar, fooClass);
  return baz;
}