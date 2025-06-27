/**
 * @fileoverview Generator-based parser combinators for composing complex parsers.
 * 
 * This module provides combinator functions that work with generator-based parsers,
 * enabling powerful composition patterns that maintain the elegant, readable style
 * of generator functions while providing sophisticated parsing capabilities.
 * 
 * The generator combinators allow you to:
 * - Sequence multiple generator parsers
 * - Choose between alternative parsing strategies
 * - Transform and map generator results
 * - Compose complex parsing logic in a readable, maintainable way
 * 
 * These combinators are designed to work seamlessly with the generator parser
 * infrastructure, providing type-safe composition with excellent performance.
 * 
 * @example
 * ```typescript
 * // Compose multiple generator parsers
 * const configParser = genParser(genSequence(
 *   () => genString(),
 *   () => genEquals(),
 *   () => genValue()
 * ));
 * ```
 */

import { Parser } from "../../parser";
import { genParser } from "./generator";

/**
 * Sequences multiple generator functions to parse items in order.
 * 
 * This combinator creates a generator that runs multiple generator parsers
 * in sequence, collecting all their results into a tuple. It maintains full
 * type safety by inferring the result types from each generator.
 * 
 * Unlike traditional sequence combinators, this preserves the generator
 * paradigm while providing the convenience of automatic result collection.
 * Each generator can use the full power of generator syntax including
 * control flow, error handling, and complex logic.
 * 
 * @template T - A tuple type representing the results of each generator
 * @param generators - Array of generator functions to sequence
 * @returns A generator function that produces a tuple of all results
 * 
 * @example
 * ```typescript
 * // Parse key-value pairs
 * const kvParser = genParser(genSequence(
 *   function* () { return yield str('key'); },
 *   function* () { return yield str('='); },
 *   function* () { return yield regex(/\w+/); }
 * ));
 * 
 * const result = kvParser.run({ input: "name=John", index: 0 });
 * // result.value: ["key", "=", "John"]
 * ```
 * 
 * @example
 * ```typescript
 * // Parse function call syntax
 * const funcCallParser = genParser(genSequence(
 *   function* () { return yield identifier; },
 *   function* () { return yield str('('); },
 *   function* () { return yield argList; },
 *   function* () { return yield str(')'); }
 * ));
 * ```
 */
export function genSequence<T extends readonly any[]>(
  ...generators: { [K in keyof T]: () => Generator<Parser<any>, T[K], any> }
): () => Generator<Parser<any>, T, any> {
  return function* () {
    const results = [] as unknown as T;
    for (let i = 0; i < generators.length; i++) {
      const gen = generators[i];
      const result = yield* gen();
      (results as any)[i] = result;
    }
    return results;
  };
}

/**
 * Creates a choice combinator that tries multiple generator alternatives.
 * 
 * This combinator attempts each generator in order until one succeeds,
 * implementing backtracking to handle failed attempts gracefully. It's
 * essential for parsing languages with multiple valid syntactic forms
 * or when you need to handle different input patterns.
 * 
 * The choice combinator uses optional parsing to attempt each alternative
 * without consuming input on failure, enabling clean backtracking behavior.
 * 
 * @template T - The common result type of all generator alternatives
 * @param generators - Array of generator functions to try as alternatives
 * @returns A generator function that succeeds with the first matching alternative
 * @throws Throws an error if no generator succeeds
 * 
 * @example
 * ```typescript
 * // Parse different number formats
 * const numberParser = genParser(genChoice(
 *   function* () {
 *     return yield regex(/0x[0-9a-fA-F]+/).map(s => parseInt(s, 16));
 *   },
 *   function* () {
 *     return yield regex(/0b[01]+/).map(s => parseInt(s, 2));
 *   },
 *   function* () {
 *     return yield regex(/\d+/).map(s => parseInt(s, 10));
 *   }
 * ));
 * ```
 * 
 * @example
 * ```typescript
 * // Parse different expression types
 * const exprParser = genParser(genChoice(
 *   function* () { return yield* parseFunction(); },
 *   function* () { return yield* parseVariable(); },
 *   function* () { return yield* parseLiteral(); }
 * ));
 * ```
 */
export function genChoice<T>(
  ...generators: Array<() => Generator<Parser<any>, T, any>>
): () => Generator<Parser<any>, T, any> {
  return function* () {
    for (const gen of generators) {
      // Try each generator with backtracking
      const parser = genParser(gen);
      const result = yield parser.optional();
      if (result !== null) return result;
    }
    throw new Error("No generator succeeded");
  };
}

/**
 * Maps over the result of a generator function, transforming the output.
 * 
 * This combinator allows you to transform the result of a generator parser
 * without modifying the parsing logic itself. It's useful for converting
 * parsed values into different types, normalizing data, or applying
 * business logic transformations.
 * 
 * The mapping preserves the generator paradigm while providing the
 * flexibility to transform results as needed for your application.
 * 
 * @template T - The original result type of the generator
 * @template U - The transformed result type
 * @param gen - The generator function to map over
 * @param fn - Function to transform the generator result
 * @returns A generator function that produces the transformed result
 * 
 * @example
 * ```typescript
 * // Parse a number and convert to string
 * const stringNumberParser = genParser(genMap(
 *   function* () {
 *     return yield regex(/\d+/).map(s => parseInt(s));
 *   },
 *   (num: number) => `Number: ${num}`
 * ));
 * 
 * const result = stringNumberParser.run({ input: "42", index: 0 });
 * // result.value: "Number: 42"
 * ```
 * 
 * @example
 * ```typescript
 * // Parse coordinates and create point object
 * const pointParser = genParser(genMap(
 *   function* () {
 *     const x = yield number;
 *     yield str(',');
 *     const y = yield number;
 *     return [x, y] as const;
 *   },
 *   ([x, y]) => ({ x, y, distance: Math.sqrt(x*x + y*y) })
 * ));
 * ```
 */
export function genMap<T, U>(
  gen: () => Generator<Parser<any>, T, any>,
  fn: (value: T) => U
): () => Generator<Parser<any>, U, any> {
  return function* () {
    const result = yield* gen();
    return fn(result);
  };
}
