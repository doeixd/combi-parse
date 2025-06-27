/**
 * @fileoverview Stateful generator parsing utilities for complex parsing scenarios.
 * 
 * This module provides infrastructure for creating generator parsers that maintain
 * local state throughout the parsing process. This is essential for parsing
 * languages or formats that require context-sensitive parsing, such as:
 * 
 * - Indentation-sensitive languages (Python, YAML, etc.)
 * - Languages with scoped variables or declarations
 * - Parsers that need to track nesting levels or context
 * - Parsers that accumulate results or maintain counters
 * - Context-sensitive grammars where parsing rules depend on previous results
 * 
 * The stateful parsing approach maintains the elegant generator syntax while
 * providing controlled access to mutable state. The state is encapsulated
 * within the parser and doesn't affect the global parsing context, ensuring
 * that stateful parsers can be composed safely with other parsers.
 * 
 * @example
 * ```typescript
 * // Parse indented blocks with level tracking
 * const indentedBlockParser = genParserWithState(
 *   { level: 0, items: [] },
 *   function* (state) {
 *     while (true) {
 *       const indent = yield indentParser;
 *       const currentLevel = indent.length;
 *       
 *       if (currentLevel < state.get().level) {
 *         break; // Dedent - end of block
 *       }
 *       
 *       if (currentLevel > state.get().level) {
 *         state.set({ ...state.get(), level: currentLevel });
 *       }
 *       
 *       const item = yield lineContent;
 *       state.set({
 *         ...state.get(),
 *         items: [...state.get().items, item]
 *       });
 *     }
 *     
 *     return state.get().items;
 *   }
 * );
 * ```
 */

import { Parser, ParserState, success } from "../../parser";

/**
 * Interface for managing local state within generator parsers.
 * 
 * This interface provides controlled access to mutable state within
 * generator parsers, ensuring that state modifications are explicit
 * and trackable. The state manager encapsulates the state and provides
 * methods to read and update it safely.
 * 
 * @template S - The type of the local state being managed
 */
interface StateManager<S> {
  /** Gets the current state value */
  get(): S;
  /** Sets a new state value */
  set(newState: S): void;
}

/**
 * Creates a generator parser with local state management.
 * 
 * This function enables the creation of parsers that maintain local state
 * throughout the parsing process. The state is encapsulated within the parser
 * and can be accessed and modified through the provided state manager.
 * 
 * The stateful approach is particularly useful for:
 * - Tracking parsing context (indentation levels, scope depth, etc.)
 * - Accumulating results during parsing
 * - Implementing context-sensitive parsing rules
 * - Managing parser configuration that changes during parsing
 * 
 * The state is completely isolated to the individual parser instance,
 * ensuring that stateful parsers can be composed safely without
 * interfering with each other.
 * 
 * @template S - The type of the local state
 * @template T - The type of the final parsed result
 * @param initialState - The initial state value
 * @param genFn - Generator function that receives a state manager
 * @returns A parser that maintains local state during parsing
 * 
 * @example
 * ```typescript
 * // Track variable declarations in a scope
 * const scopeParser = genParserWithState(
 *   { variables: new Set<string>(), level: 0 },
 *   function* (state) {
 *     const declarations = [];
 *     
 *     while (true) {
 *       const decl = yield variableDeclaration.optional();
 *       if (!decl) break;
 *       
 *       // Check for redeclaration
 *       if (state.get().variables.has(decl.name)) {
 *         throw new Error(`Variable ${decl.name} already declared`);
 *       }
 *       
 *       // Update state
 *       const currentState = state.get();
 *       state.set({
 *         ...currentState,
 *         variables: new Set([...currentState.variables, decl.name])
 *       });
 *       
 *       declarations.push(decl);
 *     }
 *     
 *     return declarations;
 *   }
 * );
 * ```
 * 
 * @example
 * ```typescript
 * // Parse nested structures with depth tracking
 * const nestedParser = genParserWithState(
 *   { depth: 0, maxDepth: 10 },
 *   function* (state) {
 *     const current = state.get();
 *     
 *     if (current.depth >= current.maxDepth) {
 *       throw new Error("Maximum nesting depth exceeded");
 *     }
 *     
 *     yield str('(');
 *     state.set({ ...current, depth: current.depth + 1 });
 *     
 *     const content = yield expression;
 *     
 *     yield str(')');
 *     state.set({ ...current, depth: current.depth - 1 });
 *     
 *     return content;
 *   }
 * );
 * ```
 */
