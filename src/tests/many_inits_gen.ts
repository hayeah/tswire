import { provideFoo, provideBar } from "./many_inits";

export function _initFoo() {
  const foo = provideFoo();
  return foo;
}

export function _initBar() {
  const bar = provideBar();
  return bar;
}