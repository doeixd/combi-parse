/**
 * @fileoverview Core generator-based parser implementation.
 * 
 * This module provides the fundamental infrastructure for generator-based parsing,
 * which represents a paradigm shift from traditional combinator-heavy approaches
 * to more natural, imperative-style parsing using JavaScript generators.
 * 
 * Generator-based parsing offers several key advantages:
 * - Natural control flow using familiar JavaScript constructs
 * - Excellent readability and maintainability
 * - Powerful error reporting with step-by-step context
 * - Type-safe composition with full TypeScript support
 * - Performance benefits through lazy evaluation
 * 
 * The core concept is simple: instead of composing complex combinator chains,
 * you write parsing logic using generator functions that yield individual
 * parsers and return final results. The generator framework handles the
 * orchestration, backtracking, and error management automatically.
 * 
 * @example
 * ```typescript
 * // Traditional combinator approach
 * const kvParser = sequence([
 *   identifier,
 *   str(':'),
 *   whitespace.optional(),
 *   choice([number, stringLiteral])
 * ]).map(([key, , , value]) => ({ [key]: value }));
 * 
 * // Generator approach
 * const kvParser = genParser(function* () {
 *   const key = yield identifier;
 *   yield str(':');
 *   yield whitespace.optional();
 *   const value = yield choice([number, stringLiteral]);
 *   return { [key]: value };
 * });
 * ```
 */

import { Parser, ParserState, success, failure, lookahead } from "../../parser";

/**
 * Creates a parser from a generator function.
 * 
 * This is the core function that transforms a generator function into a fully
 * functional parser. The generator function should yield Parser instances and
 * return the final parsed result. The framework handles all the orchestration,
 * including state management, error propagation, and result collection.
 * 
 * The generator approach provides several benefits over traditional combinators:
 * - Natural imperative syntax with familiar control flow
 * - Automatic error context tracking for better debugging
 * - Type inference that works naturally with TypeScript
 * - Performance optimizations through lazy evaluation
 * - Enhanced debugging capabilities with step-by-step execution
 * 
 * @template T - The type of the final result produced by the generator
 * @param genFn - A generator function that yields parsers and returns a result
 * @returns A Parser that executes the generator-based parsing logic
 * 
 * @example
 * ```typescript
 * // Parse a simple key-value pair
 * const kvParser = genParser(function* () {
 *   const key = yield identifier;
 *   yield str('=');
 *   const value = yield stringLiteral;
 *   return { [key]: value };
 * });
 * 
 * const result = kvParser.run({
 *   input: 'name="John"',
 *   index: 0
 * });
 * // result.value: { name: "John" }
 * ```
 * 
 * @example
 * ```typescript
 * // Parse a function call with error handling
 * const funcCallParser = genParser(function* () {
 *   const name = yield identifier;
 *   yield str('(');
 *   
 *   const args = [];
 *   while (!(yield lookahead(str(')')).optional())) {
 *     if (args.length > 0) {
 *       yield str(',');
 *       yield whitespace.optional();
 *     }
 *     args.push(yield expression);
 *     yield whitespace.optional();
 *   }
 *   
 *   yield str(')');
 *   return { type: 'call', name, args };
 * });
 * ```
 */
export function genParser<T>(
  genFn: () => Generator<Parser<any>, T, any>
): Parser<T> {
  return new Parser(state => {
    const iterator = genFn();
    let currentState = state;
    let nextValue: any = undefined;

    // Enhanced debugging and context tracking
    const yieldHistory: Array<{
      step: number;
      parser: string;
      value: any;
      state: ParserState;
      position: number;
      input: string;
    }> = [];

    let step = 0;

    while (true) {
      const { value: parserOrReturn, done } = iterator.next(nextValue);

      if (done) {
        // Generator completed successfully
        return success(parserOrReturn as T, currentState);
      }

      step++;
      const parser = parserOrReturn as Parser<any>;
      const result = parser.run(currentState);

      if (result.type === "failure") {
        // Enhanced error context with full execution history
        const contextLines = yieldHistory
          .map(h => `  Step ${h.step}: ${h.parser} at position ${h.position} -> ${JSON.stringify(h.value)}`)
          .join('\n');
        
        const currentPosition = currentState.index;
        const inputContext = currentState.input.slice(
          Math.max(0, currentPosition - 20),
          currentPosition + 20
        );
        
        return failure(
          `Generator parser failed at step ${step}\n` +
          `Current position: ${currentPosition}\n` +
          `Input context: "${inputContext}"\n` +
          `Execution history:\n${contextLines}\n` +
          `Final error: ${result.message}`,
          result.state
        );
      }

      // Track successful parsing step
      yieldHistory.push({
        step,
        parser: getParserName(parser),
        value: result.value,
        state: currentState,
        position: currentState.index,
        input: currentState.input.slice(currentState.index, currentState.index + 10)
      });

      currentState = result.state;
      nextValue = result.value;
    }
  });
}

