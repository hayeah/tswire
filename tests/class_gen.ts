import { provideFoo } from "./class";
import { BarClass } from "./class";

export function init() {
  const foo = provideFoo();
  const barClass = new BarClass(foo);
  return barClass;
}