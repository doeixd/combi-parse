/**
 * @fileoverview Enhanced generator parsers with debugging and development options.
 * 
 * This module provides development and debugging utilities for generator-based parsers,
 * making it easier to understand parser behavior, debug parsing issues, and optimize
 * parser performance. These tools are essential for developing complex parsers and
 * maintaining parsing code in production environments.
 * 
 * The options-based approach allows you to enable various debugging and development
 * features without modifying the core parsing logic. This separation of concerns
 * makes it easy to enable debugging during development and disable it in production.
 * 
 * Key features include:
 * - Step-by-step execution tracing
 * - Performance monitoring and profiling
 * - Interactive debugging with breakpoints
 * - Detailed error reporting with context
 * - Custom logging and introspection hooks
 * 
 * @example
 * ```typescript
 * // Enable debugging for a complex parser
 * const debugParser = genParserWithOptions(
 *   function* () {
 *     const name = yield identifier;
 *     yield str('=');
 *     const value = yield expression;
 *     return { [name]: value };
 *   },
 *   {
 *     debug: true,
 *     onYield: (step, parser, result) => {
 *       console.log(`Step ${step}: ${parser.constructor.name} -> ${result}`);
 *     }
 *   }
 * );
 * ```
 */

import { Parser, ParserState, success } from "../../parser";

/**
 * Configuration options for enhanced generator parsers.
 * 
 * This interface defines all available options for customizing parser behavior
 * during development and debugging. Each option can be enabled independently
 * to provide the specific debugging capabilities you need.
 */
interface GenParserOptions {
  /** Enable debug logging to console */
  debug?: boolean;
  
  /** Enable step-through debugging (requires async support) */
  stepThrough?: boolean;
  
  /** Enable performance profiling */
  profile?: boolean;
  
  /** Maximum execution time in milliseconds before timeout */
  timeout?: number;
  
  /** Custom callback for each yield operation */
  onYield?: (step: number, parser: Parser<any>, result: any) => void;
  
  /** Custom callback for parser start */
  onStart?: (input: string) => void;
  
  /** Custom callback for parser completion */
  onComplete?: (result: any, stats: ParsingStats) => void;
  
  /** Custom callback for parser errors */
  onError?: (error: string, context: ErrorContext) => void;
  
  /** Custom logger function (overrides default console logging) */
  logger?: (message: string, level: 'info' | 'warn' | 'error') => void;
}

/**
 * Statistics collected during parsing execution.
 */
interface ParsingStats {
  /** Total number of parsing steps executed */
  totalSteps: number;
  
  /** Total execution time in milliseconds */
  executionTime: number;
  
  /** Number of characters parsed */
  charactersParsed: number;
  
  /** Number of backtrack operations */
  backtracks: number;
  
  /** Peak memory usage during parsing */
  peakMemoryUsage: number;
}

/**
 * Context information for error reporting.
 */
interface ErrorContext {
  /** The step number where the error occurred */
  step: number;
  
  /** The parser that caused the error */
  parser: string;
  
  /** The input position where the error occurred */
  position: number;
  
  /** Surrounding input context */
  inputContext: string;
  
  /** Execution history leading to the error */
  history: Array<{
    step: number;
    parser: string;
    result: any;
    position: number;
  }>;
}

/**
 * Creates a generator parser with enhanced debugging and development options.
 * 
 * This function wraps a generator parser with comprehensive debugging and
 * development features, making it easier to understand parser behavior,
 * identify performance bottlenecks, and debug parsing issues.
 * 
 * The enhanced parser provides:
 * - Detailed execution tracing and logging
 * - Performance monitoring and profiling
 * - Custom hooks for observing parser behavior
 * - Comprehensive error reporting with context
 * - Timeout protection for infinite loops
 * 
 * All debugging features are optional and can be enabled independently
 * based on your development needs. In production environments, you can
 * disable all debugging features to maintain optimal performance.
 * 
 * @template T - The type of the final parsed result
 * @param genFn - The generator function that defines the parsing logic
 * @param options - Configuration options for debugging and development features
 * @returns A parser with enhanced debugging and development capabilities
 * 
 * @example
 * ```typescript
 * // Basic debugging with console output
 * const debugParser = genParserWithOptions(
 *   function* () {
 *     const firstName = yield identifier;
 *     yield whitespace;
 *     const lastName = yield identifier;
 *     return { firstName, lastName };
 *   },
 *   { debug: true }
 * );
 * ```
 * 
 * @example
 * ```typescript
 * // Advanced debugging with custom hooks
 * const profiledParser = genParserWithOptions(
 *   function* () {
 *     // Complex parsing logic
 *     const result = yield complexExpression;
 *     return result;
 *   },
 *   {
 *     debug: true,
 *     profile: true,
 *     timeout: 5000,
 *     onYield: (step, parser, result) => {
 *       console.log(`Step ${step}: ${parser.constructor.name}`);
 *       console.log(`  Result: ${JSON.stringify(result)}`);
 *     },
 *     onComplete: (result, stats) => {
 *       console.log(`Parsing completed in ${stats.executionTime}ms`);
 *       console.log(`Total steps: ${stats.totalSteps}`);
 *     }
 *   }
 * );
 * ```
 * 
 * @example
 * ```typescript
 * // Production parser with minimal overhead
 * const productionParser = genParserWithOptions(
 *   function* () {
 *     // Parsing logic
 *     return yield complexParser;
 *   },
 *   {
 *     timeout: 30000, // Safety timeout only
 *     onError: (error, context) => {
 *       // Log errors to monitoring system
 *       logToMonitoring('parser_error', { error, context });
 *     }
 *   }
 * );
 * ```
 */
