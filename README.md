# TSWire - Compile-time Dependency Injection for TypeScript

(Proof of concept. WIP.)

Only [bun](https://bun.sh/) is supported.

# Overview

`tswire` is a tiny compile-time dependency–injection helper for TypeScript projects.
You annotate an **initializer** with a single call to the `tswire` marker function, list the **providers** that can build your object graph, and let the CLI emit strongly-typed factory code so you never have to write boilerplate wiring by hand.

* zero runtime footprint – all work happens at build time
* no decorators or reflect-metadata required
* supports plain functions, async functions, and classes as providers
* understands type-aliases and detects circular graphs
* names are generated in a readable, keyword-safe style

The guide below walks through every feature with self-contained examples you can paste straight into a project or run from this repository.

# Installation

```bash
# with bun
bun add -D tswire
```

# How tswire Works

* You export **provider functions** or **provider classes**.
* You write an **init** function that immediately calls `tswire([...providers])` and returns `null as any`.

  * The special call marks the function for analysis; nothing runs at runtime.
* The CLI reads your file, builds a dependency graph, performs a topological sort, and writes `<yourFile>_gen.ts` next to the source.
* The generated init function replaces the placeholder body with concrete provider calls in dependency order, preserving async boundaries and constructor arguments.

# Defining Providers

*Provider functions* return a concrete type and can declare any number of typed parameters:

```ts
export function provideDbConn(cfg: Config): DbConn {
  return new Db(connStringFrom(cfg))
}
```

*Async provider functions* are fully supported:

```ts
export async function provideUser(): Promise<User> {
  return fetch("/api/me").then(r => r.json())
}
```

*Provider classes* simply expose dependencies through their constructor:

```ts
export class Service {
  constructor(public db: DbConn, public logger: Logger) {}
}
```

# Defining Initializers

```ts
import { tswire } from "tswire"

function initApp(): Service {     // return type is required and non-void
  tswire([provideDbConn, provideLogger, Service])
  return null as any              // body is ignored by the generator
}
```

# Running the CLI

```bash
bun tswire ./src/app.ts
# → emits ./src/app_gen.ts
```

The CLI accepts multiple files and writes a sibling `*_gen.ts` file for each.

# Usage Examples

## Minimal graph

```ts
interface Foo { foo: string }
export function provideFoo(): Foo { return { foo: "ok" } }

function init(): Foo {
  tswire([provideFoo])
  return null as any
}
```

Generated code:

```ts
import { provideFoo } from "./minimal"

export function init() {
  const foo = provideFoo()
  return foo
}
```

## Multiple providers with sharing

```ts
interface Foo { foo: string }
interface Bar { foo: Foo; bar: string }

export function provideFoo(): Foo { … }
export function provideBar(foo: Foo): Bar { … }

function initBar(): Bar {
  tswire([provideFoo, provideBar])
  return null as any
}
```

Generated:

```ts
import { provideFoo, provideBar } from "./multi"

export function initBar() {
  const foo = provideFoo()
  const bar = provideBar(foo)
  return bar
}
```

## Async provider

```ts
export async function provideSession(): Promise<Session> { … }

function initSession(): Session {
  tswire([provideSession])
  return null as any
}
```

Generated:

```ts
import { provideSession } from "./async"

export async function initSession() {
  const session = await provideSession()
  return session
}
```

## Class provider

```ts
export class Controller {
  constructor(public repo: Repo) {}
}

function initController(): Controller {
  tswire([provideRepo, Controller])
  return null as any
}
```

Generated:

```ts
import { provideRepo, Controller } from "./ctrl"

export function initController() {
  const repo = provideRepo()
  const controller = new Controller(repo)
  return controller
}
```

## Type-aliasing and reserved words

```ts
type Foo = number
export class Class { constructor(public foo: Foo) {} }

function init(): Class {
  tswire([Class])
  return null as any
}
```

If a return type collides with a JS keyword, the generated variable is prefixed with `$`:

```ts
const $class = new Class(foo)
```

## Mixed graph (functions, classes, async)

See `tests/mixed.ts` for a full example combining every feature. The generator automatically:

* orders providers as `Foo → Bar → FooClass → Baz`
* awaits async calls
* instantiates classes with `new`

# Using Generated Initializers

* Import the generated function instead of the placeholder one.
* Generated code has no external runtime dependency on `tswire`.
* You can commit `*_gen.ts` files or add them to `.gitignore` and regenerate during build.

# Testing

The repo includes `bun:test` cases that assert:

* correct relative import paths
* full code-generation parity with hand-written `*_gen.ts` fixtures
* correct provider ordering and cycle detection (`topsort.test.ts`)

Run tests with:

```bash
bun test
```

# Advanced Topics

## Topological sort algorithm

`wire.ts` wraps `topsort.ts`, which runs depth-first search with temporary and permanent marks.
Complexity is $O(V + E)$ where $V$ is the number of provider types and $E$ is the number of dependency edges.

## Handling cycles

If `A` depends on `B` and `B` depends on `A`, a `Cycle detected` error is thrown at generation time instead of failing late at runtime.

## Escaping reserved words

`keywords` in `constants.ts` lists every ECMAScript reserved word.
If a provider outputs `class`, the generated variable becomes `$class` to keep emitted code valid.

## Custom output path

Call `analyzer.writeCode(customPath)` to control where the `_gen` file lands.

## Programmatic API

```ts
const analyzer = new InjectionAnalyzer("/abs/path/to/file.ts")
const code = analyzer.code()
fs.writeFileSync("out.ts", code)
```

# Troubleshooting and FAQ

*The CLI cannot find a provider*

* Ensure the provider is exported. Non-exported functions are ignored.

*Variable does not have an initializer*

* If you reference an array of providers via a `const`, it must be initialized inline.

*Intrinsic types not supported*

* Primitive return types like `number` or `string` are not injectable; wrap them in an interface.

*Need multiple init functions in one file*

* `tswire` supports any number of initializers per file; each gets its own generated function.
