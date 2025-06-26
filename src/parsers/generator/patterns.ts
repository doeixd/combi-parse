// Define reusable generator patterns
export const genPatterns = {
  // Parse a list with separators
  *list<T>(
    itemGen: () => Generator<Parser<any>, T, any>,
    separator: Parser<any>
  ): Generator<Parser<any>, T[], any> {
    const items: T[] = [];

    // First item
    const first = yield genParser(itemGen).optional();
    if (first === null) return items;
    items.push(first);

    // Rest of items
    while (true) {
      const sep = yield separator.optional();
      if (sep === null) break;

      const item = yield* itemGen();
      items.push(item);
    }

    return items;
  },

  // Parse a block with braces
  *block<T>(
    contentGen: () => Generator<Parser<any>, T, any>
  ): Generator<Parser<any>, T, any> {
    yield str('{');
    yield whitespace.optional();
    const content = yield* contentGen();
    yield whitespace.optional();
    yield str('}');
    return content;
  },

  // Parse with error recovery
  *withRecovery<T>(
    mainGen: () => Generator<Parser<any>, T, any>,
    recovery: Parser<any>,
    fallback: T
  ): Generator<Parser<any>, T, any> {
    const main = genParser(mainGen);
    const result = yield main.optional();

    if (result !== null) return result;

    // Try to recover
    yield recovery;
    return fallback;
  }
};

// Usage:
const arrayParser = genParser(function* () {
  yield str('[');
  yield whitespace.optional();

  const items = yield* genPatterns.list(
    function* () {
      return yield* gen.parse(number);
    },
    sequence([whitespace.optional(), str(','), whitespace.optional()])
  );

  yield whitespace.optional();
  yield str(']');

  return items;
});