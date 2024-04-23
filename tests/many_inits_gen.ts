import { provideFoo } from "./many_inits";
import { provideBar } from "./many_inits";

export function initFoo() {
  const foo = provideFoo();
  return foo;
}

export function initBar() {
  const bar = provideBar();
  return bar;
}