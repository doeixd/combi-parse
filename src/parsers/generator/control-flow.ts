/**
 * @fileoverview Control flow utilities for generator-based parsing.
 * 
 * This module provides control flow primitives that make generator-based parsing
 * feel natural and expressive. It includes utilities for conditional parsing,
 * loops, error handling, and common parsing patterns that would otherwise
 * require complex combinator chains.
 * 
 * The control flow utilities leverage JavaScript's native control structures
 * within generators, making parsing logic more readable and maintainable than
 * traditional combinator-heavy approaches. They provide:
 * 
 * - Conditional parsing with if/else logic
 * - Looping constructs for repetitive patterns
 * - Error recovery and alternative parsing paths
 * - Delimiter-based parsing utilities
 * 
 * These utilities are designed to feel like natural JavaScript control flow
 * while maintaining the power and composability of parser combinators.
 * 
 * @example
 * ```typescript
 * // Natural control flow in parsing
 * const configParser = genParser(function* () {
 *   const entries = {};
 *   
 *   while (yield* gen.tryParsers(identifier)) {
 *     const key = yield* gen.parse(identifier);
 *     yield* gen.parse(str('='));
 *     const value = yield* gen.parse(str('value'));
 *     entries[key] = value;
 *   }
 *   
 *   return entries;
 * });
 * ```
 */

import { Parser } from "../../parser";

/**
 * Collection of generator-based control flow utilities.
 * 
 * This object provides a comprehensive set of control flow primitives
 * that work seamlessly within generator functions. Each utility is
 * designed to integrate naturally with generator syntax while providing
 * powerful parsing capabilities.
 */
export const gen = {
  /**
   * Yields a parser and returns its result.
   * 
   * This is the fundamental building block for generator-based parsing.
   * It provides a clean, readable way to parse individual elements
   * while maintaining the generator context.
   * 
   * @template T - The type of value produced by the parser
   * @param parser - The parser to execute
   * @yields The parser to be executed by the generator framework
   * @returns The parsed value
   * 
   * @example
   * ```typescript
   * const nameParser = genParser(function* () {
   *   const firstName = yield* gen.parse(identifier);
   *   yield* gen.parse(whitespace);
   *   const lastName = yield* gen.parse(identifier);
   *   return { firstName, lastName };
   * });
   * ```
   */
  *parse<T>(parser: Parser<T>): Generator<Parser<T>, T, T> {
    return yield parser;
  },

  /**
   * Tries multiple parsers until one succeeds, returning the first success or null.
   * 
   * This utility provides a clean way to attempt multiple parsing strategies
   * without throwing errors on failure. It's essential for implementing
   * choice-based parsing where you want to gracefully handle alternatives.
   * 
   * The function uses optional parsing to avoid consuming input on failure,
   * making it safe for backtracking scenarios.
   * 
   * @template T - The common result type of all parsers
   * @param parsers - Array of parsers to try in order
   * @yields Each parser wrapped in optional() for safe trying
   * @returns The first successful result, or null if all fail
   * 
   * @example
   * ```typescript
   * const valueParser = genParser(function* () {
   *   const value = yield* gen.tryParsers(
   *     numberLiteral,
   *     stringLiteral,
   *     booleanLiteral
   *   );
   *   
   *   if (value === null) {
   *     throw new Error("Expected a value");
   *   }
   *   
   *   return value;
   * });
   * ```
   */
  *tryParsers<T>(...parsers: Parser<T>[]): Generator<Parser<any>, T | null, any> {
    for (const parser of parsers) {
      const result = yield parser.optional();
      if (result !== null) return result;
    }
    return null;
  },

  /**
   * Conditional parsing based on a condition parser.
   * 
   * This utility enables if/else logic within generator parsers, allowing
   * you to branch parsing logic based on what's found in the input.
   * It's particularly useful for parsing languages with optional syntax
   * or context-dependent rules.
   * 
   * @template T - The result type of the conditional parsers
   * @param condition - Parser that determines which branch to take
   * @param thenParser - Parser to use if condition succeeds
   * @param elseParser - Optional parser to use if condition fails
   * @yields The condition parser and the selected branch parser
   * @returns Result of the selected parser, or null if no branch applies
   * 
   * @example
   * ```typescript
   * const optionalTypeParser = genParser(function* () {
   *   const result = yield* gen.when(
   *     str(':'),
   *     typeExpression,
   *     str('any').map(() => 'any')
   *   );
   *   
   *   return result ?? 'inferred';
   * });
   * ```
   * 
   * @example
   * ```typescript
   * // Parse optional semicolon at end of statement
   * const statementParser = genParser(function* () {
   *   const stmt = yield* gen.parse(expression);
   *   yield* gen.when(str(';'), succeed(null));
   *   return stmt;
   * });
   * ```
   */
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

  /**
   * Loops while a condition parser succeeds, collecting results.
   * 
   * This utility provides while-loop semantics for parsing, allowing you
   * to parse repeated patterns until a condition is no longer met.
   * It's useful for parsing lists, arrays, or any repeated structure
   * where the termination condition is explicit.
   * 
   * @template T - The type of items collected by the loop body
   * @param condition - Parser that determines when to continue looping
   * @param body - Parser that processes each iteration
   * @yields The condition and body parsers alternately
   * @returns Array of all results collected during the loop
   * 
   * @example
   * ```typescript
   * const listParser = genParser(function* () {
   *   yield* gen.parse(str('['));
   *   
   *   const items = yield* gen.while(
   *     lookahead(str(']')).map(() => false).optional().map(x => x === null),
   *     sequence([
   *       item,
   *       str(',').optional()
   *     ]).map(([item]) => item)
   *   );
   *   
   *   yield* gen.parse(str(']'));
   *   return items;
   * });
   * ```
   */
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

  /**
   * Parses items until a delimiter is encountered.
   * 
   * This utility provides a convenient way to parse content up to a
   * specific delimiter, which is common in many parsing scenarios.
   * The delimiter is consumed as part of the parsing process.
   * 
   * This is particularly useful for parsing text blocks, comments,
   * strings, or any content that has a clear termination marker.
   * 
   * @template T - The type of items being parsed
   * @param parser - Parser for individual items
   * @param delimiter - Parser for the termination delimiter
   * @yields The item parser repeatedly, then the delimiter
   * @returns Array of all items parsed before the delimiter
   * 
   * @example
   * ```typescript
   * // Parse a quoted string
   * const stringParser = genParser(function* () {
   *   yield* gen.parse(str('"'));
   *   const chars = yield* gen.until(
   *     regex(/[^"]/),
   *     str('"')
   *   );
   *   return chars.join('');
   * });
   * ```
   * 
   * @example
   * ```typescript
   * // Parse lines until end marker
   * const blockParser = genParser(function* () {
   *   const lines = yield* gen.until(
   *     regex(/[^\n]+/),
   *     str('END')
   *   );
   *   return lines;
   * });
   * ```
   */
  *until<T>(
    parser: Parser<T>,
    delimiter: Parser<any>
  ): Generator<Parser<any>, T[], any> {
    const results: T[] = [];
    while (true) {
      // Try delimiter first
      const delim = yield delimiter.optional();
      if (delim !== null) break;
      results.push(yield parser);
    }
    return results;
  }
};
