# TSWire - Compile-time Dependency Injection for TypeScript

(Proof of concept. WIP.)

Only [bun](https://bun.sh/) is supported.

Existing Dependency Injection solutions for TypeScript like tsyringe, inversify, etc. are runtime solutions. They are based on `reflect-metadata`, which has a few usability issues.

- Interface Metadata does not exist at runtime, requiring manual registration.
- The decorator-based API makes it harder to implement DI for classes not under your control (i.e., from packaged dependencies).

TypeScript has all this information at compile-time, it seems silly to throw it away.

A compile-time code generator like [google/wire](https://github.com/google/wire) might offer a low-ceremony and type-safe solution.

## Quick Start

Suppose you have a TypeScript file example.ts; tswire can generate the initialization code by inspecting compile-time information.

```sh
# Generates the init function in example_gen.ts
bunx tswire example.ts
```

DI code is just normal TypeScript code:

```ts
// example.ts
interface Foo {
  foo: string
}

interface Bar {
  bar: string

  foo: Foo
}

interface Baz {
  foo: Foo
  bar: Bar
}

export function provideFoo(): Foo {
  return { foo: "foo" }
}

export function provideBar(foo: Foo): Bar {
  return { bar: "bar", foo }
}

export function provideBaz(foo: Foo, bar: Bar): Baz {
  return { foo, bar }
}

export const providers = [provideFoo, provideBar, provideBaz]

// The function's first statement uses the special `tswire` function to mark the
// function for dependency injection. The argument to the `tswire` function are
// the providers that are used to resolve the dependencies.
function init(): Baz {
  tswire(providers)
  return null as any
}
```

Like Wire, tswire detects the `init` stub function, and generates the full initialization code into a separate file (suffixed by `_gen.ts`):

```ts
// example_gen.ts
import { provideFoo } from "./di"
import { provideBar } from "./di"
import { provideBaz } from "./di"

export function init() {
  const foo = provideFoo()
  const bar = provideBar(foo)
  const baz = provideBaz(foo, bar)
  return baz
}
```

## TODO

- Support global variables/constants
- Support class constructors
