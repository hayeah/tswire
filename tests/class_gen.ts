import { provideFoo } from "./class";
import { BarClass } from "./class";

export function init() {
  const foo = provideFoo();
  const barclass = new BarClass(foo);
  return barclass;
}