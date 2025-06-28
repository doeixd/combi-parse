/**
 * @fileoverview Error Recovery and Robust Parsing
 * 
 * This module provides sophisticated error recovery mechanisms that enable parsers
 * to continue parsing after encountering errors. The new API separates concerns
 * between required terminators (success case) and error recovery (failure case)
 * to eliminate ambiguous behavior and provide explicit control over consumption.
 * 
 * The recovery approach is based on synchronization points - specific tokens or
 * patterns that can be used to resynchronize the parser after an error occurs.
 * When a parse error happens, the recovery mechanism skips forward in the input
 * until it finds a known synchronization point, then resumes parsing from there.
 * 
 * @example
 * ```typescript
 * // Parse CSS properties with required terminators
 * const cssProperty = terminated(
 *   sequence([identifier, str(':'), cssValue]),
 *   str(';')
 * );
 * 
 * // Parse with error recovery that positions at delimiter
 * const arrayElement = recover(numberParser, {
 *   patterns: str(','),
 *   fallback: null,
 *   strategy: 'consume'
 * });
 * ```
 */

import { Parser, success, failure } from "../parser";

/**
 * Configuration for error recovery behavior
 */
export interface RecoveryConfig<T> {
    /** What pattern(s) to look for when recovering */
    patterns: Parser<any> | Parser<any>[];

    /** What to return on recovery */
    fallback: T;

    /** How to handle the recovery pattern when found */
    strategy: 'consume' | 'position' | 'optional';

    /** What to do when primary parser succeeds */
    onSuccess?: 'ignore' | 'requirePattern' | 'optionalPattern';
}

/**
 * Creates a parser that requires a terminator when successful.
 * 
 * This function is for parsing constructs that must end with a specific
 * delimiter or terminator. The terminator is always consumed when the
 * primary parser succeeds.
 * 
 * @template T The type of value the primary parser produces
 * @param parser The primary parser to attempt
 * @param terminator Parser that defines the required terminator
 * @returns A parser that requires the terminator on success
 * 
 * @example
 * ```typescript
 * // CSS properties must end with semicolon
 * const cssProperty = terminated(
 *   sequence([identifier, str(':'), cssValue]),
 *   str(';')
 * );
 * 
 * // Statements must end with semicolon
 * const statement = terminated(
 *   expressionStatement,
 *   str(';')
 * );
 * ```
 */
export function terminated<T>(
    parser: Parser<T>,
    terminator: Parser<any>
): Parser<T> {
    return new Parser(state => {
        const result = parser.run(state);

        if (result.type === 'success') {
            const terminatorResult = terminator.run(result.state);
            if (terminatorResult.type === 'success') {
                return success(result.value, terminatorResult.state);
            } else {
                return failure(`Expected terminator after successful parse at position ${result.state.index}`, result.state);
            }
        }

        return result;
    });
}

/**
 * Creates a parser with explicit error recovery configuration.
 * 
 * This function provides fine-grained control over error recovery behavior,
 * separating concerns between what happens on success vs failure and how
 * recovery patterns should be handled.
 * 
 * @template T The type of value the primary parser produces
 * @param parser The primary parser to attempt
 * @param config Recovery configuration object
 * @returns A parser with configured error recovery
 * 
 * @example
 * ```typescript
 * // Simple recovery that consumes delimiter
 * const arrayElement = recover(numberParser, {
 *   patterns: str(','),
 *   fallback: null,
 *   strategy: 'consume'
 * });
 * 
 * // Nested recovery that doesn't interfere with outer parsers
 * const nestedParser = recover(innerParser, {
 *   patterns: str(')'),
 *   fallback: 'error',
 *   strategy: 'position',  // Position at ) but don't consume
 *   onSuccess: 'ignore'    // Don't look for ) when successful
 * });
 * 
 * // Recovery with optional pattern matching on success
 * const flexible = recover(primary, {
 *   patterns: [str(';'), str('\n')],
 *   fallback: 'error',
 *   strategy: 'consume',
 *   onSuccess: 'optionalPattern'  // Consume delimiter if present
 * });
 * ```
 */
