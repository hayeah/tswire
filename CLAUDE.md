- Once you are satisfied with the code, commit it.
  - Run relevant tests before commiting.
    - When you work on a workspace package (e.g. `packages/core`), remember to cd into it to run tests.
    - `cd packages/core && pnpm run check`
  - Always run pre-commit to clean up before commit.
  - If I ask you to make changes, create a new commit for the amend after you are happy with the changes.
- If you are in a git work tree, YOU MUST not cd out of the work tree into the root repo, or other work trees.
  - The work trees are typically named `.forks/001`, `.forks/002`. DO NOT cd or make changes out of these by accident.

# Typescript Style Guide

- In general don't use `try ... catch`, let error bubble up, so it's easier for the dev to debug.
  - Use `try ... catch` for cleanup.

## Method Naming

- do not use `get` prefix to define a getter method. Use a noun.
  - BAD: getItems
  - Good: items

## Null Checks in Tests

- An assertion inside a branch may never execute if the branch condition is false, yet the test still reports success.

```ts
// BAD: assertion can be skipped
if (result !== null) {
  expect(result.value).toBe(42);
}
```


```ts
// GOOD: make the expectation unconditional
expect(result?.value).toBe(42);
```

## Typescript Class

- how you should write typescript class
  - Use `constructor(public foo: str, public bar number)` to declare and assign to instance properties
  - Prefer composition & injection into the constructor, rather than constructing complex classes inside the constructor
  - if a property requires async to initialize, create an async factory method on the class, then inject the awaited value into a normal constructor
    - this avoids an `init` instance method
  - Example code:

```
private readonly dbName: string;
  private readonly storeName: string;

  constructor(
    private readonly db: IDBDatabase,
    config: BlobStoreConfig,
  ) {
    this.dbName = config.dbName;
    this.storeName = config.storeName;
  }

  static async create(config: BlobStoreConfig): Promise<BlobStore> {
    const dbName = config.dbName;
    const storeName = config.storeName;
    const version = BlobStore.CURRENT_DB_VERSION;

    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      // ...
    });

    return new BlobStore(db, config);
  }
```

# File Naming Convention

- If a file primarily export a class or a component, name the file the same as the exported name.
  - For example `export BlobStore` should be named `BlobStore.ts`.
  - For example `export MyComponent` should be named `MyComponent.tsx`.
- test files (vitest) should be placed in the same directory as the source code.
  - tests for "src/BlobStore.ts" should be "src/BlobStore.test.ts"
- tests that should run in browser have the naming convention of: "src/BlobStore.test.browser.ts"

## Sharing Tests

For isomorphic JS code that need to work both in the browser and node/bun, we'd want to share tests between browser and jsdom:

  1. Create a .test.shared.ts file with a factory function that returns test suites
  2. The factory accepts environment-specific dependencies.
  3. Import and call the factory in both .test.ts (jsdom) and .test.browser.ts files

# Lint / Format

- If you worked on typescript, run `tsc` to type check and fix errors.
  - run in package root

# Commit Message

- you MUST NOT include this in

```
🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

# Done Notification

- After you are with a task (after lint, test, & commit), notify the user.
- Run `fork.py status`
  - project name
  - workspace number
  - one-line HEAD commit msg
    - you should report this as succinctly as possible.
    - 5~10 words. fewer the better.
- exec `say.py --voice shimmer "{project name} {workspace number} for review. {super concise commit msg}"`
  - This will play a voice msg to the user. It shouldn't be too long.

