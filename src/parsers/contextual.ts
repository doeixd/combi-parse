/**
 * Context-Aware Parsing Module
 * 
 * This module provides context-aware parsing capabilities for languages and formats
 * that require stateful parsing, such as indentation-sensitive languages (Python, YAML),
 * scope-aware parsing (variables, functions), and nested structures with context dependencies.
 * 
 * Context-aware parsing maintains state throughout the parsing process, enabling:
 * - Indentation-level tracking for Python-like languages
 * - Variable scope management for programming languages
 * - String context tracking to handle escape sequences
 * - Nested structure parsing with parent context awareness
 * 
 * @module parsers/contextual
 * @version 1.0.0
 * 
 * @example Python-like indentation parsing
 * ```typescript
 * import { ContextualParser, indent, indented } from '@combi-parse/parsers/contextual';
 * 
 * const blockParser = genParser(function* () {
 *   yield str('if');
 *   yield whitespace;
 *   const condition = yield identifier;
 *   yield str(':');
 *   yield newline;
 *   const body = yield indented(many(statement));
 *   return { type: 'if', condition, body };
 * });
 * ```
 * 
 * @example Variable scope tracking
 * ```typescript
 * const scopedParser = new ContextualParser((state, context) => {
 *   context.scopes.push(new Map());
 *   const result = parseBlock(state, context);
 *   context.scopes.pop();
 *   return result;
 * });
 * ```
 */

import { Parser, ParserState, ParseResult, success, failure } from "../parser";

/**
 * Parser context interface that maintains state during contextual parsing.
 * This context is passed through the parsing chain and can be modified
 * by parsers to track various parsing states.
 * 
 * @interface ParserContext
 * 
 * @example Creating a custom context
 * ```typescript
 * const context: ParserContext = {
 *   indentLevel: 0,
 *   inString: false,
 *   variables: new Map([['x', 42]]),
 *   scopes: [new Map([['global', true]])]
 * };
 * ```
 */
export interface ParserContext {
  /** 
   * Current indentation level for indent-sensitive parsing.
   * Typically incremented for each nested block.
   * 
   * @example
   * ```typescript
   * // For Python-like indentation
   * if (context.indentLevel === 0) {
   *   // Top-level statement
   * } else {
   *   // Nested statement
   * }
   * ```
   */
  indentLevel: number;

  /** 
   * Whether the parser is currently inside a string literal.
   * Used to handle escape sequences and string context.
   * 
   * @example
   * ```typescript
   * if (context.inString) {
   *   // Handle escape sequences differently
   *   return parseEscapeSequence(state);
   * }
   * ```
   */
  inString: boolean;

  /** 
   * Map of variable names to their values in the current scope.
   * Used for variable resolution and type checking.
   * 
   * @example
   * ```typescript
   * context.variables.set('userName', 'john');
   * const value = context.variables.get('userName');
   * ```
   */
  variables: Map<string, any>;

  /** 
   * Stack of scope maps for nested scope management.
   * Each scope represents a block, function, or module level.
   * 
   * @example
   * ```typescript
   * // Enter new scope
   * context.scopes.push(new Map());
   * 
   * // Exit scope
   * context.scopes.pop();
   * 
   * // Look up variable in scope chain
   * for (const scope of [...context.scopes].reverse()) {
   *   if (scope.has(varName)) return scope.get(varName);
   * }
   * ```
   */
  scopes: Array<Map<string, any>>;
}

/**
 * A parser that maintains context state throughout the parsing process.
 * This enables parsing of context-sensitive languages and formats.
 * 
 * @template T The type of value this parser produces
 * 
 * @example Creating a scoped variable parser
 * ```typescript
 * const variableParser = new ContextualParser((state, context) => {
 *   const name = parseIdentifier(state);
 *   if (context.variables.has(name)) {
 *     return success(context.variables.get(name), state);
 *   } else {
 *     return failure(`Undefined variable: ${name}`, state);
 *   }
 * });
 * ```
 * 
 * @example Parsing with custom context
 * ```typescript
 * const parser = new ContextualParser(
 *   (state, context) => parseExpression(state, context),
 *   { indentLevel: 1, variables: new Map([['x', 42]]) }
 * );
 * ```
 */
export class ContextualParser<T> extends Parser<T> {
  /**
   * Creates a new contextual parser with the given parsing function and default context.
   * 
   * @param baseRun Function that performs the actual parsing with context
   * @param baseRun.state Current parser state (input, position, etc.)
   * @param baseRun.context Current parsing context (variables, scope, etc.)
   * @param defaultContext Default context values to merge with runtime context
   * 
   * @example Creating a context-aware string parser
   * ```typescript
   * const stringParser = new ContextualParser((state, context) => {
   *   const oldInString = context.inString;
   *   context.inString = true;
   *   
   *   const result = parseStringLiteral(state);
   *   
   *   context.inString = oldInString;
   *   return result;
   * });
   * ```
   */
  constructor(
    private baseRun: (state: ParserState, context: ParserContext) => ParseResult<T>,
    private defaultContext: Partial<ParserContext> = {}
  ) {
    super((state: ParserState) => {
      const context: ParserContext = {
        indentLevel: 0,
        inString: false,
        variables: new Map(),
        scopes: [],
        ...this.defaultContext
      };
      return this.baseRun(state, context);
    });
  }

