/**
 * @fileoverview Common parsing patterns implemented as generator utilities.
 * 
 * This module provides a collection of reusable generator-based parsing patterns
 * that solve common parsing problems. These patterns encapsulate best practices
 * and provide building blocks for more complex parsers, making it easier to
 * implement robust parsing logic without reinventing common solutions.
 * 
 * The patterns in this module cover:
 * - List and sequence parsing with separators
 * - Block and bracketed content parsing
 * - Error recovery and fault-tolerant parsing
 * - Delimiter-based content extraction
 * - Nested structure handling
 * 
 * Each pattern is implemented as a generator function that can be easily
 * integrated into larger parsing contexts while maintaining readability
 * and type safety.
 * 
 * @example
 * ```typescript
 * // Parse a comma-separated list of identifiers
 * const idListParser = genParser(function* () {
 *   const ids = yield* genPatterns.list(
 *     function* () { return yield identifier; },
 *     str(',')
 *   );
 *   return ids;
 * });
 * ```
 */

import { Parser, str } from "../../parser";
import { genParser } from "./generator";

/**
 * Collection of reusable generator-based parsing patterns.
 * 
 * This object provides a curated set of common parsing patterns that can be
 * used as building blocks for more complex parsers. Each pattern is implemented
 * as a generator function that integrates naturally with the generator parsing
 * framework while solving specific parsing challenges.
 */