export function genParserWithState<S, T>(
  initialState: S,
  genFn: (state: StateManager<S>) => Generator<Parser<any>, T, any>
): Parser<T> {
  return new Parser((parserState: ParserState) => {
    let localState = initialState;

    const stateManager: StateManager<S> = {
      get: () => localState,
      set: (newState: S) => { localState = newState; }
    };

    const iterator = genFn(stateManager);
    let currentParserState = parserState;
    let nextValue: any = undefined;

    while (true) {
      const { value: parserOrReturn, done } = iterator.next(nextValue);

      if (done) {
        return success(parserOrReturn as T, currentParserState);
      }

      const parser = parserOrReturn as Parser<any>;
      const result = parser.run(currentParserState);

      if (result.type === "failure") return result;

      currentParserState = result.state;
      nextValue = result.value;
    }
  });
}

/**
 * Creates a stateful parser with immutable state updates.
 * 
 * This variant of stateful parsing encourages immutable state management
 * by providing an update function that returns new state rather than
 * mutating existing state. This approach is safer for complex state
 * management and makes state changes more predictable.
 * 
 * @template S - The type of the local state
 * @template T - The type of the final parsed result
 * @param initialState - The initial state value
 * @param genFn - Generator function that receives state and update function
 * @returns A parser that maintains immutable local state
 * 
 * @example
 * ```typescript
 * // Track indentation levels immutably
 * const indentParser = genParserWithImmutableState(
 *   { level: 0, stack: [] as number[] },
 *   function* (state, update) {
 *     const currentIndent = yield indentParser.map(s => s.length);
 *     const current = state.get();
 *     
 *     if (currentIndent > current.level) {
 *       // Increased indentation
 *       update(prev => ({
 *         level: currentIndent,
 *         stack: [...prev.stack, prev.level]
 *       }));
 *     } else if (currentIndent < current.level) {
 *       // Decreased indentation
 *       const newStack = [...current.stack];
 *       const newLevel = newStack.pop() || 0;
 *       update(prev => ({
 *         level: newLevel,
 *         stack: newStack
 *       }));
 *     }
 *     
 *     return state.get().level;
 *   }
 * );
 * ```
 */
export function genParserWithImmutableState<S, T>(
  initialState: S,
  genFn: (
    state: StateManager<S>,
    update: (updater: (prev: S) => S) => void
  ) => Generator<Parser<any>, T, any>
): Parser<T> {
  return new Parser((parserState: ParserState) => {
    let localState = initialState;

    const stateManager: StateManager<S> = {
      get: () => localState,
      set: (newState: S) => { localState = newState; }
    };

    const update = (updater: (prev: S) => S) => {
      localState = updater(localState);
    };

    const iterator = genFn(stateManager, update);
    let currentParserState = parserState;
    let nextValue: any = undefined;

    while (true) {
      const { value: parserOrReturn, done } = iterator.next(nextValue);

      if (done) {
        return success(parserOrReturn as T, currentParserState);
      }

      const parser = parserOrReturn as Parser<any>;
      const result = parser.run(currentParserState);

      if (result.type === "failure") return result;

      currentParserState = result.state;
      nextValue = result.value;
    }
  });
}

