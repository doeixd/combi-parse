/**
 * Advanced Context-Aware Parsing Module
 * 
 * This module provides sophisticated context-aware parsing capabilities for complex languages
 * and formats that require stateful parsing. Context-aware parsing is essential for handling
 * languages with indentation sensitivity, scoped variables, nested structures, and other
 * context-dependent syntax where the meaning of tokens depends on their surrounding context.
 * 
 * ## Core Concepts & Benefits
 * 
 * **Context-Aware Parsing**: Unlike traditional parsers that treat each token independently,
 * context-aware parsers maintain state throughout the parsing process. This enables:
 * 
 * - **Indentation Sensitivity**: Python, YAML, Haskell-style layout rules
 * - **Lexical Scoping**: Variable visibility, function scope, module boundaries
 * - **State-Dependent Tokenization**: String contexts, comment modes, macro expansion
 * - **Nested Structure Awareness**: Parent-child relationships, inheritance hierarchies
 * - **Semantic Context**: Type information, symbol resolution, dependency tracking
 * 
 * **Composable Context Management**: The new `ContextualParser<T, C>` class allows for
 * precise, functional, and type-safe management of a user-defined context `C`. Parsers
 * can be chained together, with each one able to access and modify the context.
 * 
 * **Dynamic Parser Adaptation**: Parsers can modify their behavior based on context,
 * enabling dynamic syntax, context-sensitive keywords, and adaptive parsing strategies.
 * 
 * ## Advanced Features
 * 
 * - **Fully generic context**: Define any context structure you need.
 * - **Type-safe combinators**: `map`, `chain`, `many` and others are context-aware.
 * - **Seamless integration** with base parsers via the `lift` function.
 * - **Powerful context primitives**: `getContext`, `setContext`, `updateContext`.
 * - **Error recovery** with context-aware suggestions and corrections
 * - **Debug support** with context visualization and state tracking
 * 
 * ## Language Support Examples
 * 
 * - **Python**: Indentation-based block structure, scope management
 * - **YAML**: Nested indentation, multi-document support
 * - **Haskell**: Layout rules, where clauses, do notation  
 * - **JavaScript/TypeScript**: Lexical scoping, closure context, module imports
 * - **CSS**: Selector context, nested rules, media queries
 * - **Markdown**: List nesting, code block context, inline formatting
 * - **Template Languages**: Variable interpolation, conditional blocks
 * 
 * @module parsers/contextual
 * @version 1.0.0
 * @author Context-Aware Parser Team  
 * @since 0.0.1
 * 
 * @example Advanced Python parser with full context support
 * ```typescript
 * import { ContextualParser, lift, withIndentation, withScope } from '@combi-parse/parsers/contextual';
 * import { Parser, genParser, str, identifier, many, whitespace, newline } from '@combi-parse/parser';
 * 
 * // Define a context for Python parsing
 * interface PythonContext extends ParserContext {
 *   indentationSize: number;
 * }
 * 
 * const pythonStatement: ContextualParser<any, PythonContext> = new ContextualParser(...); // Defined elsewhere
 * 
 * const pythonClassParser = genParser(function* () {
 *   yield str('class');
 *   yield whitespace;
 *   const className = yield identifier;
 *   yield str(':');
 *   yield newline;
 *   
 *   // Parse class body with increased indentation and new scope
 *   // `withIndentation` and `withScope` are now ContextualParser combinators
 *   const body = yield withIndentation(
 *     withScope(many(pythonStatement), { type: 'class', name: className })
 *   );
 *   
 *   return { type: 'class', name: className, body };
 * });
 * 
 * // To use it, lift the base parser into the contextual world
 * const contextualPythonClassParser = lift<any, PythonContext>(pythonClassParser);
 * 
 * // To run the parser
 * const initialContext: PythonContext = { ...defaultParserContext, indentationSize: 4 };
 * const result = contextualPythonClassParser.parse(pythonCode, initialContext);
 * console.log(result);
 * ```
 * 
 * @example Real-time YAML parser with validation
 * ```typescript
 * // The logic for validation can be encoded directly into the parsers using `chain`.
 * const yamlParser = lift(yamlDocument).chain(doc => 
 *   validate(doc).map(() => doc) // `validate` returns a failing parser if invalid
 * );
 * 
 * // A custom `validate` parser
 * function validate(doc: any): ContextualParser<null, ParserContext> {
 *   return new ContextualParser(state => {
 *     const errors = runMyValidators(doc, state.context);
 *     if (errors.length > 0) {
 *       return contextualFailure(errors.join(', '), state);
 *     }
 *     return contextualSuccess(null, state);
 *   });
 * }
 * ```
 */

