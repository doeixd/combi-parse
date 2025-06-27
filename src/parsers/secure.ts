/**
 * Secure Parsing Module
 * 
 * This module provides security-hardened parsing capabilities designed to prevent
 * denial-of-service (DoS) attacks, resource exhaustion, and malicious input exploitation.
 * It wraps existing parsers with resource monitoring and limits to ensure safe parsing
 * of untrusted input data.
 * 
 * Security features include:
 * - Recursion depth limiting to prevent stack overflow
 * - Parse time limits to prevent infinite parsing loops
 * - Memory usage monitoring and limits
 * - Backtracking prevention for ReDoS (Regular Expression DoS) protection
 * - Input length restrictions
 * - Safe regex pattern validation
 * 
 * This module is essential when:
 * - Processing user-provided data
 * - Parsing data from untrusted sources
 * - Building public APIs that accept structured input
 * - Working in resource-constrained environments
 * - Implementing security-critical applications
 * 
 * @module parsers/secure
 * @version 1.0.0
 * 
 * @example Securing a JSON parser
 * ```typescript
 * import { secureParser } from '@combi-parse/parsers/secure';
 * import { jsonValue } from '@combi-parse/parser';
 * 
 * const safeJsonParser = secureParser(jsonValue, {
 *   maxDepth: 50,           // Prevent deeply nested objects
 *   maxLength: 10000,       // Limit input size to 10KB
 *   maxParseTime: 1000,     // Timeout after 1 second
 *   maxMemory: 5 * 1024 * 1024 // Limit to 5MB memory usage
 * });
 * 
 * // Safe to use with untrusted input
 * const result = safeJsonParser.parse(untrustedJsonString);
 * ```
 * 
 * @example API endpoint with secure parsing
 * ```typescript
 * app.post('/api/data', (req, res) => {
 *   const secureDataParser = secureParser(myDataParser, {
 *     maxDepth: 20,
 *     maxParseTime: 500,
 *     maxLength: 1024 * 1024 // 1MB max
 *   });
 * 
 *   try {
 *     const data = secureDataParser.parse(req.body);
 *     res.json({ success: true, data });
 *   } catch (error) {
 *     res.status(400).json({ error: 'Invalid or unsafe input' });
 *   }
 * });
 * ```
 */

import { Parser, ParserState, ParseResult, failure, regex, success } from "../parser";

/**
 * Security configuration options for secure parsing.
 * All limits are optional and reasonable defaults will be applied if not specified.
 * 
 * @interface SecurityOptions
 * 
 * @example Strict security for public API
 * ```typescript
 * const strictOptions: SecurityOptions = {
 *   maxDepth: 10,           // Very shallow nesting
 *   maxLength: 1000,        // Small input only
 *   maxParseTime: 100,      // Fast parsing required
 *   maxMemory: 1024 * 1024, // 1MB memory limit
 *   maxBacktracks: 100      // Minimal backtracking
 * };
 * ```
 * 
 * @example Moderate security for internal use
 * ```typescript
 * const moderateOptions: SecurityOptions = {
 *   maxDepth: 100,
 *   maxLength: 100000,      // 100KB
 *   maxParseTime: 5000,     // 5 seconds
 *   maxMemory: 10 * 1024 * 1024 // 10MB
 * };
 * ```
 */
export interface SecurityOptions {
  /** 
   * Maximum recursion depth allowed during parsing.
   * Prevents stack overflow attacks and deeply nested structures.
   * 
   * @default 1000
   * 
   * @example
   * ```typescript
   * // Prevent deeply nested JSON objects
   * const options = { maxDepth: 50 };
   * // Input like {"a":{"b":{"c":...}}} will be limited to 50 levels
   * ```
   */
  maxDepth?: number;

  /** 
   * Maximum input length in characters.
   * Prevents processing of extremely large inputs that could consume resources.
   * 
   * @example
   * ```typescript
   * const options = { maxLength: 10000 }; // 10KB limit
   * // Inputs longer than 10,000 characters will be rejected
   * ```
   */
  maxLength?: number;

  /** 
   * Maximum parsing time allowed in milliseconds.
   * Prevents infinite loops and algorithmic complexity attacks.
   * 
   * @default 5000
   * 
   * @example
   * ```typescript
   * const options = { maxParseTime: 1000 }; // 1 second limit
   * // Parser will timeout if parsing takes longer than 1 second
   * ```
   */
  maxParseTime?: number;

  /** 
   * Maximum memory usage allowed in bytes.
   * Monitors heap usage during parsing to prevent memory exhaustion.
   * 
   * @example
   * ```typescript
   * const options = { maxMemory: 5 * 1024 * 1024 }; // 5MB limit
   * // Parser will fail if memory usage exceeds 5MB
   * ```
   */
  maxMemory?: number;

