/**
 * @fileoverview Functional Composition & Piping Utilities for Parsers
 * 
 * This module provides a comprehensive set of standalone, "data-last" functions
 * that mirror the methods and combinators from the core parser library. It enables
 * a functional composition style using the `pipe` utility, which can be more
 * readable and flexible for complex parser definitions.
 * 
 * The functional style is an alternative to method chaining that offers several benefits:
 * - **Composability**: Functions can be easily combined and reused
 * - **Readability**: Complex transformations read left-to-right like a pipeline
 * - **Testability**: Individual transformation functions can be tested in isolation
 * - **Flexibility**: Partial application and currying work naturally
 * 
 * This module imports the core library using a namespace (`P`) to prevent naming
 * conflicts, which is a recommended pattern for creating parallel APIs.
 * 
 * ## Style Comparison
 * 
 * **Method Chaining Style:**
 * ```typescript
 * const parser = str("(")
 *   .keepRight(number)
 *   .keepLeft(str(")"))
 *   .map(n => ({ value: n }));
 * ```
 * 
 * **Functional Piping Style:**
 * ```typescript
 * const parser = pipe(
 *   number,
 *   surroundedBy(str("("), str(")")),
 *   map(n => ({ value: n }))
 * );
 * ```
 * 
 * ## Key Concepts
 * 
 * - **Data-Last**: All functions take the parser as the last argument for better composition
 * - **Currying**: Functions return partially applied functions when given incomplete arguments
 * - **Pipe-First**: The `pipe` function takes data first, then transformation functions
 * - **Type Safety**: Full TypeScript type inference through the entire pipeline
 * 
 * @example
 * ```typescript
 * import { pipe, map, keepRight, keepLeft, optional } from './standalone';
 * import { str, number } from './parser';
 * 
 * // Parse a parenthesized number like "(42)"
 * const parenthesizedNumber = pipe(
 *   number,
 *   surroundedBy(str("("), str(")")),
 *   map(n => ({ value: n }))
 * );
 * ```
 * 
 * @example
 * ```typescript
 * // Create reusable parser transformations
 * const inParens = <T>(contentParser: Parser<T>) => 
 *   surroundedBy(str("("), str(")"))(contentParser);
 * 
 * const asOptional = <T>() => optional<T>();
 * 
 * const parseOptionalNumber = pipe(
 *   number,
 *   inParens,
 *   asOptional
 * );
 * ```
 * 
 * @see {@link ./parser.ts} for the core parser library
 * @see {@link https://ramdajs.com/} for inspiration on functional programming patterns
 */

// We import the entire core module as `P` to prevent name collisions.
// This is a robust pattern for creating a parallel functional API.
import * as P from './parser';
import { Parser } from './parser';

// =================================================================
// Section 1: Core Composition Utility
// =================================================================

/**
 * Pipes a value through a sequence of functions, where each function's
 * output is the next function's input. This provides a highly readable,
 * left-to-right way to compose operations on a parser.
 *
 * The type safety is preserved through each step of the pipeline thanks to
 * TypeScript's function overload inference.
 *
 * @param value The initial value (e.g., a starting `Parser`).
 * @param operations A sequence of functions to apply to the value.
 * @returns The result of the final operation in the sequence.
 *
 * @example
 * // A parser for a C-style preprocessor directive like `#include <stdio.h>`
 * const includeParser = pipe(
 *   P.str("#include"),
 *   P.lexeme,
 *   keepRight(
 *     P.between(P.str("<"), P.regex(/[^>]+/), P.str(">"))
 *   ),
 *   map(filename => ({ directive: 'include', file: filename }))
 * );
 *
 * // includeParser.parse("#include <stdio.h>");
 * // -> { directive: 'include', file: 'stdio.h' }
 */
