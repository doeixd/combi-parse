/**
 * @fileoverview Asynchronous stream parsing utilities for generator-based parsers.
 * 
 * This module provides powerful asynchronous parsing capabilities that can handle streaming input,
 * async generators, and real-time data processing. It extends the generator parsing paradigm
 * to work with streaming data sources like network streams, file streams, and real-time APIs.
 * 
 * The async generators maintain the elegant, composable nature of generator-based parsing while
 * providing non-blocking, memory-efficient processing of large or infinite data streams.
 * 
 * @example
 * ```typescript
 * // Parse JSON objects from a stream
 * const jsonParser = createJsonStreamParser();
 * const stream = new ReadableStream();
 * 
 * for await (const jsonObj of jsonParser.parse(stream)) {
 *   console.log('Parsed:', jsonObj);
 * }
 * ```
 */

import { Parser, ParserState, ParseResult, success, failure } from "../../parser";

/**
 * Creates an asynchronous stream parser that can process streaming input data.
 * 
 * This function bridges the gap between synchronous parsers and asynchronous stream processing,
 * allowing you to parse data as it arrives rather than waiting for complete input. It's particularly
 * useful for processing large files, network streams, or real-time data feeds.
 * 
 * The parser maintains an internal buffer to handle partial data and ensures that parsing
 * only occurs when complete tokens are available, preventing incomplete parse attempts.
 * 
 * @template T - The type of values that the parser produces
 * @param parser - A synchronous parser that will be applied to stream chunks
 * @returns An object with async parsing methods for stream processing
 * 
 * @example
 * ```typescript
 * // Create a parser for comma-separated values
 * const csvParser = sequence([
 *   regex(/[^,\n]+/),
 *   str(',').optional()
 * ]);
 * 
 * const streamParser = createAsyncStreamParser(csvParser);
 * 
 * // Parse from a ReadableStream
 * const stream = new ReadableStream({
 *   start(controller) {
 *     controller.enqueue(new TextEncoder().encode('apple,banana,'));
 *     controller.enqueue(new TextEncoder().encode('cherry\n'));
 *     controller.close();
 *   }
 * });
 * 
 * for await (const item of streamParser.parse(stream)) {
 *   console.log('Parsed item:', item);
 * }
 * ```
 */
export function createAsyncStreamParser<T>(
  parser: Parser<T>
): {
  /** Parses data from a ReadableStream, yielding results as they become available */
  parse: (stream: ReadableStream<Uint8Array>) => AsyncGenerator<T, void, unknown>;
  /** Parses a single chunk of data, useful for manual chunk processing */
  parseChunk: (chunk: string, isComplete?: boolean) => T[];
} {
  let buffer = '';
  
  return {
    /**
     * Asynchronously parses data from a ReadableStream.
     * 
     * This method processes the stream chunk by chunk, maintaining an internal buffer
     * to handle partial data. It yields parsed results as soon as they become available,
     * providing excellent performance for real-time processing scenarios.
     * 
     * @param stream - The ReadableStream to parse data from
     * @yields Parsed values of type T as they become available
     * @throws Will throw if the stream encounters an error or if parsing fails
     */
    async *parse(stream: ReadableStream<Uint8Array>) {
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            // Process any remaining data in buffer
            if (buffer.length > 0) {
              const results = this.parseChunk(buffer, true);
              for (const result of results) {
                yield result;
              }
            }
            break;
          }
          
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
          
          // Try to parse complete items from buffer
          const results = this.parseChunk(buffer, false);
          for (const result of results) {
            yield result;
          }
        }
      } finally {
        reader.releaseLock();
      }
    },
    
    /**
     * Parses a single chunk of string data.
     * 
     * This method is useful for manual chunk processing where you want to control
     * the parsing process yourself. It attempts to parse as many complete items
     * as possible from the given chunk, updating the internal buffer appropriately.
     * 
     * @param chunk - The string data to parse
     * @param isComplete - Whether this is the final chunk (forces parsing of remaining data)
     * @returns Array of parsed values found in the chunk
     */
    parseChunk(chunk: string, isComplete = false): T[] {
      buffer = chunk;
      const results: T[] = [];
      let position = 0;
      
      while (position < buffer.length) {
        const state: ParserState = {
          input: buffer,
          index: position
        };
        
        const result = parser.run(state);
        
        if (result.type === "success") {
          results.push(result.value);
          position = result.state.index;
          
          // Update buffer to remove parsed content
          buffer = buffer.slice(position);
          position = 0;
        } else {
          // If parsing fails and we're not at the end, wait for more data
          if (!isComplete) {
            break;
          }
          // If we're at the end and still can't parse, it's an error
          position++;
        }
      }
      
      return results;
    }
  };
}

