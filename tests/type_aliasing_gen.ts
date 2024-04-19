import { provideFoo } from "./tests/type_aliasing";
import { provideBar } from "./tests/type_aliasing";

export function init() {
  const number = provideFoo();
  const bar = provideBar(number);
  return bar;
}