export function pipe<P0>(p0: P0): P0;
export function pipe<P0, P1>(p0: P0, op1: (p: P0) => P1): P1;
export function pipe<P0, P1, P2>(p0: P0, op1: (p: P0) => P1, op2: (p: P1) => P2): P2;
export function pipe<P0, P1, P2, P3>(p0: P0, op1: (p: P0) => P1, op2: (p: P1) => P2, op3: (p: P2) => P3): P3;
export function pipe<P0, P1, P2, P3, P4>(p0: P0, op1: (p: P0) => P1, op2: (p: P1) => P2, op3: (p: P2) => P3, op4: (p: P3) => P4): P4;
export function pipe<P0, P1, P2, P3, P4, P5>(p0: P0, op1: (p: P0) => P1, op2: (p: P1) => P2, op3: (p: P2) => P3, op4: (p: P3) => P4, op5: (p: P4) => P5): P5;
export function pipe<P0, P1, P2, P3, P4, P5, P6>(p0: P0, op1: (p: P0) => P1, op2: (p: P1) => P2, op3: (p: P2) => P3, op4: (p: P3) => P4, op5: (p: P4) => P5, op6: (p: P5) => P6): P6;
export function pipe<P0, P1, P2, P3, P4, P5, P6, P7>(p0: P0, op1: (p: P0) => P1, op2: (p: P1) => P2, op3: (p: P2) => P3, op4: (p: P3) => P4, op5: (p: P4) => P5, op6: (p: P5) => P6, op7: (p: P6) => P7): P7;
export function pipe(initial: any, ...operations: ((p: any) => any)[]): any {
  return operations.reduce((acc, op) => op(acc), initial);
}

// =================================================================
// Section 2: Standalone Parser Operators (Data-Last)
// =================================================================

/**
 * A functional operator to transform a parser's successful result.
 * This is the standalone, pipe-friendly version of the `.map()` method.
 *
 * @template T The parser's original result type.
 * @template U The new result type after the transformation.
 * @param fn The function to apply to the successful result.
 * @returns A function that takes a `Parser<T>` and returns a `Parser<U>`.
 *
 * @example
 * const numberParser = pipe(
 *   P.regex(/[0-9]+/),
 *   map(Number) // Transforms the parsed string into a number
 * );
 */
export const map = <T, U>(fn: (value: T) => U) => (parser: Parser<T>): Parser<U> => parser.map(fn);

/**
 * A functional operator to chain a second parser after a first one,
 * where the second parser depends on the result of the first. This is the monadic
 * "bind" operation and the pipe-friendly version of the `.chain()` method.
 *
 * @template T The first parser's result type.
 * @template U The second parser's result type.
 * @param fn A function that takes the first result and returns the second parser.
 * @returns A function that takes a `Parser<T>` and returns a `Parser<U>`.
 *
 * @example
 * // Parse a length-prefixed string, e.g., "4:test"
 * const lengthPrefixedString = pipe(
 *   P.number,
 *   chain(len => P.sequence([P.str(':'), P.regex(new RegExp(`.{${len}}`))])),
 *   map(([, text]) => text) // Keep only the final text
 * );
 */
export const chain = <T, U>(fn: (value: T) => Parser<U>) => (parser: Parser<T>): Parser<U> => parser.chain(fn);

/**
 * A functional operator that provides an alternative parser.
 * This is the standalone, pipe-friendly version of the `.or()` method.
 *
 * @template U The type of the alternative parser's result.
 * @param other The parser to try if the first one fails without consuming input.
 * @returns A function that takes a `Parser<T>` and returns a `Parser<T | U>`.
 *
 * @example
 * const trueOrFalse = pipe(
 *   P.str("true"),
 *   or(P.str("false"))
 * );
 */
export const or = <U>(other: Parser<U>) => <T>(parser: Parser<T>): Parser<T | U> => parser.or(other);

/**
 * A functional operator to apply a parser zero or more times, collecting results into an array.
 * This is the standalone, pipe-friendly version of the `.many()` method.
 *
 * @template T The parser's result type.
 * @returns A function that takes a `Parser<T>` and returns a `Parser<T[]>`.
 *
 * @example
 * const p = pipe(
 *   P.charClass('a'),
 *   many(),
 *   map(as => as.length) // Count the number of 'a's
 * );
 * // p.parse("aaab") -> 3
 */
export const many = <T>() => (parser: Parser<T>): Parser<T[]> => parser.many();


/**
 * A functional operator to apply a parser one or more times, collecting results into an array.
 * This is the standalone, pipe-friendly version of the `.many1()` method.
 *
 * @template T The parser's result type.
 * @returns A function that takes a `Parser<T>` and returns a `Parser<T[]>`.
 *
 * @example
 * const numberString = pipe(
 *   P.charClass("Digit"),
 *   many1(),
 *   map(digits => digits.join(''))
 * );
 * // numberString.parse("123xyz") -> "123"
 * // numberString.parse("abc") -> Fails
 */