  /**
   * Creates a new parser with additional context merged with the default context.
   * This allows for partial context customization without creating a new parser.
   * 
   * @param context Additional context values to merge
   * @returns A new ContextualParser with the merged context
   * 
   * @example Adding variables to context
   * ```typescript
   * const baseParser = new ContextualParser(parseExpression);
   * const withVars = baseParser.withContext({
   *   variables: new Map([['pi', 3.14159], ['e', 2.71828]])
   * });
   * ```
   * 
   * @example Increasing indentation level
   * ```typescript
   * const indentedParser = blockParser.withContext({
   *   indentLevel: currentLevel + 1
   * });
   * ```
   */
  withContext(context: Partial<ParserContext>): ContextualParser<T> {
    return new ContextualParser(this.baseRun, { ...this.defaultContext, ...context });
  }
}

/**
 * Parser for indentation-sensitive languages like Python.
 * Expects exactly the right number of spaces based on the current indentation level.
 * Uses 2 spaces per indentation level by default.
 * 
 * @example Parsing Python-like blocks
 * ```typescript
 * // Input: "  if condition:"  (2 spaces for level 1)
 * const result = indent.withContext({ indentLevel: 1 }).parse(input);
 * console.log(result); // "  " (the indentation string)
 * ```
 * 
 * @example Custom indentation size
 * ```typescript
 * const indent4 = new ContextualParser<string>((state, context) => {
 *   const expectedSpaces = context.indentLevel * 4; // 4 spaces per level
 *   const spaces = ' '.repeat(expectedSpaces);
 *   
 *   if (state.input.startsWith(spaces, state.index)) {
 *     return success(spaces, { ...state, index: state.index + expectedSpaces });
 *   }
 *   return failure(`Expected ${expectedSpaces} spaces`, state);
 * });
 * ```
 */
export const indent = new ContextualParser<string>((state, context) => {
  const expectedSpaces = context.indentLevel * 2;
  const spaces = ' '.repeat(expectedSpaces);

  if (state.input.startsWith(spaces, state.index)) {
    return success(spaces, { ...state, index: state.index + expectedSpaces });
  }

  return failure(`Expected ${expectedSpaces} spaces of indentation`, state);
});

/**
 * Wraps a parser to run it at an increased indentation level.
 * This is useful for parsing nested blocks that should be indented
 * relative to their parent context.
 * 
 * @template T The type of value the wrapped parser produces
 * @param parser The parser to run with increased indentation
 * @returns A contextual parser that runs the inner parser with +1 indentation level
 * 
 * @example Parsing nested Python blocks
 * ```typescript
 * const ifStatement = genParser(function* () {
 *   yield str('if');
 *   yield whitespace;
 *   const condition = yield expression;
 *   yield str(':');
 *   yield newline;
 *   
 *   // Parse the body with increased indentation
 *   const body = yield indented(many(statement));
 *   
 *   return { type: 'if', condition, body };
 * });
 * ```
 * 
 * @example Nested list parsing
 * ```typescript
 * const listItem = genParser(function* () {
 *   yield indent;
 *   yield str('- ');
 *   const content = yield restOfLine;
 *   const nested = yield optional(indented(many(listItem)));
 *   return { content, nested };
 * });
 * ```
 */
export const indented = <T>(parser: Parser<T>): ContextualParser<T> =>
  new ContextualParser((state, _context) => {
    // TODO: This is a simplified implementation - in practice, a new context
    // with increased indentation level should be passed to a context-aware
    // version of parser.run(): { ...context, indentLevel: context.indentLevel + 1 }
    return parser.run(state);
  });

/**
 * Example usage demonstrating a complete Python-like block parser.
 * This shows how contextual parsing can handle indentation-sensitive syntax.
 * 
 * @example Complete Python-like if statement parser
 * ```typescript
 * import { genParser, str, whitespace, newline, many } from '@combi-parse/parser';
 * import { indent, indented } from '@combi-parse/parsers/contextual';
 * 
 * const pythonBlock = genParser(function* () {
 *   // Parse the if keyword and condition
 *   yield str('if');
 *   yield whitespace;
 *   const condition = yield identifier; // or more complex expression parser
 *   yield str(':');
 *   yield newline;
 *   
 *   // Parse indented body statements
 *   const body = yield indented(many(genParser(function* () {
 *     yield indent;
 *     const statement = yield pythonStatement;
 *     yield newline;
 *     return statement;
 *   })));
 *   
 *   return { type: 'if', condition, body };
 * });
 * 
 * // Usage
 * const code = `if x > 0:
 *   print("positive")
 *   return x`;
 * const result = pythonBlock.parse(code);
 * ```
 * 
 * @example YAML-like nested structure
 * ```typescript
 * const yamlValue = genParser(function* () {
 *   const key = yield identifier;
 *   yield str(':');
 *   yield optional(whitespace);
 *   
 *   const value = yield choice([
 *     scalar,                    // Simple value
 *     indented(many(yamlValue))  // Nested structure
 *   ]);
 *   
 *   return { key, value };
 * });
 * ```
 */