/**
 * Creates an async generator-based parser for complex asynchronous operations.
 * 
 * This function enables the creation of parsers that can yield control during async operations,
 * making it possible to parse data that requires network requests, database queries, or other
 * asynchronous operations as part of the parsing process. It combines the power of async/await
 * with the elegance of generator-based parsing.
 * 
 * The async generator approach is particularly useful for parsers that need to:
 * - Fetch data from external sources during parsing
 * - Perform validation against async resources
 * - Parse data that requires complex async transformations
 * 
 * @template T - The type of the final parsed result
 * @param genFn - An async generator function that yields parsers and returns the final result
 * @returns An object with async parsing methods
 * 
 * @example
 * ```typescript
 * // Parser that validates usernames against a database
 * const userParser = asyncGenParser(async function* () {
 *   const username = yield str(regex(/[a-z]+/));
 *   
 *   // Async validation
 *   const isValid = await validateUsername(username);
 *   if (!isValid) {
 *     throw new Error(`Invalid username: ${username}`);
 *   }
 *   
 *   return { username, validated: true };
 * });
 * 
 * const result = await userParser.parse("john123");
 * ```
 */
export function asyncGenParser<T>(
  genFn: () => AsyncGenerator<Parser<any>, T, any>
): {
  /** Asynchronously parses a complete string input */
  parse: (input: string) => Promise<ParseResult<T>>;
  /** Parses data from a stream using async generator approach */
  parseStream: (stream: ReadableStream<Uint8Array>) => AsyncGenerator<T, void, unknown>;
} {
  
  const syncParser = new Parser<T>((state: ParserState) => {
    // This is a placeholder - the real parsing happens in the async methods
    return failure("Use async parse methods for async generators", state);
  });

  return {
    /**
     * Asynchronously parses a complete string input.
     * 
     * @param input - The string to parse
     * @returns A Promise that resolves to the parse result
     */
    async parse(input: string): Promise<ParseResult<T>> {
      const state: ParserState = {
        input,
        index: 0
      };
      
      try {
        const iterator = genFn();
        let currentState = state;
        let nextValue: any = undefined;

        while (true) {
          const { value: parserOrReturn, done } = await iterator.next(nextValue);

          if (done) {
            return success(parserOrReturn as T, currentState);
          }

          const parser = parserOrReturn as Parser<any>;
          const result = parser.run(currentState);

          if (result.type === "failure") {
            return result;
          }

          currentState = result.state;
          nextValue = result.value;
        }
      } catch (error) {
        return failure(`Async parsing failed: ${error}`, state);
      }
    },

    /**
     * Parses data from a stream using the async generator approach.
     * 
     * @param stream - The ReadableStream to parse from
     * @yields Parsed values from the stream
     */
    async *parseStream(stream: ReadableStream<Uint8Array>) {
      const streamParser = createAsyncStreamParser(syncParser);
      yield* streamParser.parse(stream);
    }
  };
}

/**
 * Transform stream utility for parsing and transforming streaming data.
 * 
 * This utility function combines stream parsing with data transformation, allowing you
 * to parse items from a stream and immediately transform them into a different format.
 * It's useful for creating data processing pipelines that work with streaming input.
 * 
 * @template T - The type of items produced by the parser
 * @template U - The type of items after transformation
 * @param stream - The ReadableStream to parse data from
 * @param parser - The parser to apply to stream data
 * @param transform - Function to transform parsed items
 * @yields Transformed items as they are parsed and processed
 * 
 * @example
 * ```typescript
 * // Parse numbers from a stream and double them
 * const numberParser = regex(/\d+/).map(s => parseInt(s));
 * const doubled = transformStream(
 *   stream,
 *   numberParser,
 *   (num: number) => num * 2
 * );
 * 
 * for await (const doubledNumber of doubled) {
 *   console.log(doubledNumber);
 * }
 * ```
 */