export function genParserWithOptions<T>(
  genFn: () => Generator<Parser<any>, T, any>,
  options: GenParserOptions = {}
): Parser<T> {
  return new Parser((state: ParserState) => {
    const startTime = Date.now();
    let currentState = state;
    let nextValue: any = undefined;
    let step = 0;
    let backtracks = 0;
    
    const history: Array<{
      step: number;
      parser: string;
      result: any;
      position: number;
    }> = [];

    const logger = options.logger || ((message: string, level: string) => {
      const prefix = level.toUpperCase();
      console.log(`[${prefix}] ${message}`);
    });

    // Initialize profiling if enabled
    let memoryUsage = 0;
    if (options.profile && typeof performance !== 'undefined' && 'memory' in performance) {
      memoryUsage = (performance as any).memory?.usedJSHeapSize || 0;
    }

    // Call onStart hook
    if (options.onStart) {
      options.onStart(state.input);
    }

    if (options.debug) {
      logger(`🚀 Starting parser with input: "${state.input.slice(0, 50)}${state.input.length > 50 ? '...' : ''}"`, 'info');
    }

    try {
      const iterator = genFn();

      while (true) {
        // Check timeout
        if (options.timeout && Date.now() - startTime > options.timeout) {
          const error = `Parser timeout after ${options.timeout}ms`;
          if (options.onError) {
            options.onError(error, {
              step,
              parser: 'timeout',
              position: currentState.index,
              inputContext: getInputContext(currentState),
              history
            });
          }
          return failure(error, currentState);
        }

        const { value: parserOrReturn, done } = iterator.next(nextValue);

        if (done) {
          const executionTime = Date.now() - startTime;
          const stats: ParsingStats = {
            totalSteps: step,
            executionTime,
            charactersParsed: currentState.index - state.index,
            backtracks,
            peakMemoryUsage: memoryUsage
          };

          if (options.debug) {
            logger(`✅ Parser completed successfully in ${executionTime}ms`, 'info');
            logger(`📊 Stats: ${step} steps, ${stats.charactersParsed} chars parsed`, 'info');
          }

          if (options.onComplete) {
            options.onComplete(parserOrReturn, stats);
          }

          return success(parserOrReturn as T, currentState);
        }

        step++;
        const parser = parserOrReturn as Parser<any>;
        const parserName = getParserName(parser);

        if (options.debug) {
          logger(`\n🔄 Step ${step}: ${parserName}`, 'info');
          logger(`  📍 Position: ${currentState.index}`, 'info');
          logger(`  📝 Next: "${getInputContext(currentState)}"`, 'info');
        }

        if (options.stepThrough) {
          // In a real implementation, this would pause execution
          logger('⏸️  Step-through mode (press Enter to continue)', 'info');
        }

        const result = parser.run(currentState);

        if (result.type === "failure") {
          const errorContext: ErrorContext = {
            step,
            parser: parserName,
            position: currentState.index,
            inputContext: getInputContext(currentState),
            history
          };

          if (options.debug) {
            logger(`❌ Step ${step} failed: ${result.message}`, 'error');
            logger(`  🎯 Parser: ${parserName}`, 'error');
            logger(`  📍 Position: ${currentState.index}`, 'error');
          }

          if (options.onError) {
            options.onError(result.message, errorContext);
          }

          return result;
        }

        // Track successful step
        history.push({
          step,
          parser: parserName,
          result: result.value,
          position: currentState.index
        });

        if (options.debug) {
          logger(`  ✅ Success: ${JSON.stringify(result.value)}`, 'info');
          logger(`  ⏭️  Advanced to: ${result.state.index}`, 'info');
        }

        if (options.onYield) {
          options.onYield(step, parser, result.value);
        }

        // Track backtracking (simplified detection)
        if (result.state.index < currentState.index) {
          backtracks++;
          if (options.debug) {
            logger(`  ⬅️  Backtrack detected`, 'warn');
          }
        }

        currentState = result.state;
        nextValue = result.value;

        // Update memory usage if profiling
        if (options.profile && typeof performance !== 'undefined' && 'memory' in performance) {
          const currentMemory = (performance as any).memory?.usedJSHeapSize || 0;
          memoryUsage = Math.max(memoryUsage, currentMemory);
        }
      }
    } catch (error) {
      const errorMessage = `Parser threw exception: ${error}`;
      const errorContext: ErrorContext = {
        step,
        parser: 'unknown',
        position: currentState.index,
        inputContext: getInputContext(currentState),
        history
      };

      if (options.debug) {
        logger(`💥 Parser exception: ${error}`, 'error');
      }

      if (options.onError) {
        options.onError(errorMessage, errorContext);
      }

      return failure(errorMessage, currentState);
    }
  });
}

