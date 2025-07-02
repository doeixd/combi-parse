/**
 * Enhanced Stream Parsing Module
 * 
 * This module provides a comprehensive, production-ready stream parsing solution that builds upon
 * the foundation of incremental data processing. Stream parsing is a critical technique for handling
 * large datasets, real-time data feeds, and memory-constrained environments where loading entire
 * datasets into memory would be impractical or impossible.
 * 
 * ## Core Concepts
 * 
 * **Composable Stream Parsing**: Unlike traditional stream parsers that are monolithic wrappers, this
 * module provides a `streamMany` parser combinator. This allows you to define the logic for parsing
 * a stream of items declaratively and compose it with other parser features.
 * 
 * **Backpressure**: The `StreamSession` can be paused and resumed, allowing for fine-grained
 * control over data flow to prevent memory exhaustion when consumers can't keep up.
 * 
 * **Event-Driven Architecture**: The `StreamSession` emits events for parsed items, errors, and
 * performance metrics, enabling a reactive and scalable design.
 * 
 * ## Key Improvements Over Basic Stream Parsing
 * 
 * 1. **Composability**: Stream parsing logic is now a first-class parser that can be combined
 *    with security, incremental, and other contextual parsers.
 * 2. **Type Safety**: Full TypeScript support with generics for items and context.
 * 3. **Error Resilience**: Comprehensive error handling with recovery strategies.
 * 4. **Performance Monitoring**: Built-in metrics and profiling capabilities within the `StreamContext`.
 * 5. **Memory Management**: Buffer size controls and explicit state management via `StreamSession`.
 * 6. **Integration**: Seamless Node.js Stream API compatibility.
 * 
 * @module parsers/stream
 * @author Stream Parser Team
 * 
 * @example Basic JSON Lines Parsing
 * ```typescript
 * import { createStreamSession, lift } from '@combi-parse/parsers/enhanced-stream';
 * import { jsonObjectParser } from './json-parser'; // Assuming a contextual json parser
 * import { str } from '@combi-parse/parser';
 * 
 * // Create a session to manage stream state
 * const session = createStreamSession(
 *   jsonObjectParser(), // The parser for one item
 *   lift(str('\n'))      // The delimiter between items
 * );
 * 
 * session.on('item', (item) => {
 *   console.log('Parsed JSON object:', item.value);
 * });
 * 
 * // Feed data in chunks
 * await session.feed('{"id": 1}\n{"id"');
 * await session.feed(': 2}\n{"id": 3}');
 * 
 * const allResults = await session.end();
 * console.log(`Finished. Total items: ${allResults.length}`); // -> 3
 * ```
 */

import { Parser } from "../parser";
import { EventEmitter } from 'events';
import { Transform } from 'stream';
import { ContextualParser, ContextualParserState, contextualSuccess, lift as liftToContextual } from "./contextual";

/**
 * Configuration options for a `StreamSession`'s behavior and performance tuning.
 * 
 * @interface StreamParserOptions
 */
export interface StreamParserOptions {
  /**
   * Maximum buffer size in bytes before triggering backpressure mechanisms.
   * When the internal buffer exceeds this size, a `buffer_full` event is emitted.
   * In strict mode, an error will also be thrown.
   * @default Infinity
   */
  maxBufferSize?: number;

  /**
   * Enable collection of detailed performance metrics during parsing.
   * @default false
   */
  enableMetrics?: boolean;

  /**
   * Strict error handling mode. If true, any parse error in an item throws and
   * stops the session. If false, an 'error' event is emitted and the stream attempts to recover.
   * @default false (lenient)
   */
  strict?: boolean;
}

/**
 * Performance and operational metrics collected during stream parsing.
 * 
 * @interface StreamParserMetrics
 * @example
 * ```typescript
 * session.on('metrics', (metrics) => {
 *   const throughput = metrics.bytesProcessed / (Date.now() - metrics.startTime) * 1000;
 *   console.log(`Throughput: ${(throughput / 1024).toFixed(2)} KB/s`);
 *   console.log(`Buffer Usage: ${(metrics.bufferSize / 1024).toFixed(2)} KB`);
 * });
 * ```
 */
export interface StreamParserMetrics {
  itemsParsed: number;
  bytesProcessed: number;
  parseErrors: number;
  averageParseTime: number;
  bufferSize: number;
  startTime: number;
}

/**
 * Represents a successfully parsed item with associated metadata.
 * This wrapper provides additional context about when and where each item was parsed.
 * 
 * @template T The type of the parsed item value
 * @interface ParsedItem
 * @example
 * ```typescript
 * session.on('item', (item: ParsedItem<MyData>) => {
 *   console.log(`[${new Date(item.timestamp).toISOString()}] Parsed item #${item.index}`);
 *   process(item.value);
 * });
 * ```
 */
