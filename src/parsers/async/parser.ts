// Stream parser that handles chunks and backpressure
export interface StreamParserOptions {
  highWaterMark?: number;  // Buffer size before backpressure
  delimiter?: Parser<any>; // Optional delimiter between items
}

export function createAsyncStreamParser<T>(
  itemParser: Parser<T>,
  options: StreamParserOptions = {}
): AsyncGenerator<T, void, void> {
  return async function* () {
    const buffer = new TextBuffer(options.highWaterMark || 1024 * 64);
    let parseState = { input: '', index: 0 };

    // Parse items from buffer
    async function* parseFromBuffer(): AsyncGenerator<T> {
      while (buffer.length > 0) {
        const chunk = buffer.read();
        parseState = { input: parseState.input + chunk, index: 0 };

        while (true) {
          try {
            const result = itemParser.run(parseState);
            if (result.type === 'success') {
              yield result.value;

              // Skip delimiter if present
              if (options.delimiter) {
                const delimResult = options.delimiter.run(result.state);
                parseState = delimResult.type === 'success'
                  ? delimResult.state
                  : result.state;
              } else {
                parseState = result.state;
              }

              // Remove consumed input
              parseState = {
                input: parseState.input.slice(parseState.index),
                index: 0
              };
            } else {
              // Need more input
              break;
            }
          } catch {
            break;
          }
        }
      }
    }

    yield* parseFromBuffer();
  }();
}

// Advanced: Transform stream with parser
export async function* transformStream<T, U>(
  source: ReadableStream<Uint8Array>,
  parser: Parser<T>,
  transform: (value: T) => U
): AsyncGenerator<U> {
  const reader = source.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        // Parse any remaining content
        if (buffer.trim()) {
          const result = parser.parse(buffer, { consumeAll: false });
          yield transform(result);
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      // Try to parse complete items
      let state = { input: buffer, index: 0 };
      while (state.index < buffer.length) {
        try {
          const result = parser.run(state);
          if (result.type === 'success') {
            yield transform(result.value);
            state = result.state;
          } else {
            break;
          }
        } catch {
          break;
        }
      }

      // Keep unparsed content
      buffer = buffer.slice(state.index);
    }
  } finally {
    reader.releaseLock();
  }
}

// Usage: Parse JSON stream
const jsonStream = transformStream(
  response.body!,
  jsonValue.keepLeft(optional(whitespace)),
  json => ({ ...json, timestamp: Date.now() })
);

for await (const item of jsonStream) {
  console.log('Parsed:', item);
}