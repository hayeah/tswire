import { provideFoo } from "./type_aliasing";
import { provideBar } from "./type_aliasing";

export function init() {
  const foo = provideFoo();
  const bar = provideBar(foo);
  return bar;
}