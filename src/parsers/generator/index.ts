/**
 * @fileoverview Main entry point for the generator-based parsing module.
 * 
 * This module provides a comprehensive generator-based parsing framework that offers
 * an elegant alternative to traditional combinator-heavy parsing approaches. The
 * generator paradigm allows you to write parsing logic using natural JavaScript
 * control flow while maintaining the power and composability of parser combinators.
 * 
 * Key Features:
 * - **Natural syntax**: Write parsing logic using familiar JavaScript constructs
 * - **Type safety**: Full TypeScript support with excellent type inference
 * - **Performance**: Optimized execution with lazy evaluation and minimal overhead
 * - **Debugging**: Enhanced error reporting with step-by-step execution context
 * - **Composability**: Mix and match generators with traditional combinators
 * - **Async support**: Built-in support for streaming and asynchronous parsing
 * 
 * The generator approach is particularly well-suited for:
 * - Complex language parsing with intricate grammar rules
 * - Data format parsing where readability is important
 * - Streaming and real-time parsing scenarios
 * - Situations requiring sophisticated error recovery
 * - Educational contexts where parsing logic should be self-documenting
 * 
 * @example
 * ```typescript
 * import { genParser, gen } from './generator';
 * 
 * // Parse a configuration file format
 * const configParser = genParser(function* () {
 *   const config = {};
 *   
 *   while (yield* gen.tryParsers(identifier)) {
 *     const key = yield identifier;
 *     yield str('=');
 *     const value = yield* gen.tryParsers(
 *       number,
 *       stringLiteral,
 *       str('true').map(() => true),
 *       str('false').map(() => false)
 *     );
 *     
 *     config[key] = value;
 *     yield whitespace.optional();
 *   }
 *   
 *   return config;
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // Parse JSON with generator-based approach
 * const jsonParser = genParser(function* () {
 *   yield whitespace.optional();
 *   
 *   const value = yield* gen.tryParsers(
 *     jsonObject,
 *     jsonArray,
 *     jsonString,
 *     jsonNumber,
 *     str('true').map(() => true),
 *     str('false').map(() => false),
 *     str('null').map(() => null)
 *   );
 *   
 *   yield whitespace.optional();
 *   return value;
 * });
 * ```
 */

// Core generator infrastructure
export * from './generator';

// Asynchronous parsing capabilities
export * from './async';

// Generator composition utilities
export * from './combinators';

// Control flow utilities (exported with alias to avoid naming conflicts)
export { gen as genControlFlow } from './control-flow';

// Self-documenting parser utilities
export * from './docts';

// Common parsing patterns
export * from './patterns';

// Stateful parsing utilities
export * from './state';

// Debug and development utilities
export * from './with-options';