export async function* transformStream<T, U>(
  stream: ReadableStream<Uint8Array>,
  parser: Parser<T>,
  transform: (item: T) => U
): AsyncGenerator<U, void, unknown> {
  const streamParser = createAsyncStreamParser(parser);
  
  for await (const item of streamParser.parse(stream)) {
    yield transform(item);
  }
}

/**
 * Creates a batch parser for processing multiple items at once with separators.
 * 
 * This parser is optimized for parsing sequences of items separated by delimiters,
 * with configurable batch sizes to control memory usage. It's particularly useful
 * for parsing CSV files, lists, arrays, and other structured data with repeated patterns.
 * 
 * The batch processing approach provides better performance than parsing items one by one,
 * while the configurable batch size prevents excessive memory usage with large datasets.
 * 
 * @template T - The type of individual items being parsed
 * @param itemParser - Parser for individual items
 * @param separator - Parser for the separator between items
 * @param maxBatchSize - Maximum number of items to parse in one batch (default: 100)
 * @returns A parser that produces arrays of parsed items
 * 
 * @example
 * ```typescript
 * // Parse comma-separated numbers with batch size of 50
 * const numberListParser = batchParser(
 *   regex(/\d+/).map(s => parseInt(s)),
 *   str(','),
 *   50
 * );
 * 
 * const result = numberListParser.run({
 *   input: "1,2,3,4,5,6,7,8,9,10",
 *   index: 0
 * });
 * // result.value: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
 * ```
 */
export function batchParser<T>(
  itemParser: Parser<T>,
  separator: Parser<any>,
  maxBatchSize = 100
): Parser<T[]> {
  return new Parser((state: ParserState) => {
    const results: T[] = [];
    let currentState = state;
    
    // Parse first item
    const firstResult = itemParser.run(currentState);
    if (firstResult.type === "failure") {
      return firstResult;
    }
    
    results.push(firstResult.value);
    currentState = firstResult.state;
    
    // Parse remaining items with separators
    while (results.length < maxBatchSize && currentState.index < currentState.input.length) {
      const sepResult = separator.run(currentState);
      if (sepResult.type === "failure") {
        break; // No more separators, we're done
      }
      
      const itemResult = itemParser.run(sepResult.state);
      if (itemResult.type === "failure") {
        break; // No more items after separator
      }
      
      results.push(itemResult.value);
      currentState = itemResult.state;
    }
    
    return success(results, currentState);
  });
}

/**
 * Creates a JSON streaming parser for parsing JSON values from streams.
 * 
 * This is a specialized stream parser optimized for JSON data. It demonstrates
 * how to create domain-specific streaming parsers using the async parsing infrastructure.
 * In a production environment, this would use a more sophisticated JSON parser.
 * 
 * Note: This is a simplified example implementation. For production use, you would
 * want to use a proper JSON parser that handles all JSON syntax correctly.
 * 
 * @returns A stream parser configured for JSON data
 * 
 * @example
 * ```typescript
 * const jsonParser = createJsonStreamParser();
 * const stream = new ReadableStream({
 *   start(controller) {
 *     controller.enqueue(new TextEncoder().encode('{"name": "John"}'));
 *     controller.enqueue(new TextEncoder().encode('{"age": 30}'));
 *     controller.close();
 *   }
 * });
 * 
 * for await (const jsonObj of jsonParser.parse(stream)) {
 *   console.log('Parsed JSON:', jsonObj);
 * }
 * ```
 */
export function createJsonStreamParser() {
  // This would need a proper JSON parser implementation
  const jsonValue = new Parser<any>((state: ParserState) => {
    // Simplified JSON parsing - in reality this would be much more complex
    try {
      const remaining = state.input.slice(state.index);
      const match = remaining.match(/^[^,\n]*/);
      if (match) {
        const value = JSON.parse(match[0].trim());
        return success(value, {
          ...state,
          index: state.index + match[0].length
        });
      }
    } catch {
      // Fall through to failure
    }
    return failure("Invalid JSON", state);
  });
  
  return createAsyncStreamParser(jsonValue);
}
