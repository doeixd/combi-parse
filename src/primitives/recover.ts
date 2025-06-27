/**
 * @fileoverview Error Recovery and Robust Parsing
 * 
 * This module provides sophisticated error recovery mechanisms that enable parsers
 * to continue parsing after encountering errors. Error recovery is essential for
 * building robust parsers that can handle malformed input gracefully, particularly
 * in interactive environments like IDEs, REPL systems, and development tools.
 * 
 * The recovery approach is based on synchronization points - specific tokens or
 * patterns that can be used to resynchronize the parser after an error occurs.
 * When a parse error happens, the recovery mechanism skips forward in the input
 * until it finds a known synchronization point, then resumes parsing from there.
 * 
 * This technique is commonly used in compiler construction where parsing errors
 * should not prevent the analysis of the rest of the program. The goal is to
 * find as many errors as possible in a single pass while providing meaningful
 * error messages and maintaining parser state consistency.
 * 
 * @example
 * ```typescript
 * // Parse statements with semicolon recovery
 * const statement = recover(
 *   actualStatement,
 *   str(';'),
 *   { type: 'error', message: 'Invalid statement' }
 * );
 * 
 * // Parse expressions with comma recovery
 * const expression = recover(
 *   validExpression,
 *   str(','),
 *   { type: 'error', value: null }
 * );
 * ```
 */

import { Parser, success } from "../parser";

/**
 * Creates a parser with error recovery capabilities.
 * 
 * This function wraps a primary parser with error recovery logic. When the primary
 * parser fails, the recovery mechanism searches forward in the input for a
 * synchronization point defined by the recovery parser. Once found, parsing
 * resumes with a fallback value.
 * 
 * The recovery process follows these steps:
 * 1. Attempt to parse with the primary parser
 * 2. If successful, return the result normally
 * 3. If failed, search forward for the recovery pattern
 * 4. When recovery pattern is found, return the fallback value
 * 5. If no recovery pattern is found, return the original error
 * 
 * This enables parsers to handle syntax errors gracefully and continue processing
 * the rest of the input, which is essential for tools like syntax highlighters,
 * linters, and IDEs that need to provide feedback on partially correct code.
 * 
 * @template T The type of value the primary parser produces
 * @param parser The primary parser to attempt
 * @param recovery Parser that defines the synchronization/recovery point
 * @param fallback Value to return when recovery is successful
 * @returns A parser that can recover from errors using the recovery strategy
 * 
 * @example
 * ```typescript
 * // Parse function declarations with brace recovery
 * const functionDecl = recover(
 *   sequence([
 *     str('function'),
 *     whitespace,
 *     identifier,
 *     str('('),
 *     parameterList,
 *     str(')'),
 *     block
 *   ]),
 *   str('}'), // Recover at closing brace
 *   { type: 'function', name: 'error', params: [], body: [] }
 * );
 * 
 * // This allows parsing to continue even with malformed functions
 * const program = many(functionDecl);
 * ```
 * 
 * @example
 * ```typescript
 * // Parse array elements with comma recovery
 * const arrayElement = recover(
 *   choice([numberLiteral, stringLiteral, booleanLiteral]),
 *   str(','),
 *   { type: 'error', value: null }
 * );
 * 
 * const arrayLiteral = sequence([
 *   str('['),
 *   optional(whitespace),
 *   sepBy(arrayElement, str(',')),
 *   optional(whitespace),
 *   str(']')
 * ], ([, , elements, ,]) => elements);
 * 
 * // Can parse: [1, "hello", invalid_syntax, true]
 * // Result: [1, "hello", {type: 'error', value: null}, true]
 * ```
 * 
 * @example
 * ```typescript
 * // Parse CSS rules with semicolon recovery
 * const cssProperty = recover(
 *   sequence([
 *     identifier,
 *     str(':'),
 *     cssValue
 *   ], ([prop, , value]) => ({ property: prop, value })),
 *   str(';'),
 *   { property: 'error', value: 'invalid' }
 * );
 * 
 * const cssRule = sequence([
 *   cssSelector,
 *   str('{'),
 *   many(cssProperty),
 *   str('}')
 * ], ([selector, , properties,]) => ({
 *   selector,
 *   properties: properties.filter(p => p.property !== 'error')
 * }));
 * ```
 * 
 * @example
 * ```typescript
 * // Parse SQL statements with semicolon recovery for error reporting
 * const sqlStatement = recover(
 *   choice([selectStatement, insertStatement, updateStatement, deleteStatement]),
 *   str(';'),
 *   { type: 'syntax_error', query: 'malformed' }
 * );
 * 
 * const sqlScript = many(sqlStatement);
 * 
 * // Parse multiple statements, collecting both valid and error entries
 * const results = sqlScript.parse(`
 *   SELECT * FROM users;
 *   INSERT INTO users (name INVALID SYNTAX;
 *   UPDATE users SET name = 'John';
 * `);
 * // Results include both successful parses and error markers
 * ```
 */
export function recover<T>(
  parser: Parser<T>,
  recovery: Parser<any>,
  fallback: T
): Parser<T> {
  return new Parser(state => {
    const result = parser.run(state);

    if (result.type === 'success') {
      // If primary parser succeeded, check if recovery pattern follows
      const recoveryAttempt = recovery.run(result.state);
      if (recoveryAttempt.type === 'success') {
        // Recovery pattern found after successful parse - consume it
        return success(result.value, recoveryAttempt.state);
      }
      // No recovery pattern found, return original success
      return result;
    }

    // Primary parser failed - try to recover by skipping to recovery point
    let currentState = state;
    while (currentState.index < currentState.input.length) {
      const recoveryResult = recovery.run(currentState);

      if (recoveryResult.type === 'success') {
        return success(fallback, recoveryResult.state);
      }

      currentState = { ...currentState, index: currentState.index + 1 };
    }

    return result; // Return original failure
  });
}