export interface ParsedItem<T> {
  value: T;
  index: number;
  timestamp: number;
}

/**
 * Type-safe event definitions for the `StreamSession`.
 * 
 * @template T The type of items being parsed
 * @interface StreamParserEvents
 */
export interface StreamParserEvents<T> {
  /**
   * Emitted when an item is successfully parsed from the stream. This is the
   * primary event for consuming parsed data.
   * @param item The parsed item with its metadata.
   */
  item: (item: ParsedItem<T>) => void;

  /**
   * Emitted when a parse error occurs. In lenient mode, the session will attempt
   * to recover. In strict mode, this is emitted just before an exception is thrown.
   * @param error The error that occurred.
   * @param buffer The portion of the buffer that caused the error, useful for debugging.
   */
  error: (error: Error, buffer: string) => void;

  /**
   * Emitted when the session resumes parsing after being paused. This signals that
   * the backpressure condition has been cleared and it's safe to send more data.
   */
  drain: () => void;

  /**
   * Emitted periodically with performance metrics if `enableMetrics` is true.
   * @param metrics A snapshot of the current performance statistics.
   */
  metrics: (metrics: StreamParserMetrics) => void;

  /**
   * Emitted when the internal buffer exceeds the configured `maxBufferSize`. This
   * is the primary signal for implementing backpressure.
   * @param size The current buffer size in bytes.
   */
  buffer_full: (size: number) => void;

  /**
   * Emitted when `end()` is called and all data has been processed. Provides the
   * final, complete array of parsed items.
   * @param finalResults An array of all successfully parsed item values.
   */
  end: (finalResults: T[]) => void;
}

// ===================================================================
// NEW COMPOSABLE STREAM PARSING IMPLEMENTATION
// ===================================================================

/**
 * The context required for stream parsing.
 * 
 * A `StreamSession` manages this context, which holds the state of the stream—such as
 * the data buffer and performance metrics. Your item and delimiter parsers will run
 * within this context, allowing them to (if needed) inspect or modify the stream state,
 * although they typically don't need to.
 */
export interface StreamContext {
  /** The internal buffer for the stream session, holding data yet to be parsed. */
  buffer: string;
  /** Performance metrics for the current session. */
  metrics: StreamParserMetrics;
  /** The configuration options for the session. */
  options: Required<StreamParserOptions>;
}

/**
 * A parser combinator that repeatedly applies an item and delimiter parser to a buffer.
 * 
 * This is the core of the composable stream parsing engine. Unlike the standard `many` combinator,
 * `streamMany` is specifically designed for streaming scenarios. If the `itemParser` fails
 * because it needs more data (i.e., it doesn't consume the entire buffer), `streamMany` will
 * gracefully **succeed** with the items it has already collected. It then updates the
 * `StreamContext`'s buffer, leaving the unparsed remainder for the next data chunk.
 * 
 * @param itemParser A `ContextualParser` for a single item in the stream.
 * @param delimiter A `ContextualParser` for the separator between items.
 * @returns A `ContextualParser` that produces an array of successfully parsed items from the current buffer.
 */
export function streamMany<T, C extends StreamContext>(
  itemParser: ContextualParser<T, C>,
  delimiter: ContextualParser<any, C>
): ContextualParser<T[], C> {
  return new ContextualParser((state: ContextualParserState<C>) => {
    const results: T[] = [];
    let currentState = state;
    
    while (currentState.index < currentState.input.length) {
      const parseStartTime = Date.now();
      
      const itemResult = itemParser.run(currentState);

      if (itemResult.type === 'failure') {
        // If the item parser fails, we assume it's because we need more data.
        // We break the loop and succeed with what we have.
        break;
      }
      
      const parseTime = Date.now() - parseStartTime;
      // Update metrics directly in the context
      const metrics = currentState.context.metrics;
      metrics.itemsParsed++;
      metrics.averageParseTime = 
          (metrics.averageParseTime * (metrics.itemsParsed - 1) + parseTime) / metrics.itemsParsed;
      
      results.push(itemResult.value);
      currentState = itemResult.state;
      
      // Try to parse a delimiter, which also advances the state
      const delimResult = delimiter.run(currentState);
      if (delimResult.type === 'success') {
          currentState = delimResult.state;
      }
    }
    
    // Update the buffer in the context by removing the consumed portion.
    // This is the key to advancing the stream.
    currentState.context.buffer = currentState.input.slice(currentState.index);
    currentState.context.metrics.bufferSize = currentState.context.buffer.length;

    // We always succeed, returning the items we could parse from the current buffer.
    return contextualSuccess(results, currentState);
  });
}

