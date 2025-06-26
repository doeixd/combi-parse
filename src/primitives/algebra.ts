// Parser algebra operations
export const ParserAlgebra = {
  // Intersection: both parsers must succeed with same result
  intersect<T>(p1: Parser<T>, p2: Parser<T>): Parser<T> {
    return new Parser(state => {
      const r1 = p1.run(state);
      if (r1.type === 'failure') return r1;

      const r2 = p2.run(state);
      if (r2.type === 'failure') return r2;

      if (r1.value === r2.value && r1.state.index === r2.state.index) {
        return r1;
      }

      return failure('Parsers produced different results', state);
    });
  },

  // Difference: p1 succeeds but p2 fails
  difference<T, U>(p1: Parser<T>, p2: Parser<U>): Parser<T> {
    return new Parser(state => {
      const r2 = p2.run(state);
      if (r2.type === 'success') {
        return failure('Difference: second parser unexpectedly succeeded', state);
      }

      return p1.run(state);
    });
  },

  // Permutation: parse items in any order
  permutation<T extends readonly any[]>(
    parsers: [...{ [K in keyof T]: Parser<T[K]> }]
  ): Parser<T> {
    return new Parser(state => {
      const results = new Array(parsers.length);
      const used = new Array(parsers.length).fill(false);
      let currentState = state;

      for (let i = 0; i < parsers.length; i++) {
        let found = false;

        for (let j = 0; j < parsers.length; j++) {
          if (used[j]) continue;

          const result = parsers[j].run(currentState);
          if (result.type === 'success') {
            results[j] = result.value;
            used[j] = true;
            currentState = result.state;
            found = true;
            break;
          }
        }

        if (!found) {
          return failure('Permutation: could not match all parsers', state);
        }
      }

      return success(results as T, currentState);
    });
  },

  // Longest match: try all parsers, return longest success
  longest<T>(...parsers: Parser<T>[]): Parser<T> {
    return new Parser(state => {
      let bestResult: Success<T> | null = null;

      for (const parser of parsers) {
        const result = parser.run(state);
        if (result.type === 'success') {
          if (!bestResult || result.state.index > bestResult.state.index) {
            bestResult = result;
          }
        }
      }

      return bestResult || failure('No parser succeeded', state);
    });
  }
};

// Usage examples:
// Match identifier that's not a keyword
const identifier = ParserAlgebra.difference(
  regex(/[a-z]+/),
  choice([str('if'), str('while'), str('for')])
);

// Parse attributes in any order
const attributes = ParserAlgebra.permutation([
  attribute('class'),
  attribute('id'),
  attribute('style')
] as const);