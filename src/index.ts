/**
 * @fileoverview Combi-Parse Main Entry Point
 * 
 * This is the main barrel export module for the Combi-Parse library, a powerful and 
 * type-safe parser combinator library for TypeScript. It provides a comprehensive
 * set of tools for building complex parsers from simple, reusable functions.
 * 
 * The library is designed around the concept of composability - you build complex
 * parsers by combining smaller ones, mirroring the structure of the data you want
 * to parse. All parsers are type-safe, leveraging TypeScript's type system to
 * catch parsing logic errors at compile time.
 * 
 * ## Key Features
 * 
 * - **Type-Safe**: Parsers know the type of data they produce
 * - **Composable**: Build complex parsers by combining smaller ones
 * - **Readable**: Parser code often looks like formal grammar
 * - **Powerful**: Advanced features like left-recursion, generator syntax, detailed errors
 * - **Flexible**: Both method chaining and functional composition styles supported
 * 
 * ## Core Concepts
 * 
 * - **Parser**: A function that takes input and returns either success (with a value) or failure
 * - **Combinator**: A function that takes parsers and returns a new parser
 * - **Generator Parser**: Async/await style syntax for sequential parsing
 * - **Character Classes**: Type-safe character set parsers
 * 
 * @example
 * ```typescript
 * import { str, regex, sequence, choice, number } from 'combi-parse';
 * 
 * // Parse a simple assignment: "let x = 42;"
 * const assignment = sequence([
 *   str("let"),
 *   regex(/\s+/),           // whitespace
 *   regex(/[a-z]+/),        // variable name
 *   regex(/\s*=\s* /),       // equals with optional spaces
 *   number,                 // numeric value
 *   str(";")
 * ] as const);
 * 
 * const result = assignment.parse("let x = 42;");
 * // -> ["let", " ", "x", " = ", 42, ";"]
 * ```
 * 
 * @example
 * ```typescript
 * // Using generator syntax for cleaner sequential parsing
 * import { genParser, str, regex, number } from 'combi-parse';
 * 
 * const assignment = genParser(function* () {
 *   yield str("let");
 *   yield regex(/\s+/);
 *   const name = yield regex(/[a-z]+/);
 *   yield regex(/\s*=\s* /);
 *   const value = yield number;
 *   yield str(";");
 *   return { name, value };
 * });
 * 
 * assignment.parse("let x = 42;"); // -> { name: "x", value: 42 }
 * ```
 * 
 * @see {@link ./parser.ts} for core parser types and combinators
 * @see {@link ./primitives} for fundamental building block parsers
 * @see {@link ./parsers} for generator-based parser utilities
 * @see {@link ./standalone.ts} for functional composition utilities
 */

/**
 * Core primitive parsers and utilities.
 * Includes basic parsers like `any`, `char`, `digit`, `letter`, etc.
 */
export * from './primitives';

/**
 * Main parser functionality including the Parser class and core combinators.
 * This is where you'll find `str`, `regex`, `sequence`, `choice`, `many`, etc.
 */
export * from './parser';

/**
 * Advanced type-level regex engine for compile-time string pattern matching.
 * Enables TypeScript to understand and type-check regular expression patterns.
 */
export * from './regex';

/**
 * URL parsing utilities with RFC 3986 compliance.
 * Provides structured parsing of URLs into typed components.
 */
export * from './url';

/**
 * Standalone functional composition utilities.
 * 
 * Provides a "data-last" functional programming style as an alternative
 * to method chaining. Includes the `pipe` utility and functional versions
 * of all parser methods and combinators.
 * 
 * @example
 * ```typescript
 * import { Standalone } from 'combi-parse';
 * 
 * const parser = Standalone.pipe(
 *   str("hello"),
 *   Standalone.keepRight(str(" ")),
 *   Standalone.keepRight(str("world"))
 * );
 * ```
 */
import * as Standalone from './standalone';
export { Standalone };

/**
 * Generator-based parser utilities for async/await style parsing syntax.
 * Provides `genParser` for creating parsers using generator functions.
 */
export * from './parsers';

/**
 * Explicit re-export of genParser to resolve any potential naming ambiguity.
 * 
 * @example
 * ```typescript
 * import { genParser } from 'combi-parse';
 * 
 * const parser = genParser(function* () {
 *   const greeting = yield str("hello");
 *   yield str(" ");
 *   const target = yield str("world");
 *   return `${greeting} ${target}`;
 * });
 * ```
 */
export { genParser } from './parsers';