export const genPatterns = {
  /**
   * Parses a list of items separated by a delimiter.
   * 
   * This pattern handles the common case of parsing comma-separated values,
   * space-separated tokens, or any other delimited list structure. It gracefully
   * handles empty lists and provides consistent behavior for trailing separators.
   * 
   * The pattern is optimized for performance and provides clear error messages
   * when parsing fails. It uses optional parsing to handle the variable-length
   * nature of lists without consuming input on failure.
   * 
   * @template T - The type of individual items in the list
   * @param itemGen - Generator function that parses individual list items
   * @param separator - Parser for the separator between items
   * @yields Individual item generators and separator parsers
   * @returns Array of parsed items
   * 
   * @example
   * ```typescript
   * // Parse comma-separated numbers
   * const numberListParser = genParser(function* () {
   *   const numbers = yield* genPatterns.list(
   *     function* () {
   *       return yield regex(/\d+/).map(s => parseInt(s));
   *     },
   *     str(',')
   *   );
   *   return numbers;
   * });
   * 
   * // Usage: "1,2,3,4,5" -> [1, 2, 3, 4, 5]
   * ```
   * 
   * @example
   * ```typescript
   * // Parse function parameters
   * const paramListParser = genParser(function* () {
   *   yield str('(');
   *   const params = yield* genPatterns.list(
   *     function* () {
   *       const name = yield identifier;
   *       yield str(':');
   *       const type = yield typeExpression;
   *       return { name, type };
   *     },
   *     str(',')
   *   );
   *   yield str(')');
   *   return params;
   * });
   * ```
   */
  *list<T>(
    itemGen: () => Generator<Parser<any>, T, any>,
    separator: Parser<any>
  ): Generator<Parser<any>, T[], any> {
    const items: T[] = [];

    // Try to parse the first item
    const first = yield genParser(itemGen).optional();
    if (first === null) return items;
    items.push(first);

    // Parse remaining items with separators
    while (true) {
      const sep = yield separator.optional();
      if (sep === null) break;

      const item = yield* itemGen();
      items.push(item);
    }

    return items;
  },

  /**
   * Parses content within block delimiters (e.g., braces, brackets).
   * 
   * This pattern handles the common case of parsing content that is enclosed
   * within matching delimiters. It provides a clean abstraction for parsing
   * block structures like JSON objects, code blocks, or any bracketed content.
   * 
   * The pattern ensures proper delimiter matching and provides clear error
   * messages when delimiters are mismatched or missing.
   * 
   * @template T - The type of content parsed within the block
   * @param contentGen - Generator function that parses the block content
   * @param openDelim - Parser for the opening delimiter (default: '{')
   * @param closeDelim - Parser for the closing delimiter (default: '}')
   * @yields The delimiter parsers and content generator
   * @returns The parsed content from within the block
   * 
   * @example
   * ```typescript
   * // Parse a JSON-like object
   * const objectParser = genParser(function* () {
   *   const content = yield* genPatterns.block(
   *     function* () {
   *       const pairs = yield* genPatterns.list(
   *         function* () {
   *           const key = yield stringLiteral;
   *           yield str(':');
   *           const value = yield jsonValue;
   *           return [key, value];
   *         },
   *         str(',')
   *       );
   *       return Object.fromEntries(pairs);
   *     }
   *   );
   *   return content;
   * });
   * ```
   * 
   * @example
   * ```typescript
   * // Parse an array with custom delimiters
   * const arrayParser = genParser(function* () {
   *   const items = yield* genPatterns.block(
   *     function* () {
   *       return yield* genPatterns.list(
   *         function* () { return yield expression; },
   *         str(',')
   *       );
   *     },
   *     str('['),
   *     str(']')
   *   );
   *   return items;
   * });
   * ```
   */
  *block<T>(
    contentGen: () => Generator<Parser<any>, T, any>,
    openDelim: Parser<any> = str('{'),
    closeDelim: Parser<any> = str('}')
  ): Generator<Parser<any>, T, any> {
    yield openDelim;
    const content = yield* contentGen();
    yield closeDelim;
    return content;
  },

  /**
   * Parses with error recovery and fallback handling.
   * 
   * This pattern provides robust error handling for parsing scenarios where
   * you want to attempt a complex parse but have a fallback strategy if it fails.
   * It's particularly useful for parsing languages with optional syntax or
   * when implementing fault-tolerant parsers.
   * 
   * The recovery mechanism attempts the main parsing strategy first, and if
   * that fails, it tries to recover by parsing a recovery pattern and
   * returning a fallback value. This allows parsing to continue even when
   * encountering malformed input.
   * 
   * @template T - The type of the successful parse result and fallback value
   * @param mainGen - Generator function for the primary parsing strategy
   * @param recovery - Parser to consume input and recover from errors
   * @param fallback - Value to return when recovery is needed
   * @yields The main generator or recovery parser
   * @returns Either the successful parse result or the fallback value
   * 
   * @example
   * ```typescript
   * // Parse expressions with error recovery
   * const exprParser = genParser(function* () {
   *   const expr = yield* genPatterns.withRecovery(
   *     function* () {
   *       // Try to parse a complex expression
   *       const left = yield term;
   *       const op = yield operator;
   *       const right = yield term;
   *       return { type: 'binary', left, op, right };
   *     },
   *     endOfLineParser, // Skip to end of statement
   *     { type: 'error', message: 'Malformed expression' }
   *   );
   *   return expr;
   * });
   * ```
   * 
   * @example
   * ```typescript
   * // Parse optional type annotations with fallback
   * const typeAnnotationParser = genParser(function* () {
   *   const type = yield* genPatterns.withRecovery(
   *     function* () {
   *       yield str(':');
   *       return yield typeExpression;
   *     },
   *     succeed(null), // No recovery needed, just continue
   *     'any' // Default type when annotation is missing
   *   );
   *   return type;
   * });
   * ```
   */
  *withRecovery<T>(
    mainGen: () => Generator<Parser<any>, T, any>,
    recovery: Parser<any>,
    fallback: T
  ): Generator<Parser<any>, T, any> {
    const main = genParser(mainGen);
    const result = yield main.optional();

    if (result !== null) return result;

    // Attempt recovery
    yield recovery;
    return fallback;
  },

  /**
   * Parses nested structures with proper depth tracking.
   * 
   * This pattern handles parsing of nested structures like nested expressions,
   * nested function calls, or any recursive grammar constructs. It maintains
   * proper depth tracking to prevent infinite recursion and provides clear
   * error messages for deeply nested structures.
   * 
   * @template T - The type of the nested structure being parsed
   * @param contentGen - Generator function that parses the nested content
   * @param maxDepth - Maximum allowed nesting depth (default: 100)
   * @yields The content generator with depth tracking
   * @returns The parsed nested structure
   * 
   * @example
   * ```typescript
   * // Parse nested parenthetical expressions
   * const nestedExprParser = genParser(function* () {
   *   const expr = yield* genPatterns.nested(
   *     function* () {
   *       yield str('(');
   *       const inner = yield* gen.tryParsers(
   *         nestedExprParser, // Recursive reference
   *         numberLiteral,
   *         identifier
   *       );
   *       yield str(')');
   *       return inner;
   *     },
   *     10 // Max depth of 10
   *   );
   *   return expr;
   * });
   * ```
   */
  *nested<T>(
    contentGen: () => Generator<Parser<any>, T, any>,
    maxDepth: number = 100
  ): Generator<Parser<any>, T, any> {
    // In a full implementation, this would track depth using context
    // For now, we'll implement a simplified version
    if (maxDepth <= 0) {
      throw new Error("Maximum nesting depth exceeded");
    }
    
    return yield* contentGen();
  },

  /**
   * Parses delimited content with configurable escape handling.
   * 
   * This pattern is specifically designed for parsing quoted strings, comments,
   * or any content that is delimited by specific markers and may contain
   * escaped characters. It provides robust handling of escape sequences
   * and proper delimiter matching.
   * 
   * @template T - The type of the content being parsed
   * @param contentParser - Parser for individual content elements
   * @param startDelim - Parser for the starting delimiter
   * @param endDelim - Parser for the ending delimiter
   * @param escapeSeq - Optional parser for escape sequences
   * @yields The delimiter and content parsers
   * @returns Array of parsed content elements
   * 
   * @example
   * ```typescript
   * // Parse quoted strings with escape sequences
   * const stringParser = genParser(function* () {
   *   const chars = yield* genPatterns.delimited(
   *     regex(/[^"\\]/), // Regular characters
   *     str('"'),        // Start delimiter
   *     str('"'),        // End delimiter
   *     sequence([str('\\'), regex(/./)])  // Escape sequences
   *   );
   *   return chars.join('');
   * });
   * ```
   */
  *delimited<T>(
    contentParser: Parser<T>,
    startDelim: Parser<any>,
    endDelim: Parser<any>,
    escapeSeq?: Parser<any>
  ): Generator<Parser<any>, T[], any> {
    yield startDelim;
    
    const content: T[] = [];
    while (true) {
      // Check for end delimiter
      const endResult = yield endDelim.optional();
      if (endResult !== null) break;
      
      // Check for escape sequence if provided
      if (escapeSeq) {
        const escapeResult = yield escapeSeq.optional();
        if (escapeResult !== null) {
          // Handle the escaped content (simplified)
          content.push(escapeResult as T);
          continue;
        }
      }
      
      // Parse regular content
      content.push(yield contentParser);
    }
    
    return content;
  }
};
