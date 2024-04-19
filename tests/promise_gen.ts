import { provideFoo } from "./promise";

export async function init() {
  const foo = await provideFoo();
  return foo;
}