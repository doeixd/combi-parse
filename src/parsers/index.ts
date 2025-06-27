/**
 * Specialized Parsers Module
 * 
 * This module provides a comprehensive collection of specialized parsing capabilities
 * for different use cases and environments. It includes parsers optimized for:
 * 
 * - **Binary Data**: Parsing structured binary formats, protocols, and file formats
 * - **Contextual Parsing**: Stateful parsing for indentation-sensitive languages
 * - **Incremental Parsing**: Editor-optimized parsing with change tracking
 * - **Secure Parsing**: Resource-limited parsing with DoS protection
 * - **Stream Parsing**: Real-time parsing of streaming data
 * - **Async Parsing**: Non-blocking parsing for large datasets
 * 
 * Each parser type is designed for specific performance characteristics and use cases,
 * allowing you to choose the most appropriate parser for your needs.
 * 
 * @module parsers
 * @version 1.0.0
 * 
 * @example Binary file parsing
 * ```typescript
 * import { Binary } from '@combi-parse/parsers';
 * 
 * const imageHeader = Binary.sequence([
 *   Binary.uint8,       // Format identifier
 *   Binary.uint16LE,    // Width
 *   Binary.uint16LE,    // Height
 *   Binary.uint8        // Color depth
 * ] as const);
 * ```
 * 
 * @example Contextual language parsing
 * ```typescript
 * import { ContextualParser, indented } from '@combi-parse/parsers';
 * 
 * const pythonBlock = genParser(function* () {
 *   yield str('def');
 *   yield whitespace;
 *   const name = yield identifier;
 *   yield str(':');
 *   const body = yield indented(many(statement));
 *   return { type: 'function', name, body };
 * });
 * ```
 * 
 * @example Secure parsing with limits
 * ```typescript
 * import { secureParser } from '@combi-parse/parsers';
 * 
 * const safeJsonParser = secureParser(jsonValue, {
 *   maxDepth: 50,
 *   maxParseTime: 1000,
 *   maxMemory: 1024 * 1024 // 1MB
 * });
 * ```
 * 
 * @example Stream processing
 * ```typescript
 * import { createStreamParser } from '@combi-parse/parsers';
 * 
 * const csvStream = createStreamParser(csvRow, newline);
 * csvStream.feed('name,age\n');
 * csvStream.feed('John,25\n');
 * const results = csvStream.end();
 * ```
 */

// Core parser exports
export * from './binary';
export * from './contextual';
export * from './generator';
export * from './incremental';
export * from './secure';
export * from './stream';

/**
 * Async stream parser for processing data incrementally.
 * Re-exported from generator/async for convenient access.
 * 
 * @function createAsyncStreamParser
 * @see {@link module:parsers/generator/async~createAsyncStreamParser}
 */

/**
 * Transform stream for parsing data in Node.js streams.
 * Re-exported from generator/async for convenient access.
 * 
 * @function transformStream
 * @see {@link module:parsers/generator/async~transformStream}
 */

/**
 * Async generator parser for memory-efficient processing.
 * Re-exported from generator/async for convenient access.
 * 
 * @function asyncGenParser
 * @see {@link module:parsers/generator/async~asyncGenParser}
 */

/**
 * Batch parser for processing multiple items efficiently.
 * Re-exported from generator/async for convenient access.
 * 
 * @function batchParser
 * @see {@link module:parsers/generator/async~batchParser}
 */

/**
 * Specialized JSON stream parser with built-in JSON handling.
 * Re-exported from generator/async for convenient access.
 * 
 * @function createJsonStreamParser
 * @see {@link module:parsers/generator/async~createJsonStreamParser}
 */
export {
  createAsyncStreamParser,
  transformStream,
  asyncGenParser,
  batchParser,
  createJsonStreamParser
} from './generator/async';
