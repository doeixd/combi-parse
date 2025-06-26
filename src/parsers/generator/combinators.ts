// Sequence multiple generators
export function genSequence<T extends readonly any[]>(
  ...generators: { [K in keyof T]: () => Generator<Parser<any>, T[K], any> }
): () => Generator<Parser<any>, T, any> {
  return function* () {
    const results = [] as unknown as T;
    for (let i = 0; i < generators.length; i++) {
      const gen = generators[i];
      const result = yield* gen();
      (results as any)[i] = result;
    }
    return results;
  };
}

// Choice between generators
export function genChoice<T>(
  ...generators: Array<() => Generator<Parser<any>, T, any>>
): () => Generator<Parser<any>, T, any> {
  return function* () {
    for (const gen of generators) {
      // Try each generator with backtracking
      const parser = genParser(gen);
      const result = yield parser.optional();
      if (result !== null) return result;
    }
    throw new Error("No generator succeeded");
  };
}

// Map over generator result
export function genMap<T, U>(
  gen: () => Generator<Parser<any>, T, any>,
  fn: (value: T) => U
): () => Generator<Parser<any>, U, any> {
  return function* () {
    const result = yield* gen();
    return fn(result);
  };
}