export function recover<T>(
    parser: Parser<T>,
    config: RecoveryConfig<T>
): Parser<T> {
    const patterns = Array.isArray(config.patterns) ? config.patterns : [config.patterns];

    return new Parser(state => {
        const result = parser.run(state);

        if (result.type === 'success') {
            // Handle success case based on onSuccess configuration
            if (config.onSuccess === 'ignore') {
                return result;
            }

            if (config.onSuccess === 'requirePattern') {
                // Must find and consume pattern
                for (const pattern of patterns) {
                    const patternResult = pattern.run(result.state);
                    if (patternResult.type === 'success') {
                        return success(result.value, patternResult.state);
                    }
                }
                return failure(`Expected recovery pattern after successful parse at position ${result.state.index}`, result.state);
            }

            if (config.onSuccess === 'optionalPattern') {
                // Try to find and consume pattern, but don't require it
                for (const pattern of patterns) {
                    const patternResult = pattern.run(result.state);
                    if (patternResult.type === 'success') {
                        switch (config.strategy) {
                            case 'consume':
                                return success(result.value, patternResult.state);
                            case 'position':
                                return success(result.value, result.state);
                            case 'optional':
                                return success(result.value, patternResult.state);
                        }
                    }
                }
                return result; // No pattern found, return original success
            }

            // Default behavior (onSuccess not specified) - return original success
            return result;
        }

        // Primary parser failed - try to recover by finding synchronization point
        let currentState = state;
        while (currentState.index < currentState.input.length) {
            for (const pattern of patterns) {
                const recoveryResult = pattern.run(currentState);

                if (recoveryResult.type === 'success') {
                    switch (config.strategy) {
                        case 'consume':
                            return success(config.fallback, recoveryResult.state);
                        case 'position':
                            return success(config.fallback, currentState);
                        case 'optional':
                            return success(config.fallback, recoveryResult.state);
                    }
                }
            }

            currentState = { ...currentState, index: currentState.index + 1 };
        }

        return result; // Return original failure if no recovery point found
    });
}

/**
 * Context for local and global recovery patterns
 */
export interface RecoveryContext<T> {
    pattern: Parser<any>;
    fallback: T;
    consume?: boolean;
}

/**
 * Creates a parser with contextual recovery for nested parsing scenarios.
 * 
 * This function handles complex nested recovery where different levels of
 * the parse tree may need different recovery strategies. It provides both
 * local (immediate context) and global (outer context) recovery patterns.
 * 
 * @template T The type of value the primary parser produces
 * @param parser The primary parser to attempt
 * @param local Local recovery context for immediate failures
 * @param global Optional global recovery context for outer failures
 * @returns A parser with hierarchical error recovery
 * 
 * @example
 * ```typescript
 * // Complex nested recovery
 * const complexNested = recoverWithContext(
 *   innerParser,
 *   { pattern: str(')'), fallback: 'inner_error', consume: false },
 *   { pattern: str(';'), fallback: 'outer_error', consume: true }
 * );
 * 
 * // Function parameter recovery with local and global context
 * const parameterList = recoverWithContext(
 *   parameter,
 *   { pattern: str(','), fallback: 'param_error', consume: true },
 *   { pattern: str(')'), fallback: 'params_error', consume: false }
 * );
 * ```
 */
export function recoverWithContext<T>(
    parser: Parser<T>,
    local: RecoveryContext<T>,
    global?: RecoveryContext<T>
): Parser<T> {
    return new Parser(state => {
        const result = parser.run(state);

        if (result.type === 'success') {
            return result;
        }

        // Try local recovery first
        let currentState = state;
        while (currentState.index < currentState.input.length) {
            const localResult = local.pattern.run(currentState);

            if (localResult.type === 'success') {
                const nextState = (local.consume !== false) ? localResult.state : currentState;
                return success(local.fallback, nextState);
            }

            // If global recovery is configured, try it too
            if (global) {
                const globalResult = global.pattern.run(currentState);
                if (globalResult.type === 'success') {
                    const nextState = (global.consume !== false) ? globalResult.state : currentState;
                    return success(global.fallback, nextState);
                }
            }

            currentState = { ...currentState, index: currentState.index + 1 };
        }

        return result; // Return original failure if no recovery point found
    });
}

// Legacy recover function for backward compatibility
export function legacyRecover<T>(
    parser: Parser<T>,
    recovery: Parser<any>,
    fallback: T
): Parser<T> {
    return recover(parser, {
        patterns: recovery,
        fallback,
        strategy: 'consume',
        onSuccess: 'optionalPattern'
    });
}