export const many1 = <T>() => (parser: Parser<T>): Parser<T[]> => parser.many1();

/**
 * A functional operator that makes a parser optional. If it fails without consuming
 * input, it succeeds with `null`.
 * This is the standalone, pipe-friendly version of the `.optional()` method.
 *
 * @template T The parser's result type.
 * @returns A function that takes a `Parser<T>` and returns a `Parser<T | null>`.
 *
 * @example
 * const optionalFlag = pipe(
 *   P.str("--verbose"),
 *   optional()
 * );
 * // optionalFlag.parse("--verbose") -> "--verbose"
 * // optionalFlag.parse("") -> null
 */
export const optional = <T>() => (parser: Parser<T>): Parser<T | null> => parser.optional();

/**
 * A functional operator to run a second parser after a first, keeping the
 * result of the second.
 * This is the standalone, pipe-friendly version of `.keepRight()`.
 *
 * @template U The result type of the parser to keep.
 * @param p2 The parser to run second, whose result is kept.
 * @returns A function that takes the first parser (`Parser<any>`) and returns a `Parser<U>`.
 *
 * @example
 * // Keep just the tag name from an opening XML tag
 * const openTagName = pipe(
 *   P.str("<"),
 *   keepRight(P.regex(/[a-z]+/))
 * );
 * // openTagName.parse("<tag>") -> "tag"
 */
export const keepRight = <U>(p2: Parser<U>) => (p1: Parser<any>): Parser<U> => p1.keepRight(p2);

/**
 * A functional operator to run a second parser after a first, keeping the
 * result of the first.
 * This is the standalone, pipe-friendly version of `.keepLeft()`.
 *
 * @template U The result type of the parser to discard.
 * @param p2 The parser to run second, whose result is discarded.
 * @returns A function that takes the first parser (`Parser<T>`) and returns a `Parser<T>`.
 *
 * @example
 * // Keep just the identifier from a statement ending in a semicolon
 * const statement = pipe(
 *   P.regex(/[a-z]+/),
 *   keepLeft(P.str(";"))
 * );
 * // statement.parse("myVar;") -> "myVar"
 */
export const keepLeft = <U>(p2: Parser<U>) => <T>(p1: Parser<T>): Parser<T> => p1.keepLeft(p2);

/**
 * A functional operator to add debug logging to a parser pipeline.
 * This is the standalone, pipe-friendly version of the `.debug()` method.
 *
 * @param label An optional label for the debug output.
 * @returns A function that takes a parser and returns a new parser with debugging enabled.
 *
 * @example
 * const p = pipe(
 *   P.str("a"),
 *   debug("parser-a"),
 *   keepRight(P.str("b")),
 *   debug("parser-b")
 * );
 */
export const debug = (label?: string) => <T>(parser: Parser<T>): Parser<T> => parser.debug(label);

/**
 * A functional operator to "tap into" a parser pipeline and inspect
 * the successful result without modifying it. Useful for logging or
 * side effects within a `pipe`.
 *
 * @param fn A function that receives the successful value. Its return value is ignored.
 * @returns A function that takes a parser and returns an equivalent parser that performs the tap.
 *
 * @example
 * const finalParser = pipe(
 *   P.number,
 *   tap(n => console.log(`Parsed number: ${n}`)),
 *   map(n => ({ value: n }))
 * );
 */
export const tap = <T>(fn: (value: T) => void) => (parser: Parser<T>): Parser<T> =>
  parser.map(value => {
    fn(value);
    return value;
  });

// =================================================================
// Section 3: Advanced & Utility Operators
// =================================================================

/**
 * A functional operator that overrides the error message of a parser.
 * Corresponds to the `label` combinator.
 *
 * @param message The new error message to use on failure.
 * @returns A function that takes a parser and returns a new parser with the custom error message.
 *
 * @example
 * const ipPart = pipe(
 *   P.regex(/[0-9]{1,3}/),
 *   withLabel("an IP address part (0-255)")
 * );
 * // On failure, shows "an IP address part (0-255)" instead of the regex.
 */
export const withLabel = (message: string) => <T>(parser: Parser<T>): Parser<T> => P.label(parser, message);

