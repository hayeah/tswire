import { provideFoo } from "./minimal";

export function _init() {
  const foo = provideFoo();
  return foo;
}