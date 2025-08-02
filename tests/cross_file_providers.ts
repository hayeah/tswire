import { tswire } from ".."
import { type Bar } from "./fixtures/types"
import { provideFoo } from "./fixtures/foo_provider"
import { provideBar } from "./fixtures/bar_provider"

export function init(): Bar {
  tswire([provideFoo, provideBar])
  return null as any
}