import { Parser, ParserState, success, failure, ParserError } from "../parser";

// All the descriptive interfaces from the original file are kept, as they define the
// domain model for contextual parsing, which is still highly relevant.
// The implementation, however, will now be based on a more flexible, functional core.

/**
 * Configuration options for context-aware parsing behavior and optimization.
 */
export interface ContextualParserOptions {
  indentationSize?: number;
  allowTabs?: boolean;
  tabWidth?: number;
  enableScoping?: boolean;
  enableMetrics?: boolean;
  maxNestingDepth?: number;
  contextCaching?: boolean;
  cacheSize?: number;
  cacheTTL?: number;
  errorRecovery?: 'conservative' | 'balanced' | 'aggressive';
  maxRecoveryAttempts?: number;
  enableValidation?: boolean;
  customValidators?: ContextValidator[];
  preserveWhitespace?: boolean;
  preserveComments?: boolean;
  contextFactory?: (baseContext: ParserContext, options: ContextualParserOptions) => ParserContext;
}

/**
 * Comprehensive context information maintained during parsing operations.
 */
export interface ParserContext {
  indentLevel: number;
  indentStack: number[];
  inString: boolean;
  stringDelimiter: string | null;
  variables: Map<string, VariableInfo>;
  scopes: Scope[];
  currentScope: Scope;
  inComment: boolean;
  commentType: 'line' | 'block' | 'doc' | null;
  mode: string;
  modeStack: string[];
  metadata: Record<string, any>;
  performance?: ContextPerformanceInfo;
}

/** Information about a variable in the parsing context. */
export interface VariableInfo {
  name: string;
  type?: string | TypeInfo;
  value?: any;
  mutable?: boolean;
  declarationSite?: Position;
  declaringScope?: string;
}

/** Represents a lexical scope in the parsing context. */
export interface Scope {
  type: string;
  name?: string;
  variables: Map<string, VariableInfo>;
  parent?: Scope;
  metadata?: Record<string, any>;
}

/** Type information for advanced type systems. */
export interface TypeInfo {
  name: string;
  generics?: TypeInfo[];
  constraints?: Record<string, any>;
}

/** Performance tracking information for context operations. */
export interface ContextPerformanceInfo {
  contextSwitches: number;
  contextTime: number;
  scopeOperations: number;
  maxNestingDepth: number;
  memoryUsage: number;
}

/** Validator function for custom context validation rules. */
export type ContextValidator = (context: ParserContext, node: any) => ValidationResult;

/** Result of a context validation operation. */
export interface ValidationResult {
  valid: boolean;
  message?: string;
  suggestion?: string;
  severity?: 'error' | 'warning' | 'info';
}

/** Represents a position in the source text. */
export interface Position {
  line: number;
  column: number;
  offset: number;
}

// ===================================================================
// NEW CORE CONTEXTUAL PARSER IMPLEMENTATION
// ===================================================================

/** The state object for a ContextualParser. Includes the user-defined context. */
export interface ContextualParserState<C> {
  input: string;
  index: number;
  context: C;
}

/** A successful parse result, containing the value and the new state. */
export interface ContextualSuccess<T, C> {
  type: 'success';
  value: T;
  state: ContextualParserState<C>;
}

/** A failed parse result, containing the error message and the state at failure. */
export interface ContextualFailure<C> {
  type: 'failure';
  error: string;
  state: ContextualParserState<C>;
}

/** The result of running a ContextualParser. */
export type ContextualParseResult<T, C> = ContextualSuccess<T, C> | ContextualFailure<C>;

/** Helper to create a success result. */
export const contextualSuccess = <T, C>(value: T, state: ContextualParserState<C>): ContextualSuccess<T, C> => ({
  type: 'success',
  value,
  state,
});

/** Helper to create a failure result. */
export const contextualFailure = <C>(error: string, state: ContextualParserState<C>): ContextualFailure<C> => ({
  type: 'failure',
  error,
  state,
});

/**
 * A ContextualParser is a parser that has access to a user-defined context object.
 *
 * @template T The type of value this parser produces on success.
 * @template C The type of the context object this parser operates on.
 */
export class ContextualParser<T, C> {
  /**
   * The core of the parser. This function takes a `ContextualParserState` and
   * attempts to parse, returning a `ContextualParseResult`.
   */
  constructor(public readonly run: (state: ContextualParserState<C>) => ContextualParseResult<T, C>) { }

