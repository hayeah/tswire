import { provideFoo, provideBar, Class } from "./type_aliasing";

export function init() {
  const foo = provideFoo();
  const bar = provideBar(foo);
  const $class = new Class(foo, bar);
  return $class;
}