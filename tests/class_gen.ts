import { provideFoo, BarClass } from "./class";

export function init() {
  const foo = provideFoo();
  const barClass = new BarClass(foo);
  return barClass;
}