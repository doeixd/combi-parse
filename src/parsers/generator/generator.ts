// Type-safe generator parser with inferred yield types
type ParserGenerator<T> = Generator<Parser<any>, T, any>;

// Helper to extract parser types from a generator
type InferYield<G> = G extends Generator<Parser<infer U>, any, any> ? U : never;

// New implementation with better typing
export function genParser<T>(
  genFn: () => Generator<Parser<any>, T, any>
): Parser<T> {
  return new Parser(state => {
    const iterator = genFn();
    let currentState = state;
    let nextValue: any = undefined;

    // Track all yielded values for debugging
    const yieldHistory: Array<{ parser: string, value: any, state: ParserState }> = [];

    while (true) {
      const { value: parserOrReturn, done } = iterator.next(nextValue);

      if (done) {
        return success(parserOrReturn as T, currentState);
      }

      const parser = parserOrReturn as Parser<any>;
      const result = parser.run(currentState);

      if (result.type === "failure") {
        // Enhanced error with context
        const ctx = yieldHistory.map(h => `  - ${h.parser}: ${JSON.stringify(h.value)}`).join('\n');
        return failure(`Generator parser failed at step ${yieldHistory.length + 1}\n${ctx}\n${result.message}`, result.state);
      }

      yieldHistory.push({
        parser: parser.constructor.name || 'Parser',
        value: result.value,
        state: currentState
      });

      currentState = result.state;
      nextValue = result.value;
    }
  });
}

// Even better: typed generator with yield* support
export function* gen<T>(parser: Parser<T>): Generator<Parser<T>, T, T> {
  return yield parser;
}

// Usage with perfect type inference:
const kvParser = genParser(function* () {
  const key = yield* gen(identifier);  // key is typed as string
  yield* gen(str(':'));
  const value = yield* gen(number);     // value is typed as number

  return { [key]: value };  // Type-safe!
});


// Helper functions for common patterns
export const gen = {
  // Yield a parser and return its result
  *parse<T>(parser: Parser<T>): Generator<Parser<T>, T, T> {
    return yield parser;
  },

  // Try multiple parsers until one succeeds
  *tryParsers<T>(...parsers: Parser<T>[]): Generator<Parser<any>, T | null, any> {
    for (const parser of parsers) {
      const result = yield parser.optional();
      if (result !== null) return result;
    }
    return null;
  },

  // Conditional parsing
  *when<T>(
    condition: Parser<any>,
    thenParser: Parser<T>,
    elseParser?: Parser<T>
  ): Generator<Parser<any>, T | null, any> {
    const cond = yield condition.optional();
    if (cond !== null) {
      return yield thenParser;
    } else if (elseParser) {
      return yield elseParser;
    }
    return null;
  },

  // Loop constructs
  *while<T>(
    condition: Parser<any>,
    body: Parser<T>
  ): Generator<Parser<any>, T[], any> {
    const results: T[] = [];
    while (true) {
      const cond = yield condition.optional();
      if (cond === null) break;
      results.push(yield body);
    }
    return results;
  },

  // Parse until a delimiter
  *until<T>(
    parser: Parser<T>,
    delimiter: Parser<any>
  ): Generator<Parser<any>, T[], any> {
    const results: T[] = [];
    while (true) {
      const delim = yield lookahead(delimiter).optional();
      if (delim !== null) break;
      results.push(yield parser);
    }
    yield delimiter; // Consume the delimiter
    return results;
  }
};

// Example usage:
const configParser = genParser(function* () {
  const entries: Record<string, any> = {};

  // Parse until EOF
  while (true) {
    // Skip comments and whitespace
    yield* gen.while(
      choice([whitespace, sequence([str('#'), regex(/[^\n]*/)])]),
      succeed(null)
    );

    // Check if we're at EOF
    const done = yield eof.optional();
    if (done !== null) break;

    // Parse key
    const key = yield* gen.parse(identifier);
    yield* gen.parse(whitespace.optional());
    yield* gen.parse(str('='));
    yield* gen.parse(whitespace.optional());

    // Parse value based on what follows
    const value = yield* gen.tryParsers(
      number,
      between(str('"'), regex(/[^"]*/), str('"')),
      str('true').map(() => true),
      str('false').map(() => false)
    );

    entries[key] = value;
    yield* gen.parse(whitespace.optional());
  }

  return entries;
});