  /**
   * Runs the parser against an input string with an initial context.
   *
   * @param input The string to parse.
   * @param initialContext The starting context for the parse.
   * @returns The successfully parsed value of type `T`.
   * @throws {ParserError} if the parser fails.
   */
  parse(input: string, initialContext: C): T {
    const initialState: ContextualParserState<C> = { input, index: 0, context: initialContext };
    const result = this.run(initialState);

    if (result.type === 'failure') {
      const { index } = result.state;
      const lines = input.substring(0, index).split('\n');
      const line = lines.length;
      const col = lines[lines.length - 1].length + 1;
      throw new ParserError(`Parse error at line ${line}, col ${col}: ${result.error}`);
    }

    if (result.state.index !== input.length) {
      throw new ParserError(`Parse error: Parser did not consume entire input. Stopped at index ${result.state.index}.`);
    }

    return result.value;
  }

  /**
   * Transforms the successful result of this parser.
   *
   * @param fn The function to apply to the successful result.
   * @returns A new `ContextualParser` that produces the transformed value.
   */
  map<U>(fn: (value: T) => U): ContextualParser<U, C> {
    return new ContextualParser<U, C>(state => {
      const result = this.run(state);
      return result.type === "success" ? contextualSuccess(fn(result.value), result.state) : result;
    });
  }

  /**
   * Chains another contextual parser after this one, allowing the second parser
   * to depend on the result of the first.
   *
   * @param fn A function that takes the result of this parser and returns the next parser.
   * @returns A new `ContextualParser` representing the sequential composition.
   */
  chain<U>(fn: (value: T) => ContextualParser<U, C>): ContextualParser<U, C> {
    return new ContextualParser<U, C>(state => {
      const result = this.run(state);
      if (result.type === "failure") return result;
      return fn(result.value).run(result.state);
    });
  }

  /**
   * Applies this parser zero or more times, collecting the results.
   * This parser must consume input on success to prevent infinite loops.
   */
  many<U = T[]>(into?: (results: T[]) => U): ContextualParser<U, C> {
    const transform = into ?? ((res: T[]) => res as unknown as U);
    return new ContextualParser<U, C>(state => {
      const results: T[] = [];
      let currentState = state;
      while (true) {
        const result = this.run(currentState);

        if (result.type === 'failure') {
          return contextualSuccess(transform(results), currentState);
        }

        if (result.state.index === currentState.index) {
          return contextualFailure('Infinite loop in .many(): parser succeeded without consuming input.', state);
        }

        results.push(result.value);
        currentState = result.state;
      }
    });
  }
}

// ===================================================================
// CORE CONTEXTUAL COMBINATORS
// ===================================================================

/**
 * Lifts a base `Parser<T>` into a `ContextualParser<T, C>`.
 * The resulting parser will run the base parser, leaving the context untouched.
 * This is the primary way to integrate non-contextual parsers into a contextual-parsing pipeline.
 *
 * @param parser The base parser to lift.
 */
export function lift<T, C>(parser: Parser<T>): ContextualParser<T, C> {
  return new ContextualParser<T, C>(state => {
    const baseState: ParserState = { input: state.input, index: state.index };
    const result = parser.run(baseState);

    if (result.type === 'success') {
      const newState: ContextualParserState<C> = { ...state, index: result.state.index };
      return contextualSuccess(result.value, newState);
    } else {
      const newState: ContextualParserState<C> = { ...state, index: result.state.index };
      return contextualFailure(result.message, newState);
    }
  });
}

/**
 * A parser that succeeds with the current context as its value.
 */
export function getContext<C>(): ContextualParser<C, C> {
  return new ContextualParser(state => contextualSuccess(state.context, state));
}

/**
 * A parser that replaces the current context with the provided value.
 * Succeeds with `null`.
 *
 * @param newContext The new context object or a function that creates it.
 */
export function setContext<C>(newContext: C): ContextualParser<null, C> {
  return new ContextualParser(state => contextualSuccess(null, { ...state, context: newContext }));
}

/**
 * A parser that updates the context using a function.
 * Succeeds with `null`.
 *
 * @param updater A function that takes the old context and returns the new context.
 */
export function updateContext<C>(updater: (context: C) => C): ContextualParser<null, C> {
  return new ContextualParser(state => contextualSuccess(null, { ...state, context: updater(state.context) }));
}


// ===================================================================
// HIGH-LEVEL HELPERS
// ===================================================================

/**
 * A parser combinator that ensures the wrapped parser is run at the current
 * expected indentation level. It consumes the indentation whitespace.
 *
 * The context `C` must have `indentLevel` and `indentationSize` properties.
 *
 * @param parser The parser to run after validating indentation.
 */
