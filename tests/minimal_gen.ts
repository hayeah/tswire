import { provideFoo } from "./minimal";

export function init() {
  const foo = provideFoo();
  return foo;
}