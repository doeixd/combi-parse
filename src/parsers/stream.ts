export interface StreamParser<T> {
  feed(chunk: string): void;
  end(): T[];
  readonly results: T[];
}

export function createStreamParser<T>(
  itemParser: Parser<T>,
  delimiter: Parser<any> = whitespace
): StreamParser<T> {
  let buffer = '';
  let results: T[] = [];

  return {
    results,

    feed(chunk: string) {
      buffer += chunk;

      // Try to parse as many complete items as possible
      while (true) {
        try {
          const state = { input: buffer, index: 0 };
          const itemResult = itemParser.run(state);

          if (itemResult.type === 'success') {
            results.push(itemResult.value);

            // Skip delimiter if present
            const delimResult = delimiter.run(itemResult.state);
            const nextIndex = delimResult.type === 'success'
              ? delimResult.state.index
              : itemResult.state.index;

            buffer = buffer.slice(nextIndex);
          } else {
            break; // Wait for more input
          }
        } catch {
          break;
        }
      }
    },

    end() {
      if (buffer.trim()) {
        // Try to parse any remaining content
        const finalResult = itemParser.parse(buffer, { consumeAll: false });
        if (finalResult) results.push(finalResult);
      }
      return results;
    }
  };
}

// Usage:
const jsonStream = createStreamParser(jsonValue, optional(charClass(',\n')));
jsonStream.feed('{"a": 1}\n{"b"');
jsonStream.feed(': 2}\n');
jsonStream.end(); // Returns parsed JSON objects