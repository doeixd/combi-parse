/**
 * @fileoverview Parser Primitives Module Index
 * 
 * This module serves as the entry point for all primitive parser utilities and
 * advanced combinators. It consolidates the foundational building blocks that
 * extend the basic parser combinator functionality with sophisticated features
 * like algebraic operations, AST construction, debugging tools, grammar analysis,
 * parallel execution, pattern matching, error recovery, and comprehensive testing.
 * 
 * These primitives form the advanced layer of the parsing system, providing
 * the tools necessary for building production-quality parsers with features
 * like optimization, debugging, and robust error handling.
 * 
 * The primitives are organized into several categories:
 * - **Algebraic Operations**: Set-theoretic operations on parsers (intersection, difference, etc.)
 * - **AST Construction**: Type-safe utilities for building abstract syntax trees
 * - **Debugging Tools**: Interactive debugging and visualization capabilities
 * - **Grammar Analysis**: Static analysis and automatic optimization
 * - **Parallel Execution**: Multi-threaded and asynchronous parsing utilities
 * - **Pattern Matching**: Advanced pattern recognition and literal matching
 * - **Error Recovery**: Robust error handling and recovery mechanisms
 * - **Testing Utilities**: Property-based testing, fuzzing, and differential testing
 * 
 * @example
 * ```typescript
 * import { 
 *   ParserAlgebra, 
 *   ast, 
 *   ParserDebugger, 
 *   optimizeParser,
 *   ParserTester 
 * } from './primitives';
 * 
 * // Create a robust, optimized parser
 * const baseParser = createMyGrammar();
 * const optimized = optimizeParser(baseParser);
 * 
 * // Add debugging capabilities
 * const debugger = new ParserDebugger(optimized);
 * 
 * // Test thoroughly
 * const tester = new ParserTester(optimized);
 * const results = await tester.fuzz({ iterations: 1000 });
 * ```
 */

// Algebraic operations for advanced parser combinators
export * from './algebra';

// AST construction utilities for semantic analysis
export * from './ast';

// Debugging and visualization tools
export * from './debug';

// Grammar analysis and optimization
export * from './grammar';

// Parallel and asynchronous parsing capabilities
export * from './parallel-choice';

// Advanced pattern matching and recognition
export * from './pattern';

// Error recovery and robust parsing
export * from './recover';

// Comprehensive testing utilities
export * from './testing';

// Type-safe regex combinator with compile-time pattern analysis
export * from './regex-combinator';
