/**
 * Stream Parsing Module
 * 
 * This module provides real-time stream parsing capabilities for processing
 * data as it arrives in chunks. Stream parsing is essential for handling
 * large datasets, network streams, file uploads, and real-time data feeds
 * without loading everything into memory at once.
 * 
 * Key features:
 * - Chunk-by-chunk processing
 * - Automatic buffer management
 * - Delimiter-aware parsing
 * - Memory-efficient operation
 * - Real-time result availability
 * - Partial input handling
 * 
 * Stream parsing is ideal for:
 * - Processing large CSV files
 * - Real-time log analysis
 * - Network protocol parsing
 * - JSON streaming APIs
 * - Live data feeds
 * - File upload processing
 * 
 * @module parsers/stream
 * @version 1.0.0
 * 
 * @example CSV file streaming
 * ```typescript
 * import { createStreamParser } from '@combi-parse/parsers/stream';
 * 
 * const csvParser = createStreamParser(csvRow, newline);
 * 
 * // Process file in chunks
 * const fileStream = fs.createReadStream('large-file.csv');
 * fileStream.on('data', chunk => {
 *   csvParser.feed(chunk.toString());
 *   console.log('Rows parsed so far:', csvParser.results.length);
 * });
 * 
 * fileStream.on('end', () => {
 *   const allRows = csvParser.end();
 *   console.log('Total rows:', allRows.length);
 * });
 * ```
 * 
 * @example Real-time JSON streaming
 * ```typescript
 * const jsonStream = createStreamParser(jsonObject, optional(str('\n')));
 * 
 * websocket.on('message', data => {
 *   jsonStream.feed(data);
 *   
 *   // Process each complete JSON object as it arrives
 *   jsonStream.results.forEach(obj => {
 *     processRealTimeData(obj);
 *   });
 * });
 * ```
 * 
 * @example Network protocol parsing
 * ```typescript
 * const messageParser = createStreamParser(
 *   protocolMessage,
 *   messageDelimiter
 * );
 * 
 * socket.on('data', chunk => {
 *   messageParser.feed(chunk.toString());
 *   
 *   // Handle each complete message
 *   messageParser.results.forEach(message => {
 *     handleProtocolMessage(message);
 *   });
 * });
 * ```
 */

import { Parser, whitespace } from "../parser";

/**
 * Interface for a streaming parser that processes input data incrementally.
 * Allows feeding data in chunks and extracting parsed results as they become available.
 * 
 * @template T The type of items being parsed from the stream
 * 
 * @interface StreamParser
 * 
 * @example Creating and using a stream parser
 * ```typescript
 * const numberStream: StreamParser<number> = createStreamParser(
 *   integer,
 *   optional(str(','))
 * );
 * 
 * numberStream.feed('1,2,3,');
 * console.log(numberStream.results); // [1, 2, 3]
 * 
 * numberStream.feed('4,5');
 * console.log(numberStream.results); // [1, 2, 3, 4, 5]
 * ```
 */
export interface StreamParser<T> {
  /**
   * Feeds a chunk of input data to the parser.
   * The parser will extract as many complete items as possible from the current buffer.
   * 
   * @param chunk String chunk to add to the parsing buffer
   * 
   * @example Feeding data chunks
   * ```typescript
   * const csvParser = createStreamParser(csvRow, newline);
   * 
   * csvParser.feed('name,age\n');
   * csvParser.feed('John,25\nJane,');
   * csvParser.feed('30\n');
   * 
   * console.log(csvParser.results);
   * // [['name', 'age'], ['John', '25'], ['Jane', '30']]
   * ```
   */
  feed(chunk: string): void;

  /**
   * Signals end of input and attempts to parse any remaining buffered data.
   * Should be called when no more input chunks will be provided.
   * 
   * @returns Array of all parsed items including any from the final buffer
   * 
   * @example Finalizing stream parsing
   * ```typescript
   * const parser = createStreamParser(jsonObject, optional(str('\n')));
   * 
   * parser.feed('{"a": 1}\n{"b": 2}\n{"c"');
   * parser.feed(': 3}'); // Incomplete at this point
   * 
   * const allResults = parser.end(); // Attempts to parse remaining buffer
   * console.log(allResults); // [{"a": 1}, {"b": 2}, {"c": 3}]
   * ```
   */
  end(): T[];

