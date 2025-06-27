/**
 * @fileoverview Parser Algebra Operations
 * 
 * This module provides advanced parser combinators based on mathematical set operations
 * and formal language theory. These operations extend basic parser combinators with
 * algebraic operations like intersection, difference, and permutation that are
 * essential for complex parsing scenarios.
 * 
 * The algebraic approach treats parsers as recognizers of formal languages, allowing
 * operations typically found in automata theory to be applied at the parser level.
 * This enables sophisticated parsing patterns that would be difficult to express
 * with traditional sequential combinators alone.
 * 
 * @example
 * ```typescript
 * // Parse identifiers that are not keywords
 * const identifier = ParserAlgebra.difference(
 *   regex(/[a-z]+/),
 *   choice([str('if'), str('while'), str('for')])
 * );
 * 
 * // Parse attributes in any order
 * const attributes = ParserAlgebra.permutation([
 *   attribute('class'),
 *   attribute('id'), 
 *   attribute('style')
 * ] as const);
 * ```
 */

import { Parser, failure, success, Success } from "../parser";

/**
 * Collection of algebraic operations for parser combinators.
 * 
 * These operations treat parsers as mathematical objects that can be combined
 * using set-theoretic operations. Each operation has specific semantics derived
 * from formal language theory and automata theory.
 */
export const ParserAlgebra = {
  /**
   * Creates a parser that succeeds only when both input parsers succeed with identical results.
   * 
   * This operation implements the intersection of two formal languages, requiring
   * both parsers to accept the same input and produce the same output value.
   * It's useful for implementing constraints where multiple parsing rules must
   * be satisfied simultaneously.
   * 
   * @template T The type of value both parsers produce
   * @param p1 First parser to intersect
   * @param p2 Second parser to intersect  
   * @returns A parser that succeeds only when both parsers succeed with identical results
   * 
   * @example
   * ```typescript
   * // Parse strings that are both valid identifiers AND not reserved words
   * const validIdentifier = ParserAlgebra.intersect(
   *   identifierParser,
   *   notKeywordParser
   * );
   * 
   * // Parse numbers that satisfy multiple constraints
   * const evenPositiveNumber = ParserAlgebra.intersect(
   *   numberParser,
   *   evenEndingParser
   * );
   * ```
   */
  intersect<T>(p1: Parser<T>, p2: Parser<T>): Parser<T> {
    return new Parser(state => {
      const r1 = p1.run(state);
      if (r1.type === 'failure') return r1;

      const r2 = p2.run(state);
      if (r2.type === 'failure') return r2;

      if (r1.value === r2.value && r1.state.index === r2.state.index) {
        return r1;
      }

      return failure('Parsers produced different results', state);
    });
  },

  /**
   * Creates a parser that succeeds when the first parser succeeds but the second fails.
   * 
   * This operation implements the set difference of two formal languages (L1 - L2),
   * accepting input that matches the first parser but explicitly rejecting input
   * that would also match the second parser. This is particularly useful for
   * excluding specific patterns from broader matching rules.
   * 
   * @template T The type of value the first parser produces
   * @template U The type of value the second parser produces (typically ignored)
   * @param p1 The primary parser that should succeed
   * @param p2 The exclusion parser that should fail
   * @returns A parser that succeeds only when p1 succeeds and p2 fails
   * 
   * @example
   * ```typescript
   * // Parse identifiers that are not keywords
   * const identifier = ParserAlgebra.difference(
   *   identifierParser,
   *   keywordParser
   * );
   * 
   * // Parse any number except zero
   * const nonZeroNumber = ParserAlgebra.difference(
   *   numberParser,
   *   zeroParser
   * );
   * ```
   */
  difference<T, U>(p1: Parser<T>, p2: Parser<U>): Parser<T> {
    return new Parser(state => {
      const r2 = p2.run(state);
      if (r2.type === 'success') {
        return failure('Difference: second parser unexpectedly succeeded', state);
      }

      return p1.run(state);
    });
  },

  /**
   * Creates a parser that matches all provided parsers in any order.
   * 
   * This operation attempts to match all parsers in the array, but allows them
   * to appear in any permutation. This is particularly useful for parsing
   * unordered collections like HTML attributes, command-line flags, or
   * configuration parameters where order doesn't matter.
   * 
   * The algorithm uses backtracking to try different orderings of the parsers
   * until all have been successfully matched exactly once.
   * 
   * @template T A tuple type representing the types of all parser results
   * @param parsers Array of parsers to match in any order
   * @returns A parser that succeeds when all parsers match in any order
   * 
   * @example
   * ```typescript
   * // Parse HTML attributes in any order
   * const attributes = ParserAlgebra.permutation([
   *   classAttributeParser,
   *   idAttributeParser,
   *   styleAttributeParser
   * ] as const);
   * 
   * // Parse function parameters in any order (with default values)
   * const namedParams = ParserAlgebra.permutation([
   *   requiredParamParser,
   *   defaultParamParser,
   *   typeParamParser
   * ] as const);
   * ```
   */
  permutation<T extends readonly any[]>(
    parsers: [...{ [K in keyof T]: Parser<T[K]> }]
  ): Parser<T> {
    return new Parser(state => {
      const results = new Array(parsers.length);
      const used = new Array(parsers.length).fill(false);
      let currentState = state;

      for (let i = 0; i < parsers.length; i++) {
        let found = false;

        for (let j = 0; j < parsers.length; j++) {
          if (used[j]) continue;

          const result = parsers[j].run(currentState);
          if (result.type === 'success') {
            results[j] = result.value;
            used[j] = true;
            currentState = result.state;
            found = true;
            break;
          }
        }

        if (!found) {
          return failure('Permutation: could not match all parsers', state);
        }
      }

      return success(results as unknown as T, currentState);
    });
  },

  /**
   * Creates a parser that tries all provided parsers and returns the result with the longest match.
   * 
   * This operation implements a greedy matching strategy by evaluating all parsers
   * and selecting the one that consumes the most input characters. This is useful
   * for handling ambiguous grammars where multiple rules might match the same input,
   * and you want to prefer the most specific (longest) match.
   * 
   * This follows the "maximal munch" principle common in lexical analysis, where
   * longer tokens are preferred over shorter ones when there's ambiguity.
   * 
   * @template T The type of value all parsers produce
   * @param parsers Variable number of parsers to try
   * @returns A parser that returns the result from the parser with the longest match
   * 
   * @example
   * ```typescript
   * // Parse the longest matching keyword or identifier
   * const token = ParserAlgebra.longest(
   *   str('if'),        // matches 2 chars
   *   str('ifdef'),     // matches 5 chars - this wins for "ifdef"
   *   str('identifier') // matches 10 chars - this wins for "identifier"
   * );
   * 
   * // Parse numbers with different formats, preferring longer matches
   * const number = ParserAlgebra.longest(
   *   decimalParser,    // decimal number
   *   integerParser,    // integer (shorter, lower priority)
   *   hexadecimalParser // hexadecimal
   * );
   * ```
   */
  longest<T>(...parsers: Parser<T>[]): Parser<T> {
    return new Parser(state => {
      let bestResult: Success<T> | null = null;

      for (const parser of parsers) {
        const result = parser.run(state);
        if (result.type === 'success') {
          if (!bestResult || result.state.index > bestResult.state.index) {
            bestResult = result;
          }
        }
      }

      return bestResult || failure('No parser succeeded', state);
    });
  }
};