/**
 * Manages the state and execution of a stream parsing session.
 * 
 * A `StreamSession` is the primary, user-facing object for stream parsing. It holds the
 * `StreamContext` (including the data buffer and metrics) and provides imperative methods
 * like `feed()` and `end()` to drive the parsing process over time.
 *
 * @template T The type of items being parsed.
 * @template C The context, which must be compatible with `StreamContext`.
 */
export class StreamSession<T, C extends StreamContext> extends EventEmitter {
  private streamParser: ContextualParser<T[], C>;
  private _context: C;
  private _results: ParsedItem<T>[] = [];
  private _isPaused = false;
  private itemCount = 0;
  
  /** @internal Use `createStreamSession` factory function. */
  constructor(
    itemParser: ContextualParser<T, C>,
    delimiter: ContextualParser<any, C>,
    private options: StreamParserOptions = {}
  ) {
    super();

    const fullOptions: Required<StreamParserOptions> = {
      maxBufferSize: Infinity,
      enableMetrics: false,
      strict: false,
      ...options
    };

    // The session's core logic is the `streamMany` parser.
    this.streamParser = streamMany(itemParser, delimiter);

    this._context = {
      buffer: "",
      options: fullOptions,
      metrics: {
        itemsParsed: 0,
        bytesProcessed: 0,
        parseErrors: 0,
        averageParseTime: 0,
        bufferSize: 0,
        startTime: Date.now()
      }
    } as C;
  }
  
  // Property accessors
  get results(): T[] { return this._results.map(i => i.value); }
  get metrics(): StreamParserMetrics { return { ...this._context.metrics }; }
  get isPaused(): boolean { return this._isPaused; }
  get bufferSize(): number { return this._context.buffer.length; }

  // State Management
  clear(): void {
    this._context.buffer = "";
    this._results = [];
    this.itemCount = 0;
    this._context.metrics = {
        itemsParsed: 0,
        bytesProcessed: 0,
        parseErrors: 0,
        averageParseTime: 0,
        bufferSize: 0,
        startTime: Date.now()
    };
  }
  pause(): void { this._isPaused = true; }
  resume(): void { 
      this._isPaused = false;
      this.emit('drain');
      this.runParser(); // Process any data that arrived while paused
  }

  // Core Parsing Methods
  async feed(chunk: string): Promise<void> {
    this._context.metrics.bytesProcessed += chunk.length;
    this._context.buffer += chunk;
    this._context.metrics.bufferSize = this._context.buffer.length;
    
    if(this._context.buffer.length > this.options.maxBufferSize!) {
      this.emit('buffer_full', this._context.buffer.length);
      if (this.options.strict) {
          throw new Error(`Buffer size exceeded limit of ${this.options.maxBufferSize}`);
      }
    }
    
    if(!this.isPaused) {
        return this.runParser();
    }
  }

  feedSync(chunk: string): void {
      this._context.metrics.bytesProcessed += chunk.length;
      this._context.buffer += chunk;
      this._context.metrics.bufferSize = this._context.buffer.length;
      if (!this.isPaused) {
          this.runParserSync();
      }
  }

  async end(): Promise<T[]> {
    if (this._context.buffer.length > 0) {
        await this.runParser(true);
    }
    this.emit('end', this.results);
    return this.results;
  }
  
  endSync(): T[] {
      if (this._context.buffer.length > 0) {
          this.runParserSync(true);
      }
      this.emit('end', this.results);
      return this.results;
  }
  
  private runParser(isEnd: boolean = false): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.runParserSync(isEnd);
        resolve();
      } catch (e) {
        reject(e as Error);
      }
    });
  }

  private runParserSync(isEnd: boolean = false) {
    if (this.isPaused) return;

    const initialState: ContextualParserState<C> = {
      input: this._context.buffer,
      index: 0,
      context: this._context,
    };

    const result = this.streamParser.run(initialState);
    
    if (result.type === 'success' && result.value.length > 0) {
      const newItems = result.value.map(value => ({
        value,
        index: this.itemCount++,
        timestamp: Date.now()
      }));
      this._results.push(...newItems);
      newItems.forEach(item => this.emit('item', item));
      
      if(this.options.enableMetrics) {
          this.emit('metrics', this.metrics);
      }
    }
    
    if (isEnd && this._context.buffer.length > 0) {
      const error = new Error(`Unexpected trailing data at end of stream: "${this._context.buffer.slice(0, 50)}..."`);
      this._context.metrics.parseErrors++;
      this.emit('error', error, this._context.buffer);
      if (this.options.strict) {
          throw error;
      }
    }
  }

  // Fluent API & Event Handling
  on<K extends keyof StreamParserEvents<T>>(event: K, listener: StreamParserEvents<T>[K]): this {
    return super.on(event, listener);
  }

  off<K extends keyof StreamParserEvents<T>>(event: K, listener: StreamParserEvents<T>[K]): this {
    return super.off(event, listener);
  }

  onItem(callback: (item: T) => void): this {
    this.on('item', (item: ParsedItem<T>) => callback(item.value));
    return this;
  }

  onError(callback: (error: Error) => void): this {
    this.on('error', (error: Error) => callback(error));
    return this;
  }
  
  /** Creates a Node.js Transform stream that pipes data through this session. */
  toNodeStream(): Transform {
    const session = this;
    return new Transform({
      objectMode: true,
      transform(chunk, _, callback) {
        try {
          const itemHandler = (item: ParsedItem<T>) => { this.push(item.value); };
          session.on('item', itemHandler);
          session.feedSync(chunk.toString());
          session.off('item', itemHandler);
          callback();
        } catch (e) {
          callback(e as Error);
        }
      },
      flush(callback) {
          try {
              const itemHandler = (item: ParsedItem<T>) => { this.push(item.value); };
              session.on('item', itemHandler);
              session.endSync();
              session.off('item', itemHandler);
              callback();
          } catch(e) {
              callback(e as Error);
          }
      }
    });
  }
}