/**
 * A functional operator that adds a contextual label to a parser's error message.
 * Corresponds to the `context` combinator.
 *
 * @param ctx The context string to prepend to the error message.
 * @returns A function that takes a parser and returns a new parser with the contextualized error message.
 *
 * @example
 * const valueParser = pipe(P.number, withContext("parsing a value"));
 * const assignmentParser = pipe(
 *   P.sequence([P.regex(/[a-z]+/), P.str("="), valueParser]),
 *   withContext("parsing an assignment")
 * );
 * // On failure, error is "[parsing an assignment] [parsing a value] ..."
 */
export const withContext = (ctx: string) => <T>(parser: Parser<T>): Parser<T> => P.context(parser, ctx);

/**
 * A functional operator that wraps a parser's result in an AST-like node.
 * Corresponds to the `astNode` combinator.
 *
 * @template L The string literal type for the node's `type` property.
 * @param label The label to use for the `type` property of the node.
 * @returns A function that takes a `Parser<T>` and returns a `Parser<{ type: L; value: T }>`.
 *
 * @example
 * const numberNode = pipe(
 *   P.number,
 *   toAstNode("NumberLiteral")
 * );
 * // numberNode.parse("123") -> { type: "NumberLiteral", value: 123 }
 */
export const toAstNode = <L extends string>(label: L) => <T>(parser: Parser<T>): Parser<{ type: L; value: T }> => P.astNode(label, parser);

/**
 * A functional operator that filters a parser's result using a predicate for semantic validation.
 * Corresponds to the `filter` combinator.
 *
 * @param predicate A function that returns `true` for valid results.
 * @param message An optional error message for when the filter fails.
 * @returns A function that takes a `Parser<T>` and returns a `Parser<T>` that also validates the value.
 *
 * @example
 * const evenDigit = pipe(
 *   P.charClass("Digit"),
 *   map(Number),
 *   filter(n => n % 2 === 0, "Expected an even digit")
 * );
 * // evenDigit.parse("4") -> 4
 * // evenDigit.parse("3") -> Fails
 */
export const filter = <T>(predicate: (value: T) => boolean, message?: string) => (parser: Parser<T>): Parser<T> => P.filter(parser, predicate, message);

/**
 * A functional operator that flattens a parser's nested array result.
 * Corresponds to the `flatten` combinator.
 *
 * @param depth The depth to flatten to. Defaults to 1.
 * @returns A function that takes a `Parser<any[]>` and returns a `Parser<any[]>`.
 */
export const flatten = <D extends number = 1>(depth?: D) => (parser: Parser<any[]>): Parser<any[]> => P.flatten(parser, depth);

/**
 * A functional operator that consumes any trailing whitespace after a parser succeeds.
 * This is the pipe-friendly version of the `lexeme` combinator and is essential for tokenizing.
 *
 * @returns A function that takes a parser and returns a new parser that consumes trailing whitespace.
 *
 * @example
 * const lexedNumber = pipe(P.number, asLexeme());
 * // P.sequence([lexedNumber, lexedNumber]).parse("10  20  ") -> [10, 20]
 */
export const asLexeme = () => <T>(parser: Parser<T>): Parser<T> => P.lexeme(parser);

/**
 * A functional operator that memoizes a parser's result at each input position.
 * This is the pipe-friendly version of the `memo` combinator, critical for optimizing
 * parsers with significant backtracking or for enabling left-recursion.
 *
 * @returns A function that takes a parser and returns its memoized version.
 */
export const memoize = () => <T>(parser: Parser<T>): Parser<T> => P.memo(parser);

/**
 * A functional operator that asserts a certain pattern *follows* the current parser,
 * without consuming it. This is a common and useful pattern, equivalent to
 * `p.keepLeft(lookahead(followingParser))`.
 *
 * @param followingParser The parser that must succeed after the main parser.
 * @returns A function that takes a `Parser<T>` and returns a `Parser<T>`.
 */
export const followedBy = <U>(followingParser: Parser<U>) => <T>(parser: Parser<T>): Parser<T> =>
  parser.keepLeft(P.lookahead(followingParser));