/**
 * Creates a parser that maintains a stack-based state for nested parsing.
 * 
 * This specialized stateful parser is designed for parsing nested structures
 * where you need to maintain a stack of context information. It's particularly
 * useful for parsing languages with nested scopes, balanced delimiters, or
 * hierarchical structures.
 * 
 * @template T - The type of items on the stack
 * @template R - The type of the final parsed result
 * @param genFn - Generator function that receives stack management functions
 * @returns A parser with stack-based state management
 * 
 * @example
 * ```typescript
 * // Parse balanced parentheses with stack tracking
 * const balancedParser = genParserWithStack(function* (stack) {
 *   let depth = 0;
 *   
 *   while (true) {
 *     const char = yield regex(/[()]/);
 *     
 *     if (char === '(') {
 *       stack.push(depth);
 *       depth++;
 *     } else if (char === ')') {
 *       if (stack.isEmpty()) {
 *         throw new Error("Unmatched closing parenthesis");
 *       }
 *       depth = stack.pop();
 *     }
 *     
 *     const next = yield regex(/[()]/).optional();
 *     if (!next) break;
 *   }
 *   
 *   if (!stack.isEmpty()) {
 *     throw new Error("Unmatched opening parenthesis");
 *   }
 *   
 *   return depth;
 * });
 * ```
 */
export function genParserWithStack<T, R>(
  genFn: (stack: {
    push: (item: T) => void;
    pop: () => T | undefined;
    peek: () => T | undefined;
    isEmpty: () => boolean;
    size: () => number;
  }) => Generator<Parser<any>, R, any>
): Parser<R> {
  return genParserWithState(
    [] as T[],
    function* (state) {
      const stack = {
        push: (item: T) => {
          const current = state.get();
          state.set([...current, item]);
        },
        pop: () => {
          const current = state.get();
          if (current.length === 0) return undefined;
          const item = current[current.length - 1];
          state.set(current.slice(0, -1));
          return item;
        },
        peek: () => {
          const current = state.get();
          return current.length > 0 ? current[current.length - 1] : undefined;
        },
        isEmpty: () => state.get().length === 0,
        size: () => state.get().length
      };

      return yield* genFn(stack);
    }
  );
}

/**
 * Creates a parser with counter-based state for tracking occurrences.
 * 
 * This utility creates parsers that need to count occurrences of specific
 * patterns or maintain numerical state during parsing. It's useful for
 * parsing formats with counting requirements or statistical analysis.
 * 
 * @template T - The type of the final parsed result
 * @param genFn - Generator function that receives counter management functions
 * @returns A parser with counter-based state management
 * 
 * @example
 * ```typescript
 * // Count word occurrences while parsing
 * const wordCountParser = genParserWithCounter(function* (counter) {
 *   const words = [];
 *   
 *   while (true) {
 *     const word = yield regex(/\w+/).optional();
 *     if (!word) break;
 *     
 *     words.push(word);
 *     counter.increment(word);
 *     
 *     yield whitespace.optional();
 *   }
 *   
 *   return {
 *     words,
 *     counts: counter.getCounts(),
 *     total: counter.getTotal()
 *   };
 * });
 * ```
 */
export function genParserWithCounter<T>(
  genFn: (counter: {
    increment: (key?: string) => void;
    decrement: (key?: string) => void;
    get: (key?: string) => number;
    getCounts: () => Record<string, number>;
    getTotal: () => number;
    reset: (key?: string) => void;
  }) => Generator<Parser<any>, T, any>
): Parser<T> {
  return genParserWithState(
    { counts: {} as Record<string, number>, total: 0 },
    function* (state) {
      const counter = {
        increment: (key = 'default') => {
          const current = state.get();
          state.set({
            counts: { ...current.counts, [key]: (current.counts[key] || 0) + 1 },
            total: current.total + 1
          });
        },
        decrement: (key = 'default') => {
          const current = state.get();
          const newCount = Math.max(0, (current.counts[key] || 0) - 1);
          state.set({
            counts: { ...current.counts, [key]: newCount },
            total: Math.max(0, current.total - 1)
          });
        },
        get: (key = 'default') => state.get().counts[key] || 0,
        getCounts: () => state.get().counts,
        getTotal: () => state.get().total,
        reset: (key?: string) => {
          const current = state.get();
          if (key) {
            const oldCount = current.counts[key] || 0;
            state.set({
              counts: { ...current.counts, [key]: 0 },
              total: current.total - oldCount
            });
          } else {
            state.set({ counts: {}, total: 0 });
          }
        }
      };

      return yield* genFn(counter);
    }
  );
}