/**
 * Convenience generator function for yielding parsers with type safety.
 * 
 * This utility function provides a clean, type-safe way to yield parsers
 * within generator functions. It ensures proper type inference and makes
 * the generator syntax more explicit and readable.
 * 
 * @template T - The type of value produced by the parser
 * @param parser - The parser to yield
 * @yields The parser for execution by the generator framework
 * @returns The parsed value with proper type inference
 * 
 * @example
 * ```typescript
 * const parser = genParser(function* () {
 *   const name = yield* genYield(identifier);
 *   const age = yield* genYield(number);
 *   return { name, age };
 * });
 * ```
 */
export function* genYield<T>(parser: Parser<T>): Generator<Parser<T>, T, T> {
  return yield parser;
}

/**
 * Collection of helper utilities for common generator parsing patterns.
 * 
 * This object provides a comprehensive set of utilities that make generator-based
 * parsing more convenient and expressive. Each utility is designed to integrate
 * seamlessly with generator syntax while providing powerful parsing capabilities.
 */
export const gen = {
  /**
   * Yields a parser and returns its result with enhanced type safety.
   * 
   * @template T - The type of value produced by the parser
   * @param parser - The parser to execute
   * @yields The parser for execution
   * @returns The parsed value
   */
  *parse<T>(parser: Parser<T>): Generator<Parser<T>, T, T> {
    return yield parser;
  },

  /**
   * Tries multiple parsers until one succeeds, with graceful failure handling.
   * 
   * This utility provides a clean way to implement choice-based parsing within
   * generators, attempting each parser in turn until one succeeds or all fail.
   * 
   * @template T - The common result type of all parsers
   * @param parsers - Array of parsers to try in order
   * @yields Each parser wrapped in optional() for safe attempting
   * @returns The first successful result, or null if all parsers fail
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
   * Conditional parsing with if/else semantics.
   * 
   * This utility enables natural conditional logic within generator parsers,
   * allowing you to branch parsing behavior based on input conditions.
   * 
   * @template T - The result type of the conditional parsers
   * @param condition - Parser that determines which branch to take
   * @param thenParser - Parser to use if condition succeeds
   * @param elseParser - Optional parser to use if condition fails
   * @yields The condition and selected branch parsers
   * @returns Result of the selected parser, or null if no branch applies
   * 
   * @example
   * ```typescript
   * const optionalSemicolon = genParser(function* () {
   *   const hasSemi = yield* gen.when(
   *     str(';'),
   *     succeed(true),
   *     succeed(false)
   *   );
   *   return hasSemi;
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
   * While-loop construct for repetitive parsing patterns.
   * 
   * This utility provides while-loop semantics within generator parsers,
   * allowing you to parse repeated structures until a condition is no longer met.
   * 
   * @template T - The type of items collected by the loop body
   * @param condition - Parser that determines when to continue looping
   * @param body - Parser that processes each iteration
   * @yields The condition and body parsers alternately
   * @returns Array of all results collected during the loop
   * 
   * @example
   * ```typescript
   * const statementListParser = genParser(function* () {
   *   const statements = yield* gen.while(
   *     lookahead(statement),
   *     statement
   *   );
   *   return statements;
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
   * Parses items until a delimiter is encountered, with delimiter consumption.
   * 
   * This utility provides a convenient way to parse content up to a specific
   * delimiter. The delimiter is consumed as part of the parsing process, making
   * it ideal for parsing delimited content like strings, comments, or blocks.
   * 
   * @template T - The type of items being parsed
   * @param parser - Parser for individual items
   * @param delimiter - Parser for the termination delimiter
   * @yields The item parser repeatedly, then the delimiter
   * @returns Array of all items parsed before the delimiter
   * 
   * @example
   * ```typescript
   * const stringContentParser = genParser(function* () {
   *   yield str('"');
   *   const chars = yield* gen.until(
   *     regex(/[^"\\]|\\./),  // Any non-quote char or escaped char
   *     str('"')
   *   );
   *   return chars.join('');
   * });
   * ```
   */
  *until<T>(
    parser: Parser<T>,
    delimiter: Parser<any>
  ): Generator<Parser<any>, T[], any> {
    const results: T[] = [];
    while (true) {
      const delim = yield lookahead(delimiter).optional();
      if (delim !== null) break;
      results.push(yield parser);
    }
    yield delimiter; // Consume the delimiter
    return results;
  }
};

/**
 * Gets a human-readable name for a parser instance.
 * 
 * This helper function attempts to generate meaningful names for parsers
 * to improve debugging and error reporting. It checks various properties
 * and falls back to generic descriptions when specific information isn't available.
 * 
 * @param parser - The parser to get a name for
 * @returns A human-readable name for the parser
 * 
 * @internal
 */
function getParserName(parser: Parser<any>): string {
  // Check for custom name property
  if ('name' in parser && typeof (parser as any).name === 'string') {
    return (parser as any).name;
  }

  // Check constructor name
  const constructorName = parser.constructor.name;
  if (constructorName && constructorName !== 'Object' && constructorName !== 'Parser') {
    return constructorName;
  }

  // Try to infer from parser function content (simplified)
  const parserStr = parser.toString();
  if (parserStr.includes('str(')) return 'StringParser';
  if (parserStr.includes('regex(')) return 'RegexParser';
  if (parserStr.includes('choice(')) return 'ChoiceParser';
  if (parserStr.includes('sequence(')) return 'SequenceParser';

  return 'Parser';
}