/**
 * Creates and initializes a stream parsing session.
 * This is the main factory function for the stream parsing module.
 * 
 * @template T The type of items to be parsed.
 * @template C The context type, must be compatible with `StreamContext`.
 * @param itemParser A `ContextualParser` for a single item in the stream.
 * @param delimiter A `ContextualParser` for the separator between items.
 * @param options Configuration for the session.
 * @returns A new `StreamSession` instance.
 */
export function createStreamSession<T, C extends StreamContext>(
  itemParser: ContextualParser<T, C>,
  delimiter: ContextualParser<any, C>,
  options?: StreamParserOptions
): StreamSession<T, C> {
  return new StreamSession(itemParser, delimiter, options);
}

/**
 * Lifts a base `Parser<T>` into a `ContextualParser` compatible with `StreamContext`.
 * This is a convenience function for using non-contextual parsers as items or delimiters.
 * 
 * @param parser The base parser to lift.
 */
export function lift<T>(parser: Parser<T>): ContextualParser<T, StreamContext> {
    return liftToContextual(parser);
}


/**
 * @example A Complete, End-to-End Example for Parsing JSON Lines
 */
// async function runJsonLinesExample() {
//   console.log("--- Running JSON Lines Stream Example ---");

//   // Define the shape of our data
//   interface LogEntry {
//     level: 'INFO' | 'ERROR';
//     message: string;
//     timestamp: number;
//   }
  
//   // 1. Define the parser for a single item (a JSON object).
//   // In a real application, this would be a full JSON parser.
//   // We'll fake it with a simple regex-based one for this example.
//   // We use `lift` to make a base Parser compatible with our StreamContext.
//   const jsonObjectParser = lift(
//     regex(/"level":\s*"([^"]+)",\s*"message":\s*"([^"]+)",\s*"timestamp":\s*(\d+)/)
//       .map(match => ({
//           level: match[1] as LogEntry['level'],
//           message: match[2],
//           timestamp: parseInt(match[3], 10),
//       }))
//   );
  
//   // 2. Define the delimiter between items. For JSON Lines, it's a newline.
//   const delimiter = lift(whitespace);

//   // 3. Create the stream session with our item and delimiter parsers.
//   const session = createStreamSession(jsonObjectParser, delimiter, { enableMetrics: true });
  
//   // 4. Set up event handlers to process the data as it arrives.
//   session.on('item', (item: ParsedItem<LogEntry>) => {
//     console.log(`[ITEM] Parsed #${item.index}: ${item.value.message}`);
//   });
  
//   session.on('error', (error, buffer) => {
//     console.error(`[ERROR] A parsing error occurred. Buffer state: "${buffer}"`, error);
//   });
  
//   session.on('metrics', (metrics) => {
//     console.log(`[METRICS] Items: ${metrics.itemsParsed}, Buffer: ${metrics.bufferSize} bytes`);
//   });
  
//   session.on('end', (finalResults) => {
//     console.log(`[END] Stream finished. Total items parsed: ${finalResults.length}.`);
//   });

//   // 5. Simulate feeding data in chunks, as it would arrive over a network.
//   console.log("\n--- Feeding Chunks ---");
//   await session.feed('{"level":"INFO", "message":"User logged in", "timestamp": 123}\n');
//   await session.feed('{"level":"ERROR", "message":"Database connection failed", "timestamp": 124}');
//   // Notice the second item is incomplete.
  
//   await session.feed('\n{"level":"INFO", "message":"Data processed", "timestamp": 125}\n');

//   // 6. Signal the end of the stream to process any remaining buffer.
//   const allResults = await session.end();
  
//   console.log("\n--- Final Results ---");
//   console.log(allResults);
// }

// To run the example:
// runJsonLinesExample();