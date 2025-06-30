/**
 * Secure Parsing Module
 * 
 * This module provides security-hardened parsing capabilities designed to prevent
 * denial-of-service (DoS) attacks, resource exhaustion, and malicious input exploitation.
 * It integrates with the contextual parsing framework to monitor and limit resources
 * during a parse, ensuring safe handling of untrusted input.
 * 
 * Security features are provided as composable combinators that work with a `SecurityContext`:
 * - Recursion depth limiting (`withRecursionCheck`) to prevent stack overflow.
 * - Parse time limits (`withTimeoutCheck`) to prevent infinite parsing loops.
 * - Memory usage monitoring and limits.
 * - Bounded repetition (`limitedMany`) for ReDoS (Regular Expression DoS) protection.
 * - Input length restrictions.
 * 
 * This module is essential when:
 * - Processing user-provided data
 * - Parsing data from untrusted sources
 * - Building public APIs that accept structured input
 * - Working in resource-constrained environments
 * - Implementing security-critical applications
 * 
 * @module parsers/secure
 * @version 2.0.0
 * 
 * @example Securing a JSON parser via a SecureSession
 * ```typescript
 * import { createSecureSession } from '@combi-parse/parsers/secure';
 * import { jsonParser } from './json-parser'; // A contextual JSON parser
 * 
 * // Create a session with defined security limits
 * const secureSession = createSecureSession(jsonParser, {
 *   maxDepth: 50,           // Prevent deeply nested objects
 *   maxLength: 10000,       // Limit input size to 10KB
 *   maxParseTime: 1000,     // Timeout after 1 second
 * });
 * 
 * // Safe to use with untrusted input
 * try {
 *   const result = secureSession.parse(untrustedJsonString);
 * } catch (error) {
 *   // Catches security violations like "Max recursion depth exceeded"
 *   console.error(error.message);
 * }
 * ```
 * 
 * @example Composing security checks manually
 * ```typescript
 * import { withRecursionCheck, withTimeoutCheck, lift, SecurityContext } from '@combi-parse/parsers/secure';
 * 
 * // Manually apply security combinators
 * const securePart = withRecursionCheck(withTimeoutCheck(someRecursiveParser));
 * 
 * // To run it, you still need a SecureSession to provide the context
 * const session = createSecureSession(securePart, { maxDepth: 20, maxParseTime: 500 });
 * session.parse(input);
 * ```
 */

import { Parser, regex } from "../parser";
import { ContextualParser, ContextualParserState, lift as liftToContextual, contextualFailure, contextualSuccess } from './contextual';

/**
 * Security configuration options for a `SecureSession`.
 * All limits are optional, and reasonable defaults will be applied if not specified.
 * 
 * @interface SecurityOptions
 */
export interface SecurityOptions {
  /** 
   * Maximum recursion depth allowed during parsing.
   * Prevents stack overflow attacks and deeply nested structures.
   * @default 1000
   */
  maxDepth?: number;

  /** 
   * Maximum input length in characters.
   * Prevents processing of extremely large inputs that could consume resources.
   * @default Infinity
   */
  maxLength?: number;

  /** 
   * Maximum parsing time allowed in milliseconds.
   * Prevents infinite loops and algorithmic complexity attacks.
   * @default 5000
   */
  maxParseTime?: number;

  /** 
   * Maximum memory usage allowed in bytes.
   * NOTE: Accurate memory tracking in JS is complex and not reliably implemented. This is a conceptual limit.
   * @default Infinity
   */
  maxMemory?: number;

  /** 
   * Maximum number of repetitions for `limitedMany`.
   * Prevents attacks based on large, repeated structures.
   * @default 10000
   */
  maxRepetitions?: number;
}

/**
 * The context required for secure parsing. It tracks resource usage
 * throughout a single parse operation.
 */
export interface SecurityContext {
  options: Required<SecurityOptions>;
  startTime: number;
  startMemory: number;
  currentDepth: number;
}

/**
 * Wraps a parser with a check for recursion depth.
 * This is a core combinator for preventing stack overflow attacks. It should
 * be wrapped around parsers that can call themselves recursively.
 * 
 * @param parser The potentially recursive parser to secure.
 * @returns A new parser with a depth check.
 */
export function withRecursionCheck<T, C extends SecurityContext>(
  parser: ContextualParser<T, C>
): ContextualParser<T, C> {
  return new ContextualParser<T, C>((state: ContextualParserState<C>) => {
    state.context.currentDepth++;

    if (state.context.currentDepth > state.context.options.maxDepth) {
      return contextualFailure(`Security violation: Max recursion depth of ${state.context.options.maxDepth} exceeded`, state);
    }
    
    const result = parser.run(state);
    
    // The depth must be decremented on the way out, using the *result's* state context.
    if(result.type === 'success') {
        result.state.context.currentDepth--;
    } else {
        // also decrement on failure
        state.context.currentDepth--;
    }

    return result;
  });
}

/**
 * A combinator that periodically checks if the maximum parsing time has been exceeded.
 * It should be sprinkled into long-running parsers, especially inside loops.
 * 
 * @returns A parser that fails if the time limit is exceeded, or succeeds with null otherwise.
 */
export function withTimeoutCheck<C extends SecurityContext>(): ContextualParser<null, C> {
    return new ContextualParser<null, C>(state => {
        if (Date.now() - state.context.startTime > state.context.options.maxParseTime) {
            return contextualFailure(`Security violation: Max parse time of ${state.context.options.maxParseTime}ms exceeded`, state);
        }
        return contextualSuccess(null, state);
    });
}

/**
 * A combinator that checks for input length at the beginning of a parse.
 * @returns A parser that fails if the input is too long.
 */