  /**
   * Array of items that have been successfully parsed so far.
   * Updated automatically as new chunks are fed to the parser.
   * 
   * @readonly
   * 
   * @example Monitoring parsing progress
   * ```typescript
   * const logParser = createStreamParser(logEntry, newline);
   * 
   * setInterval(() => {
   *   console.log(`Parsed ${logParser.results.length} log entries so far`);
   * }, 1000);
   * ```
   */
  readonly results: T[];
}

/**
 * Creates a streaming parser for processing data in real-time chunks.
 * The parser maintains an internal buffer and extracts complete items as they become available.
 * 
 * @template T The type of items to parse from the stream
 * @param itemParser Parser for individual items in the stream
 * @param delimiter Parser for delimiters between items (defaults to whitespace)
 * @returns A StreamParser instance for processing the input incrementally
 * 
 * @example JSON Lines streaming
 * ```typescript
 * const jsonLinesParser = createStreamParser(
 *   jsonObject,
 *   str('\n')
 * );
 * 
 * // Simulate streaming data
 * jsonLinesParser.feed('{"id": 1, "name": "Alice"}\n');
 * jsonLinesParser.feed('{"id": 2, "name": ');
 * jsonLinesParser.feed('"Bob"}\n{"id": 3');
 * jsonLinesParser.feed(', "name": "Charlie"}\n');
 * 
 * console.log(jsonLinesParser.results);
 * // [{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}, {"id": 3, "name": "Charlie"}]
 * ```
 * 
 * @example Custom delimiter parsing
 * ```typescript
 * const pipeDelimitedParser = createStreamParser(
 *   identifier,
 *   str('|')
 * );
 * 
 * pipeDelimitedParser.feed('apple|banana|cherry|');
 * console.log(pipeDelimitedParser.results); // ['apple', 'banana', 'cherry']
 * ```
 * 
 * @example XML tag streaming
 * ```typescript
 * const xmlTagParser = createStreamParser(
 *   genParser(function* () {
 *     yield str('<');
 *     const tagName = yield identifier;
 *     yield str('>');
 *     return tagName;
 *   }),
 *   optional(whitespace)
 * );
 * 
 * xmlTagParser.feed('<div> <span>  <p>');
 * console.log(xmlTagParser.results); // ['div', 'span', 'p']
 * ```
 * 
 * @example Performance monitoring
 * ```typescript
 * const monitoredParser = createStreamParser(complexItem, delimiter);
 * 
 * let totalBytes = 0;
 * const startTime = Date.now();
 * 
 * function feedChunk(chunk: string) {
 *   totalBytes += chunk.length;
 *   monitoredParser.feed(chunk);
 *   
 *   const elapsed = Date.now() - startTime;
 *   const throughput = totalBytes / elapsed * 1000; // bytes per second
 *   
 *   console.log(`Parsed ${monitoredParser.results.length} items, throughput: ${throughput.toFixed(2)} bytes/sec`);
 * }
 * ```
 */
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

/**
 * Example usage patterns for stream parsing.
 * 
 * @example Real-time log processing
 * ```typescript
 * import { createStreamParser } from '@combi-parse/parsers/stream';
 * import { genParser, str, regex, whitespace } from '@combi-parse/parser';
 * 
 * const logEntryParser = genParser(function* () {
 *   const timestamp = yield regex(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
 *   yield whitespace;
 *   const level = yield regex(/ERROR|WARN|INFO|DEBUG/);
 *   yield whitespace;
 *   const message = yield regex(/.+/);
 *   return { timestamp, level, message };
 * });
 * 
 * const logStream = createStreamParser(logEntryParser, str('\n'));
 * 
 * // Process log file as it's written
 * fs.watchFile('app.log', () => {
 *   const newContent = getNewLogContent();
 *   logStream.feed(newContent);
 *   
 *   // Process new log entries
 *   logStream.results.forEach(entry => {
 *     if (entry.level === 'ERROR') {
 *       alertingSystem.sendAlert(entry);
 *     }
 *   });
 * });
 * ```
 * 
 * @example WebSocket message streaming
 * ```typescript
 * const messageParser = createStreamParser(
 *   genParser(function* () {
 *     const length = yield integer;
 *     yield str(':');
 *     const content = yield takeString(length);
 *     return content;
 *   }),
 *   str('\n')
 * );
 * 
 * websocket.on('message', data => {
 *   messageParser.feed(data.toString());
 *   
 *   messageParser.results.forEach(message => {
 *     handleWebSocketMessage(message);
 *   });
 * });
 * ```
 */