export function withIndentation<T, C extends { indentLevel: number; indentationSize: number; }>(parser: ContextualParser<T, C>): ContextualParser<T, C> {
  return new ContextualParser<T, C>(state => {
    const context = state.context;
    const expectedSpaces = context.indentLevel * context.indentationSize;
    
    // Get the actual number of leading spaces
    const actualSpacesMatch = state.input.slice(state.index).match(/^[ ]*/);
    const actualSpaces = actualSpacesMatch ? actualSpacesMatch[0].length : 0;
    
    // Check if the actual spaces match the expected amount
    if (actualSpaces !== expectedSpaces) {
      return contextualFailure(`Expected indentation of ${expectedSpaces} spaces, but found ${actualSpaces}.`, state);
    }

    const stateAfterIndent = { ...state, index: state.index + actualSpaces };
    return parser.run(stateAfterIndent);
  });
}

/**
 * A parser combinator that runs a parser within an increased indentation level.
 * It automatically increments `indentLevel` before running the parser and
 * restores it afterward.
 *
 * @param parser The parser to run at the new indentation level.
 */
export function withIncreasedIndentation<T, C extends { indentLevel: number }>(parser: ContextualParser<T, C>): ContextualParser<T, C> {
  return new ContextualParser<T, C>(state => {
    // Create the inner context with an increased indent level
    const innerContext: C = {
      ...state.context,
      indentLevel: state.context.indentLevel + 1
    };

    const result = parser.run({ ...state, context: innerContext });

    // Restore the original indent level on the way out, keeping any other context changes.
    if (result.type === 'success') {
      const finalResultContext = { ...result.state.context, indentLevel: state.context.indentLevel };
      return contextualSuccess(result.value, {
        ...result.state,
        // Cast is needed because TS can't prove `{...C, prop:val}` is still `C`.
        // This is safe under the assumption that C is a plain data object.
        context: finalResultContext as C,
      });
    }
    return result;
  });
}

/**
 * A parser combinator that runs a parser within a new lexical scope.
 * It automatically pushes a new scope before running the parser and pops it afterward.
 *
 * The context `C` must have a `scopes` array.
 *
 * @param parser The parser to run inside the new scope.
 * @param scopeInfo Metadata for the new scope (e.g., `{ type: 'function', name: 'myFunc' }`).
 */
export function withScope<T, C extends { scopes: Scope[]; currentScope: Scope; }>(
  parser: ContextualParser<T, C>,
  scopeInfo: Partial<Scope>
): ContextualParser<T, C> {
  return new ContextualParser<T, C>(state => {
    const { scopes, currentScope } = state.context;

    // Create new scope and update context
    const newScope: Scope = {
      type: 'block', // default type
      variables: new Map(),
      parent: currentScope,
      ...scopeInfo
    };
    const innerContext: C = {
      ...state.context,
      scopes: [...scopes, newScope],
      currentScope: newScope,
    };

    const result = parser.run({ ...state, context: innerContext });

    // Restore the original scope stack and current scope, keeping other changes.
    if (result.type === 'success') {
      const finalResultContext = {
        ...result.state.context,
        scopes: scopes,
        currentScope: currentScope
      };
      return contextualSuccess(result.value, {
        ...result.state,
        // Cast is needed because TS can't prove `{...C, prop:val}` is still `C`.
        context: finalResultContext as C,
      });
    }
    return result;
  });
}


// ===============================
// Usage Examples and Best Practices
// ===============================

