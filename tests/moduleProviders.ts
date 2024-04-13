export interface ModuleFoo {
  foo: string
}

export function provideFoo(): ModuleFoo {
  return { foo: "foo" }
}

export const moduleProviders = [provideFoo]
