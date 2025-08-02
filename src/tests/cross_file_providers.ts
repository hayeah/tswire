import { tswire } from "..";
import { provideBar } from "./fixtures/bar_provider";
import { provideFoo } from "./fixtures/foo_provider";
import type { Bar } from "./fixtures/types";

export function init(): Bar {
  tswire([provideFoo, provideBar]);
  return null as any;
}