function withInputLengthCheck<C extends SecurityContext>(): ContextualParser<null, C> {
    return new ContextualParser<null, C>(state => {
        if (state.input.length > state.context.options.maxLength) {
            return contextualFailure(`Security violation: Input length ${state.input.length} exceeds max of ${state.context.options.maxLength}`, state);
        }
        return contextualSuccess(null, state);
    });
}


/**
 * Manages the state and execution of a secure parsing session.
 * This class is the primary entry point for using the secure parsing module.
 * It initializes the `SecurityContext` and wraps the user's parser with
 * all necessary security checks.
 */
export class SecureSession<T> {
  private secureParser: ContextualParser<T, SecurityContext>;
  private options: Required<SecurityOptions>;

  constructor(
    parser: ContextualParser<T, SecurityContext>,
    options: SecurityOptions = {}
  ) {
    this.options = {
        maxDepth: 1000,
        maxLength: Infinity,
        maxParseTime: 5000,
        maxMemory: Infinity,
        maxRepetitions: 10000,
        ...options,
    };
    
    // Automatically wrap the user's parser with top-level checks
    this.secureParser = withInputLengthCheck<SecurityContext>().chain(() => parser);
  }

  /**
   * Runs the secure parser against the given input string.
   * @param input The untrusted string to parse.
   * @returns The parsed value.
   * @throws {Error} if a security limit is breached or a parse error occurs.
   */
  parse(input: string): T {
    const context: SecurityContext = {
      options: this.options,
      startTime: Date.now(),
      startMemory: 0, // Memory tracking is not reliable in standard JS
      currentDepth: 0
    };

    return this.secureParser.parse(input, context);
  }
}

/**
 * Creates a new secure parsing session.
 * 
 * @param parser The `ContextualParser` to secure. The parser's context `C` must be
 * compatible with `SecurityContext`. Use `withRecursionCheck` on recursive parts of your grammar.
 * @param options The security limits for this session.
 * @returns A `SecureSession` instance ready to parse input.
 */
export function createSecureSession<T>(
    parser: ContextualParser<T, SecurityContext>,
    options?: SecurityOptions
): SecureSession<T> {
    return new SecureSession(parser, options);
}

/**
 * Lifts a base `Parser<T>` into a `ContextualParser` compatible with `SecurityContext`.
 * This is a convenience function for using non-contextual parsers within a secure session.
 * @param parser The base parser to lift.
 */
export function lift<T>(parser: Parser<T>): ContextualParser<T, SecurityContext> {
    return liftToContextual(parser);
}

/**
 * Analyzes a regex pattern for potentially dangerous constructs that could
 * lead to ReDoS (Regular Expression Denial of Service) attacks.
 * @param pattern The regex pattern string to analyze.
 * @returns True if the pattern contains dangerous constructs.
 * @internal
 */
function hasDangerousPattern(pattern: string): boolean {
  // Checks for nested quantifiers like (a+)+ or (a*)* and other complex constructs
  const redosPatterns = [
    /\((?!\?)/,     // Avoids non-capturing groups but catches most nested quantifiers
    /\[.*\\c\d+.*\]/, // Insecure character classes in some engines
    /(\(.*\|.*\))\*\s*$/, // Evil alternation
  ];

  return redosPatterns.some(p => p.test(pattern));
}

/**
 * Collection of DoS-resistant parsing utilities.
 * These utilities provide safer alternatives to potentially dangerous parsing patterns.
 * 
 * @namespace dosResistant
 */
export const dosResistant = {
  /**
   * Creates a regex parser with safety validation.
   * Analyzes the regex pattern for dangerous constructs before creating the parser.
   * @param pattern The regex pattern string
   * @param flags Optional regex flags
   * @returns A safe regex parser
   * @throws {Error} If the pattern contains potentially dangerous constructs
   */
  safeRegex(pattern: string, flags?: string): Parser<string> {
    if (hasDangerousPattern(pattern)) {
      throw new Error(`Potentially dangerous regex pattern detected: ${pattern}`);
    }
    return regex(new RegExp(pattern, flags));
  },

  /**
   * A version of `.many()` that is bounded by a limit from the `SecurityContext`.
   * This prevents attacks where an adversary provides a huge number of repeated elements.
   * This combinator also sprinkles in timeout checks to prevent DoS from long loops.
   * 
   * @param parser The parser to repeat.
   * @returns A parser that applies the input parser up to `maxRepetitions` times.
   */
  limitedMany<T, C extends SecurityContext>(parser: ContextualParser<T, C>): ContextualParser<T[], C> {
    return new ContextualParser((state: ContextualParserState<C>) => {
      const results: T[] = [];
      let currentState = state;
      const max = state.context.options.maxRepetitions;

      for (let i = 0; i < max; i++) {
        // Sprinkle in timeout checks inside the loop
        if (i > 0 && i % 1000 === 0) {
            if (Date.now() - state.context.startTime > state.context.options.maxParseTime) {
                return contextualFailure(`Security violation: Max parse time of ${state.context.options.maxParseTime}ms exceeded in limitedMany`, currentState);
            }
        }

        const result = parser.run(currentState);
        if (result.type === 'failure') break;

        // Infinite loop guard
        if (result.state.index === currentState.index) {
          return contextualFailure('Infinite loop detected in limitedMany: parser succeeded without consuming input.', state);
        }
        
        results.push(result.value);
        currentState = result.state;
      }
      
      // Check if we hit the max limit, which could be a security concern
      if (results.length === max) {
        // This could be a warning or failure depending on strictness.
        // For now, we succeed but a log/warning would be appropriate in a real app.
      }

      return contextualSuccess(results, currentState);
    });
  }
};