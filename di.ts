interface Foo {
  foo: string;
}

interface Bar {
  bar: string;

  foo: Foo;
}

interface Baz {
  foo: Foo;
  bar: Bar;
}

export function provideFoo(): Foo {
  return { foo: "foo" };
}

export function provideBar(foo: Foo): Bar {
  return { bar: "bar", foo };
}

export function provideBaz(foo: Foo, bar: Bar): Baz {
  return { foo, bar };
}

export const providers = [provideFoo, provideBar, provideBaz];

// Assume that wire is just a skeleton function that doesn't do anything, but to
// make the code compile, and to mark init functions for dependency injections.

function wire(providers: any[]) {
  return;
}

// The first statement of the function to use the special `wire` function to
// mark the function for dependency injection. The argument to the `wire`
// function are the providers that are used to resolve the dependencies.
function init(): Baz {
  wire(providers);
  return null as any;
}

// Then we want to sort the depencnies in the order, then construct the init
// function:

// function init(): Bar {
//   const foo = provideFoo();
//   const bar = provideBar(foo);
//   return bar;
// }
