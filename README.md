# TSWire - Compile-time Dependency Injection for TypeScript

(Proof of concept. WIP.)

Only [bun](https://bun.sh/) is supported.

Existing Dependency Injection solutions for TypeScript like tsyringe, inversify, etc. are runtime solutions. They are based on `reflect-metadata`, which has a few usability issues.

- Interface metadata don't exist at runtime, so requires manual registration.
- Decorators based API makes it harder to do DI for classes that are not under your control (i.e. from packaged depenencies).

TypeScript has all this information at compile-time, it seems silly to throw it away.

A compile-time code generator like [google/wire](https://github.com/google/wire) might offer a low-ceremony solution, and type safe solution. (I really enjoyed using Wire for Go projects.)

## Quick Start

Suppose that you have a TypeScript file `example.ts`, tswire can generate the initialization code by inspecting the compile-time information.

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

// The first statement of the function to use the special `wire` function to
// mark the function for dependency injection. The argument to the `wire`
// function are the providers that are used to resolve the dependencies.
function init(): Baz {
  tswire(providers)
  return null as any
}
```

Like Wire, tswire generates the code for the `init` stub function, in a separate file (suffixed by `_gen.ts`):

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
