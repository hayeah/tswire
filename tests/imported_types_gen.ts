import { provideFoo, provideBar } from "./imported_types";

export function init() {
  const foo = provideFoo();
  const bar = provideBar(foo);
  return bar;
}