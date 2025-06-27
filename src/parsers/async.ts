/**
 * Legacy Async Parser Entry Point
 * 
 * This module serves as a compatibility layer for legacy async parser imports.
 * It re-exports the primary async parsing functionality from the generator module
 * to maintain backward compatibility while providing access to modern streaming
 * and batch processing capabilities.
 * 
 * @deprecated This file is maintained for compatibility. For new implementations,
 * import directly from './generator/async.ts' to access the full async API.
 * 
 * @module parsers/async
 * @version 1.0.0
 * 
 * @example Basic async parsing
 * ```typescript
 * import { createAsyncStreamParser } from '@combi-parse/parsers/async';
 * 
 * const parser = createAsyncStreamParser(jsonValue);
 * for await (const item of parser.parse(stream)) {
 *   console.log('Parsed:', item);
 * }
 * ```
 * 
 * @example Batch processing
 * ```typescript
 * import { batchParser } from '@combi-parse/parsers/async';
 * 
 * const batch = batchParser(numberParser, { batchSize: 100 });
 * const results = await batch.parse(largeNumberStream);
 * ```
 */

/**
 * Creates an async stream parser for processing data incrementally.
 * Re-exported from generator/async for compatibility.
 * 
 * @function createAsyncStreamParser
 * @see {@link module:parsers/generator/async~createAsyncStreamParser}
 */

/**
 * Creates a transform stream for parsing data in pipelines.
 * Re-exported from generator/async for compatibility.
 * 
 * @function transformStream
 * @see {@link module:parsers/generator/async~transformStream}
 */

/**
 * Creates an async generator-based parser for memory-efficient parsing.
 * Re-exported from generator/async for compatibility.
 * 
 * @function asyncGenParser
 * @see {@link module:parsers/generator/async~asyncGenParser}
 */

/**
 * Creates a batch parser for processing multiple items efficiently.
 * Re-exported from generator/async for compatibility.
 * 
 * @function batchParser
 * @see {@link module:parsers/generator/async~batchParser}
 */
export { createAsyncStreamParser, transformStream, asyncGenParser, batchParser } from './generator/async';