/**
 * @example Complete Python parser with full context support
 * ```typescript
 * import { ContextualParser, lift, withIndentation, withScope, withIncreasedIndentation, ParserContext } from '@combi-parse/parsers/contextual';
 * import { Parser, gen, str, identifier, many, choice, optional, whitespace, newline, regex } from '@combi-parse/parser';
 * 
 * // 1. Define the Context
 * interface PythonContext extends ParserContext {
 *   indentationSize: number;
 * }
 * 
 * const expression = lift<any, PythonContext>(regex(/[a-z > 0]+/)); // dummy expression parser
 * 
 * // A forward declaration for the statement parser, which is recursive.
 * const pythonStatement: () => ContextualParser<any, PythonContext> = () => choice([
 *   pythonIf(),
 *   lift(str('pass')),
 *   // pythonFunction(),
 *   // ... other statements
 * ]);
 * 
 * // 2. Build Parsers using `lift` and contextual combinators
 * const pythonIf = (): ContextualParser<any, PythonContext> =>
 *   lift(
 *     gen(function* () {
 *       yield str('if');
 *       yield whitespace;
 *       const condition = yield regex(/[a-z > 0]+/); // dummy expression
 *       yield str(':');
 *       yield newline;
 *       return { condition };
 *     })
 *   ).chain(({ condition }) =>
 *     withIncreasedIndentation(
 *       many(withIndentation(pythonStatement()))
 *     ).map(body => ({
 *       type: 'if',
 *       condition,
 *       body,
 *     }))
 *   );
 * 
 * // 3. Run the parser with an initial context
 * const pythonCode = `
 * if x > 0:
 *   if y > 0:
 *     pass
 * `.trim();
 *
 * const initialContext: PythonContext = {
 *   indentLevel: 0,
 *   indentStack: [0],
 *   inString: false,
 *   stringDelimiter: null,
 *   variables: new Map(),
 *   scopes: [],
 *   currentScope: { type: 'module', variables: new Map() },
 *   inComment: false,
 *   commentType: null,
 *   mode: 'normal',
 *   modeStack: ['normal'],
 *   metadata: {},
 *   indentationSize: 2, // for this example
 * };
 * 
 * const result = pythonIf().parse(pythonCode, initialContext);
 * console.log('Parsed AST:', JSON.stringify(result, null, 2));
 * ```
 * 
 * @example YAML parser with validation
 * ```typescript
 * import { ContextualParser, lift, getContext, updateContext, withIndentation, withIncreasedIndentation, ParserContext } from '@combi-parse/parsers/contextual';
 * import { Parser, str, identifier, many, choice, optional, whitespace, regex } from '@combi-parse/parser';
 * 
 * interface YamlContext extends ParserContext {
 *   indentationSize: number;
 * }
 * 
 * const scalarValue = lift<string, YamlContext>(regex(/[a-zA-Z0-9/.]+/));
 * 
 * // A key-value pair parser that validates for duplicate keys.
 * const yamlKeyValue = (): ContextualParser<any, YamlContext> => 
 *   lift<string, YamlContext>(identifier).chain(key =>
 *     // Validate the key against the current context
 *     getContext<YamlContext>().chain(context => {
 *       const currentKeys = context.currentScope.metadata?.keys as Set<string> || new Set();
 *       if (currentKeys.has(key)) {
 *         // Create a failing parser to report the error
 *         return new ContextualParser<any, YamlContext>(state => 
 *            contextualFailure(`Duplicate key "${key}" in current scope`, state)
 *         );
 *       }
 * 
 *       // Key is valid, update context and continue parsing
 *       const newContextUpdater = (ctx: YamlContext): YamlContext => {
 *         const newScope = { ...ctx.currentScope };
 *         if (!newScope.metadata) newScope.metadata = {};
 *         const newKeys = new Set(currentKeys);
 *         newKeys.add(key);
 *         newScope.metadata.keys = newKeys;
 *         return { ...ctx, currentScope: newScope };
 *       };
 *
 *       return updateContext<YamlContext>(newContextUpdater)
 *        .chain(() => lift(str(':')).chain(() => lift(optional(whitespace)))
 *        .chain(() =>
 *            choice([
 *               scalarValue,
 *               lift(newline).chain(() => 
 *                  withIncreasedIndentation(many(withIndentation(yamlKeyValue())))
 *               )
 *            ])
 *        ).map(value => ({ [key]: value }))
 *       );
 *     })
 *   );
 * 
 * const yamlParser = many(withIndentation(yamlKeyValue()));
 * 
 * const yamlText = `
 * server:
 *   host: localhost
 *   port: 8080
 * database:
 *   url: postgresql://...
 *   pool_size: 10
 * server: oops
 * `.trim();
 * 
 * const initialYamlContext: YamlContext = {
 *    indentLevel: 0,
 *    indentStack: [0],
 *    inString: false,
 *    stringDelimiter: null,
 *    variables: new Map(),
 *    scopes: [],
 *    currentScope: { type: 'root', variables: new Map(), metadata: { keys: new Set() } },
 *    inComment: false,
 *    commentType: null,
 *    mode: 'normal',
 *    modeStack: ['normal'],
 *    metadata: {},
 *    indentationSize: 2,
 * };
 * 
 * try {
 *    const result = yamlParser.parse(yamlText, initialYamlContext);
 *    console.log(JSON.stringify(result, null, 2));
 * } catch (e) {
 *    if (e instanceof ParserError) {
 *        console.error(e.message); // -> Parse error at line 7, col 1: Duplicate key "server" in current scope
 *    }
 * }
 * ```
 */