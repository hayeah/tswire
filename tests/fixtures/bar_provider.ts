import type { Bar, Foo } from "./types";

export function provideBar(foo: Foo): Bar {
  return { bar: "bar", foo };
}