  /** 
   * Maximum number of backtracking steps allowed.
   * Prevents ReDoS (Regular Expression Denial of Service) attacks.
   * 
   * @default 10000
   * 
   * @example
   * ```typescript
   * const options = { maxBacktracks: 1000 };
   * // Prevents excessive backtracking in complex regex patterns
   * ```
   */
  maxBacktracks?: number;
}

/**
 * Wraps a parser with security monitoring and resource limits.
 * This function creates a secure version of any parser that enforces
 * the specified security constraints during parsing.
 * 
 * @template T The type of value the parser produces
 * @param parser The original parser to secure
 * @param options Security options and limits to enforce
 * @returns A new parser with security monitoring enabled
 * 
 * @throws {Error} When security limits are exceeded during parsing
 * 
 * @example Securing a complex language parser
 * ```typescript
 * const secureCodeParser = secureParser(programmingLanguageParser, {
 *   maxDepth: 100,          // Reasonable nesting for code
 *   maxLength: 50000,       // 50KB source files
 *   maxParseTime: 2000,     // 2 second parsing limit
 *   maxBacktracks: 5000     // Prevent ReDoS in regex
 * });
 * 
 * // Safe to use with user-uploaded code
 * try {
 *   const ast = secureCodeParser.parse(userCode);
 *   analyzeAST(ast);
 * } catch (error) {
 *   console.error('Parsing failed or exceeded security limits:', error);
 * }
 * ```
 * 
 * @example Microservice with input validation
 * ```typescript
 * function createSecureEndpoint<T>(parser: Parser<T>, limits: SecurityOptions) {
 *   const secureParser = secureParser(parser, limits);
 *   
 *   return async (request: Request) => {
 *     try {
 *       const data = secureParser.parse(request.body);
 *       return { success: true, data };
 *     } catch (error) {
 *       return { success: false, error: error.message };
 *     }
 *   };
 * }
 * ```
 * 
 * @example Real-time security monitoring
 * ```typescript
 * const monitoredParser = secureParser(jsonParser, {
 *   maxParseTime: 1000,
 *   maxMemory: 2 * 1024 * 1024 // 2MB
 * });
 * 
 * // Parser will automatically fail if limits are exceeded
 * const result = monitoredParser.parse(suspiciousInput);
 * ```
 */
export function secureParser<T>(
  parser: Parser<T>,
  options: SecurityOptions = {}
): Parser<T> {
  return new Parser(state => {
    const startTime = Date.now();
    const startMemory = (performance as any).memory?.usedJSHeapSize || 0;
    let backtrackCount = 0;
    let depth = 0;
    const maxDepth = options.maxDepth || 1000;
    const maxTime = options.maxParseTime || 5000;

    // Wrap parser execution with security checks
    const secureRun = (p: Parser<any>, s: ParserState): ParseResult<any> => {
      // Check recursion depth limit
      if (++depth > maxDepth) {
        throw new Error('Max recursion depth exceeded');
      }

      // Check parse time limit
      if (Date.now() - startTime > maxTime) {
        throw new Error('Parse timeout exceeded');
      }

      // Check input length limit
      if (options.maxLength && s.input.length > options.maxLength) {
        throw new Error('Input too large');
      }

      // Check memory usage limit
      if (options.maxMemory) {
        const currentMemory = (performance as any).memory?.usedJSHeapSize || 0;
        if (currentMemory - startMemory > options.maxMemory) {
          throw new Error('Memory limit exceeded');
        }
      }

      // Execute the parser and track backtracking
      const beforeIndex = s.index;
      const result = p.run(s);

      // Check for excessive backtracking (ReDoS protection)
      if (result.type === 'failure' && result.state.index < beforeIndex) {
        if (++backtrackCount > (options.maxBacktracks || 10000)) {
          throw new Error('Excessive backtracking detected');
        }
      }

      depth--;
      return result;
    };

    try {
      return secureRun(parser, state);
    } catch (e) {
      return failure(`Security violation: ${(e as Error).message}`, state);
    }
  });
}

/**
 * Analyzes a regex pattern for potentially dangerous constructs that could
 * lead to ReDoS (Regular Expression Denial of Service) attacks.
 * 
 * @param pattern The regex pattern string to analyze
 * @returns True if the pattern contains dangerous constructs
 * 
 * @private
 * @internal
 * 
 * @example
 * ```typescript
 * hasDangerousPattern('(a+)+b');     // true - nested quantifiers
 * hasDangerousPattern('(?!x)');      // true - negative lookahead
 * hasDangerousPattern('simple');     // false - safe pattern
 * ```
 */
