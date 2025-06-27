/**
 * @fileoverview Character Class Utilities
 * 
 * This module provides a convenient re-export of the type-safe `charClass` factory function
 * from the main parser module. The `charClass` function creates parsers for specific
 * character sets using TypeScript's type system to provide excellent autocomplete and
 * type safety.
 * 
 * The function leverages predefined character class types from `master-char-classes.ts`
 * to enable parsing of common character categories like digits, letters, punctuation,
 * and Unicode blocks.
 * 
 * @example
 * ```typescript
 * import { charClass } from './charClass';
 * 
 * // Parse a single digit character
 * const digitParser = charClass('Digit');
 * const result = digitParser.parse('5'); // -> '5' (typed as Digit)
 * 
 * // Parse any ASCII letter
 * const letterParser = charClass('Alpha');
 * const letter = letterParser.parse('A'); // -> 'A' (typed as Alpha)
 * ```
 * 
 * @see {@link ./parser.ts} for the main charClass implementation
 * @see {@link ./master-char-classes.ts} for available character class types
 */

/**
 * A type-safe factory function for creating character class parsers.
 * 
 * Creates a parser that matches a single character from a predefined character class.
 * The function provides excellent TypeScript integration with autocomplete for
 * available character class names and precise return types.
 * 
 * @template K - The character class name (must be a key in CharClassTypeMap)
 * @param className - The name of the character class to parse
 * @returns A parser that produces a character from the specified class
 * 
 * @example
 * ```typescript
 * // Parse hexadecimal digits
 * const hexParser = charClass('HexDigit');
 * hexParser.parse('A'); // -> 'A' (typed as HexDigit)
 * hexParser.parse('f'); // -> 'f' (typed as HexDigit)
 * 
 * // Parse whitespace characters
 * const spaceParser = charClass('Whitespace');
 * spaceParser.parse(' '); // -> ' ' (typed as Whitespace)
 * spaceParser.parse('\t'); // -> '\t' (typed as Whitespace)
 * 
 * // Parse Unicode letters (conceptual type)
 * const letterParser = charClass('UnicodeLetter');
 * letterParser.parse('ñ'); // -> 'ñ' (typed as string, requires Unicode support)
 * ```
 * 
 * @throws {ParserError} When the input character is not in the specified character class
 */
export { charClass } from './parser';