/**
 * A functional operator that asserts a certain pattern does **not** follow the current
 * parser. This is extremely useful for resolving ambiguities (e.g., keywords vs. identifiers).
 *
 * @param disallowedParser The parser that must *fail* after the main parser.
 * @returns A function that takes a `Parser<T>` and returns a `Parser<T>`.
 *
 * @example
 * // A parser for the keyword "if" but not "iffy"
 * const ifKeyword = pipe(
 *   P.str("if"),
 *   notFollowedBy(P.regex(/[a-zA-Z0-9_]/))
 * );
 * // ifKeyword.parse("if (x)") -> "if"
 * // ifKeyword.parse("iffy") -> Fails
 */
export const notFollowedBy = (disallowedParser: Parser<any>) => <T>(parser: Parser<T>): Parser<T> =>
  parser.keepLeft(P.notFollowedBy(disallowedParser));

// =================================================================
// Section 4: High-Level Structural Operators
// =================================================================

/**
 * A functional operator that parses content enclosed by delimiters.
 * This is the pipe-friendly version of the `between` combinator.
 *
 * @param left The parser for the opening delimiter.
 * @param right The parser for the closing delimiter.
 * @returns A function that takes a `content` parser and returns a new parser
 *          that parses `left`, then `content`, then `right`, keeping the result of `content`.
 *
 * @example
 * const parenthesizedNumber = pipe(
 *   P.number,
 *   surroundedBy(P.str("("), P.str(")"))
 * );
 * // parenthesizedNumber.parse("(123)") -> 123
 */
export const surroundedBy = <L, R>(left: Parser<L>, right: Parser<R>) => <C>(content: Parser<C>): Parser<C> =>
  P.between(left, content, right);

/**
 * A functional operator to parse zero or more occurrences of an item, separated by a separator.
 * The result is an array of the item's type. For custom transformations, pipe the
 * result to `map`, which improves type safety and composability.
 *
 * @param separator The parser for the separator.
 * @returns A function that takes an `item` parser and returns a parser for the list.
 *
 * @example
 * const commaSeparatedNumbers = pipe(
 *   P.number,
 *   separatedBy(P.str(','))
 * );
 * // commaSeparatedNumbers.parse("1,2,3") -> [1, 2, 3]
 * // To get the sum instead:
 * const sumOfNumbers = pipe(
 *   commaSeparatedNumbers,
 *   map(nums => nums.reduce((a, b) => a + b, 0))
 * );
 */
export const separatedBy = <S>(separator: Parser<S>) => <T>(itemParser: Parser<T>): Parser<T[]> =>
  P.sepBy(itemParser, separator);

/**
 * A functional operator to parse one or more occurrences of an item, separated by a separator.
 * This will fail if at least one item cannot be parsed.
 *
 * @param separator The parser for the separator.
 * @returns A function that takes an `item` parser and returns a parser for the list.
 *
 * @example
 * const commaSeparatedNumbers = pipe(
 *   P.number,
 *   separatedBy1(P.str(','))
 * );
 * // commaSeparatedNumbers.parse("1,2,3") -> [1, 2, 3]
 * // commaSeparatedNumbers.parse("") -> Fails
 */
export const separatedBy1 = <S>(separator: Parser<S>) => <T>(itemParser: Parser<T>): Parser<T[]> =>
  P.sepBy1(itemParser, separator);

/**
 * A functional operator that transforms a parser's successful result to a constant value.
 * This is a convenient shortcut for `map(() => value)`.
 *
 * @template U The type of the constant value.
 * @param value The constant value to return on success.
 * @returns A function that takes a parser and returns a new parser that produces `value`.
 *
 * @example
 * const trueParser = pipe(
 *   P.str("true"),
 *   mapTo(true) // Maps the string "true" to the boolean true
 * );
 */
export const mapTo = <U>(value: U) => (parser: Parser<any>): Parser<U> => parser.map(() => value);

/**
 * A functional operator that attaches a human-readable description to a parser.
 * This does not change the parser's behavior but can be used for documentation
 * or advanced error reporting tools. It requires the `description` property on the
 * core `Parser` class to be available.
 *
 * @param description The description string.
 * @returns A function that takes a parser and returns it with an added `description` property.
 */
export const withDescription = (description: string) => <T>(parser: Parser<T>): Parser<T> => {
  // This relies on the property being mutable.
  (parser as { description?: string }).description = description;
  return parser;
};