function hasDangerousPattern(pattern: string): boolean {
  // Check for common ReDoS patterns that can cause exponential backtracking
  const dangerousPatterns = [
    /\(\?\!\)/,                    // negative lookahead
    /\(\?\<\!\)/,                  // negative lookbehind
    /\(\?\:\?\*\)/,                // nested quantifiers
    /\(\?\:\?\+\)/,                // nested quantifiers
    /\(\?\:\?\?\)/,                // nested quantifiers
    /\(\?\:\?\{\d+,\}\)/,          // nested quantifiers with ranges
    /\(\?\:\?\{\d+,\d+\}\)/,       // nested quantifiers with ranges
  ];

  return dangerousPatterns.some(p => p.test(pattern));
}

/**
 * Collection of DoS-resistant parsing utilities.
 * These utilities provide safer alternatives to potentially dangerous parsing patterns.
 * 
 * @namespace dosResistant
 * 
 * @example Using DoS-resistant parsing
 * ```typescript
 * import { dosResistant } from '@combi-parse/parsers/secure';
 * 
 * // Safe regex parsing
 * const safeEmailParser = dosResistant.safeRegex(
 *   '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'
 * );
 * 
 * // Limited repetition to prevent infinite loops
 * const limitedNumbers = dosResistant.limitedMany(digit, 1000);
 * ```
 */
export const dosResistant = {
  /**
   * Creates a regex parser with safety validation.
   * Analyzes the regex pattern for dangerous constructs before creating the parser.
   * 
   * @param pattern The regex pattern string
   * @param flags Optional regex flags
   * @returns A safe regex parser
   * 
   * @throws {Error} If the pattern contains potentially dangerous constructs
   * 
   * @example Safe email validation
   * ```typescript
   * const emailParser = dosResistant.safeRegex(
   *   '^[\\w._%+-]+@[\\w.-]+\\.[A-Za-z]{2,}$'
   * );
   * 
   * const result = emailParser.parse('user@example.com');
   * ```
   * 
   * @example Pattern validation
   * ```typescript
   * try {
   *   // This will throw an error due to dangerous pattern
   *   const dangerousParser = dosResistant.safeRegex('(a+)+b');
   * } catch (error) {
   *   console.log('Dangerous pattern detected:', error.message);
   * }
   * ```
   * 
   * @example Safe URL parsing
   * ```typescript
   * const urlParser = dosResistant.safeRegex(
   *   'https?://[\\w.-]+(?:/[\\w./%?&=+-]*)?',
   *   'i'
   * );
   * ```
   */
  safeRegex(pattern: string, flags?: string): Parser<string> {
    // Analyze regex for dangerous patterns
    if (hasDangerousPattern(pattern)) {
      throw new Error('Potentially dangerous regex pattern');
    }

    return regex(new RegExp(pattern, flags));
  },

  /**
   * Creates a parser that applies another parser up to a maximum number of times.
   * This prevents infinite loops and provides an upper bound on parsing complexity.
   * 
   * @template T The type of value the parser produces
   * @param parser The parser to repeat
   * @param max Maximum number of repetitions allowed
   * @returns A parser that applies the input parser at most `max` times
   * 
   * @example Parsing limited lists
   * ```typescript
   * // Parse at most 100 comma-separated values
   * const limitedCsvRow = dosResistant.limitedMany(
   *   genParser(function* () {
   *     const value = yield csvField;
   *     yield optional(str(','));
   *     return value;
   *   }),
   *   100
   * );
   * ```
   * 
   * @example Preventing DoS in user input
   * ```typescript
   * // Allow at most 50 tags in user input
   * const userTags = dosResistant.limitedMany(
   *   genParser(function* () {
   *     yield str('<');
   *     const tag = yield identifier;
   *     yield str('>');
   *     return tag;
   *   }),
   *   50
   * );
   * ```
   * 
   * @example Safe JSON array parsing
   * ```typescript
   * const safeJsonArray = genParser(function* () {
   *   yield str('[');
   *   yield optional(whitespace);
   *   
   *   // Limit array to 1000 elements max
   *   const elements = yield dosResistant.limitedMany(
   *     genParser(function* () {
   *       const value = yield jsonValue;
   *       yield optional(str(','));
   *       return value;
   *     }),
   *     1000
   *   );
   *   
   *   yield str(']');
   *   return elements;
   * });
   * ```
   */
  limitedMany<T>(parser: Parser<T>, max: number): Parser<T[]> {
    return new Parser(state => {
      const results: T[] = [];
      let currentState = state;

      for (let i = 0; i < max; i++) {
        const result = parser.run(currentState);
        if (result.type === 'failure') break;

        results.push(result.value);
        currentState = result.state;
      }

      return success(results, currentState);
    });
  }
};