/**
 * @fileoverview Advanced Pattern Matching and Recognition
 * 
 * This module provides sophisticated pattern matching utilities that extend
 * basic string and regex parsing with type-safe literal matching and advanced
 * pattern recognition capabilities. These utilities are particularly valuable
 * for parsing domain-specific languages, configuration formats, and structured
 * data where specific literal values need to be recognized with full type safety.
 * 
 * The pattern matching approach combines the flexibility of regular expressions
 * with the type safety of TypeScript's literal types, enabling parsers that
 * not only recognize patterns but also provide precise type information about
 * the matched content.
 * 
 * This is especially useful for parsing enums, keywords, operators, and other
 * finite sets of literal values where type safety is crucial for subsequent
 * processing phases.
 * 
 * @example
 * ```typescript
 * // Type-safe HTTP method parsing
 * const httpMethod = pattern(['GET', 'POST', 'PUT', 'DELETE'] as const);
 * // Type: Parser<'GET' | 'POST' | 'PUT' | 'DELETE'>
 * 
 * // Regex with literal validation
 * const bool = literalRegex(/true|false/, ['true', 'false'] as const);
 * // Type: Parser<'true' | 'false'>
 * ```
 */

import { Parser, choice, str, success, failure, ParserState } from '../parser';

/**
 * Creates a type-safe parser for a finite set of string literals.
 * 
 * This function generates a parser that matches any of the provided literal strings
 * while maintaining full type safety. The resulting parser's type is a union of
 * the input literal types, enabling precise type checking in downstream code.
 * 
 * The implementation uses the choice combinator internally, creating individual
 * string parsers for each literal and selecting the first match.
 * 
 * @template T The literal string types to match
 * @param literals Array of literal strings to match
 * @returns A parser that matches any of the provided literals with precise typing
 * 
 * @example
 * ```typescript
 * // Parse programming language keywords
 * const keyword = pattern(['if', 'else', 'while', 'for', 'return'] as const);
 * // Type: Parser<'if' | 'else' | 'while' | 'for' | 'return'>
 * 
 * const result = keyword.parse('if');
 * // result is typed as 'if' | 'else' | 'while' | 'for' | 'return'
 * // but will have the specific value 'if'
 * ```
 * 
 * @example
 * ```typescript
 * // Parse HTTP methods with full type safety
 * const httpMethod = pattern(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const);
 * 
 * // Usage in a larger parser
 * const httpRequest = sequence([
 *   httpMethod,
 *   whitespace,
 *   pathParser,
 *   whitespace,
 *   str('HTTP/1.1')
 * ], ([method, , path, , version]) => ({
 *   method, // Typed as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
 *   path,
 *   version
 * }));
 * ```
 * 
 * @example
 * ```typescript
 * // Parse boolean values
 * const boolean = pattern(['true', 'false'] as const);
 * const booleanValue = boolean.map(str => str === 'true');
 * // Type: Parser<boolean>
 * 
 * // Parse with additional transformation
 * const logLevel = pattern(['debug', 'info', 'warn', 'error'] as const);
 * const logLevelNum = logLevel.map(level => {
 *   switch (level) {
 *     case 'debug': return 0;
 *     case 'info': return 1;
 *     case 'warn': return 2;
 *     case 'error': return 3;
 *   }
 * });
 * ```
 */
export function pattern<T extends string>(
  literals: T[]
): Parser<T> {
  // Sort by length (longest first) to prevent shorter patterns from matching first
  const sortedLiterals = [...literals].sort((a, b) => b.length - a.length);
  return choice(sortedLiterals.map(lit => str(lit)));
}

/**
 * Creates a regex-based parser with literal type validation.
 * 
 * This function combines the flexibility of regular expression matching with
 * the type safety of literal string validation. The regex is used for initial
 * matching, but the result is validated against a predefined set of literals
 * to ensure type safety.
 * 
 * This is particularly useful when you have a regex that might match more
 * broadly than desired, but you want to restrict the actual results to a
 * specific set of known values while maintaining type safety.
 * 
 * @template T The literal string types that are valid results
 * @param regex Regular expression for initial matching
 * @param literals Array of valid literal results
 * @returns A parser that matches using the regex but validates against literals
 * @throws Error if the regex matches but the result is not in the literals array
 * 
 * @example
 * ```typescript
 * // Parse boolean values with regex but validate literals
 * const bool = literalRegex(/true|false/, ['true', 'false'] as const);
 * // Type: Parser<'true' | 'false'>
 * 
 * // This gives you regex performance with literal type safety
 * const result = bool.parse('true'); // result: 'true' (typed precisely)
 * ```
 * 
 * @example
 * ```typescript
 * // Parse CSS color names with partial regex
 * const colorName = literalRegex(
 *   /red|blue|green|yellow|black|white/,
 *   ['red', 'blue', 'green', 'yellow', 'black', 'white'] as const
 * );
 * // Type: Parser<'red' | 'blue' | 'green' | 'yellow' | 'black' | 'white'>
 * 
 * // Use in CSS parser
 * const cssColor = choice([
 *   hexColorParser.map(hex => ({ type: 'hex', value: hex })),
 *   colorName.map(name => ({ type: 'named', value: name }))
 * ]);
 * ```
 * 
 * @example
 * ```typescript
 * // Parse operators with regex efficiency and type safety
 * const operator = literalRegex(
 *   /\+\+|--|[+\-*\/=<>!]=?|&&|\|\|/,
 *   ['++', '--', '+', '-', '*', '/', '=', '==', '!=', '<', '>', '<=', '>=', '&&', '||'] as const
 * );
 * 
 * // The regex matches efficiently, but result is typed precisely
 * const parseExpression = sequence([
 *   term,
 *   operator,
 *   term
 * ], ([left, op, right]) => ({
 *   left,
 *   operator: op, // Typed as the union of operator literals
 *   right
 * }));
 * ```
 */
export function literalRegex<T extends string>(
  regex: RegExp,
  literals: readonly T[]
): Parser<T> {
  return new Parser((state: ParserState) => {
    const input = state.input.slice(state.index);
    const match = input.match(regex);
    if (match && match.index === 0) {
      const matchText = match[0];
      if (literals.includes(matchText as T)) {
        return success(matchText as T, { ...state, index: state.index + matchText.length });
      }
    }
    return failure(`Expected one of: ${literals.join(', ')}`, state);
  });
}
