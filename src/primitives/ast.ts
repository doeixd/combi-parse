/**
 * @fileoverview Abstract Syntax Tree (AST) Construction Utilities
 * 
 * This module provides type-safe utilities for constructing Abstract Syntax Trees
 * during parsing. It implements the semantic analysis phase of parsing by providing
 * combinators that transform parsed syntax into structured tree representations.
 * 
 * The AST construction approach separates syntactic parsing from semantic tree building,
 * allowing for clean separation of concerns. Parsers handle the recognition of
 * syntactic patterns, while AST builders ensure the resulting data structures
 * are well-typed and semantically meaningful.
 * 
 * This follows the classical compiler design pattern where parsing produces a
 * structured intermediate representation that can be easily processed by
 * subsequent compiler phases (type checking, optimization, code generation).
 * 
 * @example
 * ```typescript
 * // Define AST node types
 * interface BinaryExpression {
 *   type: 'binary';
 *   operator: '+' | '-' | '*' | '/';
 *   left: Expression;
 *   right: Expression;
 * }
 * 
 * // Create type-safe AST builders
 * const binaryExpr = ast<BinaryExpression>('binary')(
 *   sequence([
 *     expression,
 *     operator,
 *     expression
 *   ], ([left, operator, right]) => ({ operator, left, right }))
 * );
 * ```
 */

import { Parser } from '../parser';

/**
 * Base interface for AST expression nodes.
 * 
 * All expression nodes must have a type discriminator to enable
 * pattern matching and type-safe processing in later compiler phases.
 */
export interface Expression {
  /** Discriminant field for pattern matching on expression types */
  type: string;
}

/**
 * Base interface for AST statement nodes.
 * 
 * All statement nodes must have a type discriminator to enable
 * pattern matching and type-safe processing in later compiler phases.
 */
export interface Statement {
  /** Discriminant field for pattern matching on statement types */
  type: string;
}

/**
 * Creates a type-safe AST node builder function.
 * 
 * This is a higher-order function that takes a node type and returns a function
 * that can wrap any parser to automatically add the type field to parsed results.
 * This ensures all AST nodes have the required discriminant field while maintaining
 * full type safety.
 * 
 * The resulting parser will combine the provided type with the properties parsed
 * by the input parser, creating a complete AST node.
 * 
 * @template T The complete AST node type including the type field
 * @param type The value for the type discriminant field
 * @returns A function that takes a parser and returns an AST-building parser
 * 
 * @example
 * ```typescript
 * // Define a binary expression AST node
 * interface BinaryExpr {
 *   type: 'binary';
 *   operator: string;
 *   left: Expression;
 *   right: Expression;
 * }
 * 
 * // Create the AST builder
 * const binaryExpr = ast<BinaryExpr>('binary');
 * 
 * // Use with a parser that provides the remaining properties
 * const parser = binaryExpr(
 *   sequence([term, operator, term], ([left, op, right]) => ({
 *     operator: op,
 *     left,
 *     right
 *   }))
 * );
 * ```
 * 
 * @example
 * ```typescript
 * // Define statement types
 * interface IfStatement {
 *   type: 'if';
 *   condition: Expression;
 *   then: Statement;
 *   else?: Statement;
 * }
 * 
 * // Create type-safe builder
 * const ifStmt = ast<IfStatement>('if')(
 *   sequence([
 *     str('if').keepRight(whitespace),
 *     expression,
 *     str('then').keepRight(whitespace),
 *     statement,
 *     optional(str('else').keepRight(whitespace).keepRight(statement))
 *   ], ([condition, then, else_]) => ({ condition, then, else: else_ }))
 * );
 * ```
 */
export function ast<T extends Record<string, any>>(
  type: T['type']
): <P extends Omit<T, 'type'>>(parser: Parser<P>) => Parser<T> {
  return <P extends Omit<T, 'type'>>(parser: Parser<P>) => 
    parser.map((props: P) => ({ type, ...props } as unknown as T));
}
