import { provideFoo } from "./fixtures/foo_provider";
import { provideBar } from "./fixtures/bar_provider";

export function init() {
  const foo = provideFoo();
  const bar = provideBar(foo);
  return bar;
}