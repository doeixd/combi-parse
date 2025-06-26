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