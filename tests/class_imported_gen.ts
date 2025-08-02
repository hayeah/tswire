import { provideFoo } from "./class_imported";
import { BarClass } from "./fixtures/BarClass";

export function init() {
  const foo = provideFoo();
  const barClass = new BarClass(foo);
  return barClass;
}