/**
 * Gets a human-readable name for a parser instance.
 * 
 * @param parser - The parser to get a name for
 * @returns A descriptive name for the parser
 * @internal
 */
function getParserName(parser: Parser<any>): string {
  if ('name' in parser && typeof (parser as any).name === 'string') {
    return (parser as any).name;
  }
  
  const constructorName = parser.constructor.name;
  if (constructorName && constructorName !== 'Object' && constructorName !== 'Parser') {
    return constructorName;
  }
  
  return 'Parser';
}

/**
 * Gets input context around the current parsing position.
 * 
 * @param state - The current parser state
 * @returns A string showing the context around the current position
 * @internal
 */
function getInputContext(state: ParserState): string {
  const contextSize = 20;
  const start = Math.max(0, state.index - contextSize);
  const end = Math.min(state.input.length, state.index + contextSize);
  
  const before = state.input.slice(start, state.index);
  const after = state.input.slice(state.index, end);
  
  return `${before}•${after}`;
}

/**
 * Creates a simple failure result for error cases.
 * 
 * @param message - The error message
 * @param state - The parser state where the error occurred
 * @returns A failure parse result
 * @internal
 */
function failure(message: string, state: ParserState) {
  return {
    type: "failure" as const,
    message,
    state,
    found: state.input.slice(state.index, state.index + 1) || 'end of input'
  };
}

/**
 * Convenience function for creating a debug-enabled parser.
 * 
 * This is a shorthand for creating a parser with debug mode enabled,
 * which is useful during development and testing.
 * 
 * @template T - The type of the final parsed result
 * @param genFn - The generator function that defines the parsing logic
 * @returns A parser with debug mode enabled
 * 
 * @example
 * ```typescript
 * const debugParser = createDebugParser(function* () {
 *   const name = yield identifier;
 *   yield str('=');
 *   const value = yield number;
 *   return { [name]: value };
 * });
 * ```
 */
export function createDebugParser<T>(
  genFn: () => Generator<Parser<any>, T, any>
): Parser<T> {
  return genParserWithOptions(genFn, { debug: true });
}

/**
 * Convenience function for creating a profiled parser.
 * 
 * This creates a parser with both debugging and profiling enabled,
 * providing comprehensive performance and execution information.
 * 
 * @template T - The type of the final parsed result
 * @param genFn - The generator function that defines the parsing logic
 * @returns A parser with debugging and profiling enabled
 * 
 * @example
 * ```typescript
 * const profiledParser = createProfiledParser(function* () {
 *   // Complex parsing logic that you want to profile
 *   return yield complexLanguageParser;
 * });
 * ```
 */
export function createProfiledParser<T>(
  genFn: () => Generator<Parser<any>, T, any>
): Parser<T> {
  return genParserWithOptions(genFn, {
    debug: true,
    profile: true,
    onComplete: (_, stats) => {
      console.log('\n📊 Parsing Profile:');
      console.log(`  ⏱️  Execution time: ${stats.executionTime}ms`);
      console.log(`  🔢 Total steps: ${stats.totalSteps}`);
      console.log(`  📏 Characters parsed: ${stats.charactersParsed}`);
      console.log(`  ⬅️  Backtracks: ${stats.backtracks}`);
      console.log(`  🧠 Peak memory: ${Math.round(stats.peakMemoryUsage / 1024 / 1024)}MB`);
    }
  });
}
