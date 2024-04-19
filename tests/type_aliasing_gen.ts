import { provideFoo } from "./type_aliasing";
import { provideBar } from "./type_aliasing";

export function init() {
  const number = provideFoo();
  const bar = provideBar(number);
  return bar;
}