// =================================================================
//
//      A Type-Safe, Generic Parser Combinator Library for TypeScript
//
//      This library provides a set of tools to build complex parsers from
//      simple, reusable functions ("combinators"). It is designed to be:
//
//      - Type-Safe: Leverages the TypeScript type system to catch parsing
//        logic errors at compile time. Parsers know the type of data
//        they produce, so if your grammar changes, the types guide you
//        to fix the relevant parts of your code.
//
//      - Composable: Build complex parsers by combining smaller ones. This
//        approach encourages breaking down a problem into small, manageable
//        pieces that mirror the structure of the data you want to parse.
//        For example, a CSV parser can be built from a 'cell' parser,
//        a 'row' parser (a sequence of cells), and a 'file' parser
//        (a sequence of rows).
//
//      - Readable: The code for the parser often looks like a formal
//        grammar (e.g., `const parser = sequence([A, B, C])`), making it
//        easy to understand, reason about, and maintain.
//
//      - Powerful: Includes advanced features like left-recursion support
//        (for parsing arithmetic expressions naturally), generator-based
//        syntax for clean sequential parsing, and detailed, context-aware
//        error reporting to help users diagnose issues in their input.
//
// =================================================================

import * as CC from './master-char-classes';

// =================================================================
// Section 1: Core Types & Result Helpers
//
// This section defines the fundamental data structures that power the
// library. Understanding these types is key to understanding how
// parsers communicate their state and results.
// =================================================================

/**
 * Represents the immutable state of the parser at any point in time.
 * It's a "cursor" that tracks the full input string and the current
 * position (index) within it.
 *
 * Immutability is crucial here: when a parser consumes input, it creates
 * a *new* state object instead of modifying the old one. This makes
 * backtracking (e.g., in the `or` combinator) safe and predictable.
 */
export interface ParserState {
  /** The entire string being parsed. */
  readonly input: string;
  /** The current zero-based offset into the `input` string. */
  readonly index: number;
}

/**
 * Represents a successful parse operation. It contains the data that was
 * successfully parsed and the new state of the parser, ready for the
 * next operation.
 * @template T The type of the successfully parsed value.
 */
export interface Success<T> {
  readonly type: "success";
  /** The structured value produced by the parser (e.g., a number, a string, an AST node). */
  readonly value: T;
  /** The new parser state after consuming input. */
  readonly state: ParserState;
}

/**
 * Represents a failed parse operation. It contains a descriptive error
 * message and the state at which the parse failed. This information is
 * crucial for providing useful, human-readable error diagnostics.
 */
export interface Failure {
  readonly type: "failure";
  /** A message explaining what was expected by the parser at the point of failure. */
  readonly message: string;
  /** The state of the parser at the exact point of failure. Used to calculate line/column numbers. */
  readonly state: ParserState;
  /** The actual character or substring found in the input, which caused the failure. */
  readonly found: string;
}

/**
 * A discriminated union representing the outcome of a parser's `run` function.
 * Using a discriminated union (`type: "success" | "failure"`) is a standard
 * and type-safe way in TypeScript to handle operations that can either
 * succeed or fail.
 * @template T The type of the value produced on success.
 */
export type ParseResult<T> = Success<T> | Failure;

/**
 * A factory function to create a `Success<T>` result object. Using this
 * helper ensures consistent object creation.
 * @param value The successfully parsed and constructed value.
 * @param state The new `ParserState` after the parser has consumed input.
 * @returns A `Success<T>` object.
 */
export const success = <T>(value: T, state: ParserState): Success<T> => ({
  type: 'success',
  value,
  state,
});

/**
 * A factory function to create a `Failure` result object. Using this helper
 * ensures consistent object creation.
 * @param message A string explaining the reason for the failure (e.g., "a number", "the keyword 'let'").
 * @param state The `ParserState` at the point of failure.
 * @param found The actual character or substring found at the failure point. If not provided, it defaults to the single character at the failure index.
 * @returns A `Failure` object.
 */
export const failure = (message: string, state: ParserState, found?: string): Failure => ({
  type: 'failure',
  message,
  state,
  found: found ?? `"${state.input.slice(state.index, state.index + 1)}"`,
});


// =================================================================
// Section 2: Advanced Type-Level Utilities
// =================================================================

/**
 * A utility type that recursively splits a string literal into a union of its
 * individual characters. This is a powerful TypeScript feature that allows
 * us to create parsers with extremely precise return types.
 *
 * It is used by `charClass` to infer a type like `"a" | "b" | "c"` from
 * an input string `"abc"`, providing excellent type safety and autocompletion.
 *
 * @example
 * type MyChars = ToCharUnion<"abc">; // "a" | "b" | "c"
 */
export type ToCharUnion<S extends string> = S extends `${infer Char}${infer Rest}` ? Char | ToCharUnion<Rest> : never;


// =================================================================
// Section 3: The Parser Class
// =================================================================

/** Options for the final `.parse()` method execution. */
export interface ParseOptions {
  /**
   * If `true`, the parser must consume the entire input string for the
   * parse to be considered successful. If `false`, the parse succeeds
   * even if there is unconsumed input remaining.
   * @default true
   */
  readonly consumeAll?: boolean;
}

/**
 * A custom error class thrown by the top-level `.parse()` method on failure.
 * This allows for specific `catch (e instanceof ParserError)` blocks.
 */
export class ParserError extends Error {}

/**
 * The core Parser class. A `Parser<T>` is an immutable object that wraps a
 * function that takes a `ParserState` and returns a `ParseResult<T>`.
 *
 * This is a monadic structure: the `map` and `chain` methods allow for
 * powerful, declarative, and type-safe composition of parsing logic.
 * Parsers themselves don't *do* anything until the `run` (or top-level `parse`)
 * method is called with an input.
 *
 * @template T The type of the value this parser produces on success.
 */
export class Parser<T> {
  /**
   * A human-readable description of what this parser expects.
   * This is used to generate meaningful error messages, especially
   * by combinators like `or`, `choice`, and `label`.
   * @example
   * const helloParser = str("hello");
   * // helloParser.description is '"hello"'
   */
  description?: string;

  /**
   * The core execution function of the parser.
   * @param state The current `ParserState` (input and index).
   * @returns A `ParseResult<T>` indicating success or failure.
   */
  constructor(public readonly run: (state: ParserState) => ParseResult<T>) { }

  /**
   * The main entry point for running a parser on an input string.
   * It handles initialization, execution, and error formatting.
   * Throws a `ParserError` on failure.
   *
   * @param input The string to parse.
   * @param options Configuration for the parse run.
   * @returns The successfully parsed value of type `T`.
   * @example
   * const numberParser = regex(/[0-9]+/).map(Number);
   * try {
   *   const result = numberParser.parse("123"); // result is 123
   *   console.log(result);
   * } catch (e) {
   *   console.error(e.message);
   * }
   */
  parse(input: string, options: ParseOptions = { consumeAll: true }): T {
    const getLineAndCol = (index: number): { line: number, col: number } => {
      let line = 1;
      let lastNewlineIndex = -1;
      for (let i = 0; i < index; i++) {
        if (input[i] === '\n') {
          line++;
          lastNewlineIndex = i;
        }
      }
      return { line, col: index - lastNewlineIndex };
    };

    const result = this.run({ input, index: 0 });

    if (result.type === "failure") {
      const { line, col } = getLineAndCol(result.state.index);
      const errorMessage = `Parse error at Line ${line}, Col ${col}: Expected ${result.message} but found ${result.found}`;
      throw new ParserError(errorMessage);
    }

    if (options.consumeAll && result.state.index !== input.length) {
      const { line, col } = getLineAndCol(result.state.index);
      throw new ParserError(`Parse error: Parser succeeded but did not consume entire input. Stopped at Line ${line}, Col ${col}.`);
    }

    return result.value;
  }

  /**
   * Transforms the successful result of this parser using a given function.
   * If the parser fails, the function is not called and the failure is propagated.
   * Use this to convert the parsed value from one type to another.
   *
   * @template U The new type of the parser's result.
   * @param fn The function to apply to the successful result.
   * @returns A new parser that produces a value of type `U`.
   * @example
   * // A parser for a string of digits, mapped to a number
   * const numberString = regex(/[0-9]+/);
   * const numberParser = numberString.map(s => parseInt(s, 10));
   * // numberParser.parse("42") returns 42 (a number)
   */
  map<U>(fn: (value: T) => U): Parser<U> {
    return new Parser(state => {
      const result = this.run(state);
      return result.type === "success" ? success(fn(result.value), result.state) : result;
    });
  }

  /**
   * Transforms the successful result with a new parser that can itself fail.
   * This is useful for semantic validation *after* syntactic parsing, where
   * the validation logic is complex and might need to produce its own error message.
   * Note: this is a state-preserving transformation; it uses the state from the
   * original parse, only changing the success value or failure message.
   *
   * @param fn A function that takes the parsed value and returns a `ParseResult`.
   *           The state inside this result is ignored; only success/failure and message matter.
   * @returns A `Parser` that applies the failable transformation.
   * @example
   * const portParser = number.tryMap(n =>
   *   (n >= 0 && n <= 65535)
   *     // State is intentionally ignored and passed through, so `undefined as any` is a pragmatic choice.
   *     ? success(n, undefined as any)
   *     : failure("a valid port number (0-65535)", undefined as any)
   * );
   * // portParser.parse("80") succeeds with 80
   * // portParser.parse("99999") fails with "Expected a valid port number..."
   */
  tryMap<U>(fn: (value: T) => ParseResult<U>): Parser<U> {
      return this.chain(value =>
        new Parser(state => {
          const mapResult = fn(value);
          // On success, we keep the *new value* but the *original state*.
          if (mapResult.type === 'success') {
            return success(mapResult.value, state)
          }
          // On failure, we create a new failure with the *original state*
          // but the *new message* from the validation function.
          return failure(mapResult.message, state, mapResult.found);
        })
      );
  }

  /**
   * Chains another parser after this one, where the second parser depends on
   * the result of the first. This is the monadic "bind" or "flatMap" operation
   * and is the most powerful way to sequence parsers.
   *
   * Use `chain` when you need the *value* from the first parser to decide
   * what to parse next.
   *
   * @template U The result type of the second parser.
   * @param fn A function that takes the result of the first parser and returns a new parser.
   * @returns A new parser that runs this parser, then uses the result to create and run the next.
   * @example
   * // A parser for a length-prefixed string (e.g., "3:abc")
   * const number = regex(/[0-9]+/).map(Number);
   * const colon = str(":");
   * const lengthPrefixedString = number.chain(len => colon.keepRight(count(len, anyChar)));
   * // lengthPrefixedString.parse("4:test") returns ['t', 'e', 's', 't']
   */
  chain<U>(fn: (value: T) => Parser<U>): Parser<U> {
    return new Parser(state => {
      const result = this.run(state);
      if (result.type === "failure") return result;
      // The new parser is created using the successful value,
      // and then run on the updated state.
      return fn(result.value).run(result.state);
    });
  }

  /**
   * Applies the parser zero or more times, collecting the results into an array.
   * This parser will never fail; if it can't be applied even once, it succeeds
   * with an empty array.
   *
   * **Important:** To prevent infinite loops, the underlying parser must consume
   * input on each successful application. This implementation detects and fails
   * if an infinite loop is found.
   *
   * @param into An optional function to transform the final array of results.
   * @returns A parser that produces an array of `T` values.
   * @example
   * const letterA = str('a');
   * const aSequence = letterA.many();
   * // aSequence.parse("aaa") returns ['a', 'a', 'a']
   * // aSequence.parse("b") returns []
   */
  many<U = T[]>(into?: (results: T[]) => U): Parser<U> {
    const transform = into ?? ((res: T[]) => res as unknown as U);
    return new Parser(state => {
      const results: T[] = [];
      let currentState = state;
      while (true) {
        const result = this.run(currentState);
        if (result.type === 'failure') {
          // Failure is expected and means we're done. Succeed with collected results.
          return success(transform(results), currentState);
        }
        // Infinite loop detection: if the parser succeeded but didn't move forward,
        // we would loop forever. This is a fatal error in the grammar definition.
        if (result.state.index === currentState.index) {
          return failure('infinite loop in .many()', state, 'parser succeeded without consuming input');
        }
        results.push(result.value);
        currentState = result.state;
      }
    });
  }

  /**
   * Applies the parser one or more times, collecting the results.
   * This is like `many`, but will fail if the parser cannot be applied at least once.
   *
   * @param into An optional function to transform the final array of results.
   * @returns A parser that produces a non-empty array of `T` values.
   * @example
   * const letterA = str('a');
   * const aSequence = letterA.many1();
   * // aSequence.parse("aa") returns ['a', 'a']
   * // aSequence.parse("b") fails
   */
  many1<U = T[]>(into?: (results: T[]) => U): Parser<U> {
    return this.chain(first =>
      this.many().map(rest => {
        const all = [first, ...rest];
        return into ? into(all) : (all as unknown as U);
      })
    );
  }

  /**
   * Tries another parser if this one fails *without consuming input*.
   * This is a key combinator for providing alternatives in a grammar.
   * If the first parser fails but *has* consumed input, the failure is
   * "committed" and the alternative parser will not be tried. This prevents
   * unexpected behavior and improves performance.
   *
   * @param other The alternative parser to try.
   * @returns A new parser that succeeds if either `this` or `other` succeeds.
   * @example
   * const tryConst = str("const");
   * const tryLet = str("let");
   * const keyword = tryConst.or(tryLet);
   * // keyword.parse("let") returns "let"
   */
  or<U>(other: Parser<U>): Parser<T | U> {
    const self = this;
    const p = new Parser<T | U>((state: ParserState) => {
      const result = this.run(state);
      // Only try the 'other' parser if the first one failed at the same position
      // it started at (a non-committing failure).
      if (result.type === 'failure' && result.state.index === state.index) {
        return other.run(state);
      }
      return result as ParseResult<T | U>;
    });
    // For better error messages, combine the descriptions.
    p.description = `${self.description} or ${other.description}`;
    return p;
  }

  /**
   * Makes the parser optional. If the parser fails without consuming input,
   * it will succeed with a `null` value instead.
   * This is a convenient shorthand for `parser.or(succeed(null))`.
   *
   * @returns A parser that produces either a `T` or `null`.
   * @example
   * const optionalA = str('a').optional();
   * // optionalA.parse("a") returns "a"
   * // optionalA.parse("b") returns null
   */
  optional(): Parser<T | null> {
    return this.or(succeed(null));
  }

  /**
   * Runs another parser `p` after this one, but discards the result of `this`
   * parser, keeping only the result of `p`.
   *
   * @param p The parser to run second.
   * @returns A parser that sequences `this` and `p`, and returns `p`'s result.
   * @example
   * const openParen = str("(");
   * const number = regex(/[0-9]+/);
   * // Parses an opening parenthesis, then a number, and keeps the number.
   * const parser = openParen.keepRight(number);
   * // parser.parse("(123") returns "123"
   */
  keepRight<U>(p: Parser<U>): Parser<U> {
    return this.chain(() => p);
  }

  /**
   * Runs another parser `p` after this one, but discards the result of `p`,
   * keeping only the result of `this` parser.
   *
   * @param p The parser to run second (and whose result is discarded).
   * @returns A parser that sequences `this` and `p`, and returns `this`'s result.
   * @example
   * const number = regex(/[0-9]+/).map(Number);
   * const semicolon = str(";");
   * // Parses a number, then a semicolon, but returns the number.
   * const statement = number.keepLeft(semicolon);
   * // statement.parse("42;") returns 42
   */
  keepLeft<U>(p: Parser<U>): Parser<T> {
    return this.chain(res => p.map(() => res));
  }

  /**
   * Returns the raw string slice consumed by the parser instead of its
   * structured result. This is useful when you care about the text that was
   * matched, not the value it represents (e.g., getting the full text of a comment).
   *
   * @returns A parser that produces the consumed string.
   * @example
   * const number = regex(/-?[0-9]+/);
   * const numberAsString = number.slice();
   * // number.parse("-123") returns "-123" (a string)
   */
  slice(): Parser<string> {
    return new Parser(state => {
      const result = this.run(state);
      if (result.type === 'success') {
        const consumedSlice = state.input.slice(state.index, result.state.index);
        return success(consumedSlice, result.state);
      }
      return result;
    });
  }

  /**
   * A debugging helper that logs the parser's state and result to the console.
   * This is a "pass-through" combinator that does not affect the parsing
   * result, making it safe to insert anywhere in a parser chain for debugging.
   *
   * @param label An optional label to identify the debug output.
   * @returns The same parser, but with logging enabled.
   * @example
   * const parser = str('a').debug('alpha').keepRight(str('b').debug('beta'));
   * parser.parse('ab');
   * // Logs:
   * // [alpha] Trying at pos 0: "ab..."
   * // [alpha] ✅ Success! Value: "a", Consumed: "a"
   * // [beta] Trying at pos 1: "b..."
   * // [beta] ✅ Success! Value: "b", Consumed: "b"
   */
  debug(label?: string): Parser<T> {
    return new Parser(state => {
      const prefix = label ? `[${label}] ` : '';
      console.log(`${prefix}Trying at pos ${state.index}: "${state.input.slice(state.index, state.index + 20)}..."`);
      const result = this.run(state);
      if (result.type === 'success') {
        const consumed = state.input.slice(state.index, result.state.index);
        console.log(`${prefix}✅ Success! Value: ${JSON.stringify(result.value)}, Consumed: "${consumed}"`);
      } else {
        console.log(`${prefix}❌ Failed: Expected ${result.message}`);
      }
      return result;
    })
  };

  /** Method version of the standalone `sepBy` function for chaining. */
  sepBy<S, U = T[]>(separator: Parser<S>, into?: (results: T[]) => U): Parser<U> {
    return sepBy(this, separator, into);
  }

  /** Method version of the standalone `sepBy1` function for chaining. */
  sepBy1<S, U = T[]>(separator: Parser<S>, into?: (results: T[]) => U): Parser<U> {
    return sepBy1(this, separator, into);
  }
}

// =================================================================
// Section 4: Primitive Parsers
//
// These are the fundamental building blocks ("atomic" parsers) from
// which all other parsers are constructed. They handle matching
// specific characters, strings, or patterns.
// =================================================================

/** A parser that always succeeds with the given `value`, consuming no input. */
export const succeed = <T>(value: T): Parser<T> => new Parser(state => success(value, state));

/** A parser that always fails with the given `message`, consuming no input. */
export const fail = (message: string): Parser<never> => new Parser(state => failure(message, state));

/** A parser that matches a specific string literal at the current position. */
export const str = <S extends string>(s: S): Parser<S> => {
    const description = `"${s}"`;
    const p = new Parser<S>(state => {
        if (state.input.startsWith(s, state.index)) {
            return success(s, { ...state, index: state.index + s.length });
        }
        return failure(description, state);
    });
    p.description = description;
    return p;
};

/** A parser that consumes and returns any single character. Fails at the end of input. */
export const anyChar: Parser<string> = new Parser(state => {
    if (state.index >= state.input.length) {
      return failure('any character', state, 'end of input');
    }
    const char = state.input[state.index];
    return success(char, { ...state, index: state.index + 1 });
});

/**
 * Creates a parser that succeeds if the current character is one of the
 * characters in the provided string `chars`. (Internal use, prefer `charClass`)
 */
const anyOf = (chars: string): Parser<string> => {
  const charSet = new Set(chars);
  const truncatedChars = chars.length > 20 ? `${chars.slice(0, 20)}...` : chars;
  const description = `one of [${truncatedChars}]`;
  const p = new Parser(state => {
    if (state.index >= state.input.length) {
      return failure(description, state, 'end of input');
    }
    const char = state.input[state.index];
    if (charSet.has(char)) {
      return success(char, { ...state, index: state.index + 1 });
    }
    return failure(description, state);
  });
  p.description = description;
  return p;
};

/** Creates a parser that succeeds if the current character is *not* one of the characters in `chars`. */
export const noneOf = (chars: string): Parser<string> => {
    const charSet = new Set(chars);
    const truncatedChars = chars.length > 20 ? `${chars.slice(0, 20)}...` : chars;
    const description = `any character not in [${truncatedChars}]`;
    const p = new Parser(state => {
        if (state.index >= state.input.length) {
            return failure(description, state, 'end of input');
        }
        const char = state.input[state.index];
        if (!charSet.has(char)) {
            return success(char, { ...state, index: state.index + 1 });
        }
        return failure(description, state);
    });
    p.description = description;
    return p;
};

/**
 * Creates a parser from a regular expression. The regex is always anchored
 * to the current parser position (as if it starts with `^`).
 *
 * @param re The regular expression to match.
 * @returns A parser that consumes and returns the matched string.
 */
export const regex = (re: RegExp): Parser<string> => {
  const anchoredRegex = new RegExp(`^${re.source}`, re.flags);
  const description = `to match regex /${re.source}/`;
  const p = new Parser(state => {
    const match = state.input.slice(state.index).match(anchoredRegex);
    if (match) {
      return success(match[0], { ...state, index: state.index + match[0].length });
    }
    return failure(description, state);
  });
  p.description = description;
  return p;
};

/** A convenience parser for one or more whitespace characters (`\s+`). */
export const whitespace: Parser<string> = regex(/\s+/);
whitespace.description = "whitespace";

/** A parser for a number (integer or float), built using `regex` and `map`. */
export const number: Parser<number> = regex(/-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?/).map(Number);
number.description = "a number";

/** A parser that succeeds only if at the end of the input string. It consumes nothing. */
export const eof: Parser<null> = new Parser(state =>
  state.index === state.input.length
    ? success(null, state)
    : failure('end of file', state)
);


// =================================================================
// Section 5: Combinator Functions
//
// Combinators are higher-order functions that take one or more parsers
// and return a new, more powerful parser. This is the heart of the
// library's composability.
// =================================================================

/**
 * Enables lazy evaluation for a parser, which is essential for defining
 * recursive grammars. A recursive parser (e.g., for JSON) needs to refer
 * to itself, but this creates a circular dependency at initialization.
 * `lazy` breaks this cycle by deferring the creation of the parser until
 * it's actually run.
 *
 * @param fn A zero-argument function that returns the parser.
 * @returns A parser that defers its own creation.
 * @example
 * // A parser for a nested list like `(a (b) c)`
 * const L_PAREN = str('(');
 * const R_PAREN = str(')');
 * const atom = regex(/[a-z]+/);
 * const listContent = lazy(() => choice([atom, list]).many());
 * const list = between(L_PAREN, listContent, R_PAREN);
 */
export const lazy = <T>(fn: () => Parser<T>): Parser<T> => new Parser(state => fn().run(state));

/** A convenience parser for zero or more whitespace characters (`\s*`). */
export const optionalWhitespace = regex(/\s*/);
optionalWhitespace.description = "optional whitespace";

/**
 * Transforms a parser into a "lexeme" parser, which is a parser that also
 * consumes any trailing whitespace but discards it. Wrapping primitive
 * parsers (like keywords or symbols) with `lexeme` simplifies the main
 * grammar rules by handling whitespace automatically.
 *
 * @param parser The parser to convert to a lexeme.
 * @returns A new parser that consumes trailing whitespace.
 * @example
 * const constKeyword = lexeme(str("const"));
 * const identifier = lexeme(regex(/[a-zA-Z_]+/));
 * const parser = sequence([constKeyword, identifier]);
 * // parser.parse("const  myVar  ") succeeds with ["const", "myVar"]
 */
export const lexeme = <T>(parser: Parser<T>): Parser<T> => parser.keepLeft(optionalWhitespace);

/**
 * Applies a sequence of parsers in order and collects their results into a tuple.
 * The `sequence` parser fails if any of its constituent parsers fail.
 *
 * Use this when you need to parse a fixed series of elements that do not
 * depend on each other's parsed values. For dependent sequences, use `.chain()`.
 *
 * @param parsers An array of parsers to apply in order.
 * @param into An optional function to transform the final tuple of results.
 * @returns A parser that produces a tuple of the results.
 * @example
 * const parser = sequence([str('a'), str('b'), str('c')]);
 * // parser.parse("abc") returns ["a", "b", "c"]
 */
export const sequence = <const T extends readonly any[], U = T>(
  parsers: [...{ [K in keyof T]: Parser<T[K]> }],
  into?: (results: T) => U
): Parser<U> =>
  new Parser(state => {
    const results: any[] = [];
    let currentState = state;
    for (const parser of parsers) {
      const result = parser.run(currentState);
      if (result.type === 'failure') return result;
      results.push(result.value);
      currentState = result.state;
    }
    const finalValue = into ? into(results as unknown as T) : (results as U);
    return success(finalValue, currentState);
  });

/**
 * Tries a list of parsers in order, returning the result of the first one to succeed.
 * If all parsers fail, it reports a combined error message based on the parser(s)
 * that got the furthest into the input string before failing. This provides much
 * more intelligent error reporting than a simple `p1.or(p2).or(p3)`.
 *
 * @param parsers An array of alternative parsers.
 * @param into An optional function to transform the successful result.
 * @returns A parser that returns the result of the first successful parser.
 * @example
 * const keyword = choice([str("let"), str("const"), str("var")]);
 * // keyword.parse("const") returns "const"
 * // keyword.parse("function") fails with "Expected "let" or "const" or "var""
 */
export const choice = <const T extends readonly any[], U = T[number]>(
  parsers: [...{ [K in keyof T]: Parser<T[K]> }],
  into?: (result: T[number]) => U
): Parser<U> =>
  new Parser(state => {
    let furthestFailure: Failure | null = null;
    let failuresAtFurthestPoint: { description?: string }[] = [];

    for (const parser of parsers) {
      const result = parser.run(state);
      if (result.type === 'success') {
        const finalValue = into ? into(result.value) : (result.value as U);
        return success(finalValue, result.state);
      }
      
      const newFurthest = !furthestFailure || result.state.index > furthestFailure.state.index;
      if (newFurthest) {
        furthestFailure = result;
        failuresAtFurthestPoint = [parser];
      } else if (furthestFailure && result.state.index === furthestFailure.state.index) {
        failuresAtFurthestPoint.push(parser);
      }
    }

    if (furthestFailure === null) {
        return failure("choice was called with an empty list of parsers", state);
    }

    const expected = failuresAtFurthestPoint.map(p => p.description || 'something').join(' or ');
    return failure(expected, furthestFailure.state, furthestFailure.found);
  });

/**
 * Parses zero or more occurrences of `p`, separated by `separator`.
 * Always succeeds, returning an empty array if `p` doesn't match even once.
 *
 * @param p The parser for the item.
 * @param separator The parser for the separator.
 * @param into An optional function to transform the final array of results.
 * @returns A parser that produces an array of `p`'s results.
 * @example
 * const numberList = sepBy(number, str(','));
 * // numberList.parse("1,2,3") returns [1, 2, 3]
 * // numberList.parse("") returns []
 */
export const sepBy = <T, S, U = T[]>(
  p: Parser<T>,
  separator: Parser<S>,
  into?: (results: T[]) => U
): Parser<U> => {
  const transform = into ?? ((res: T[]) => res as unknown as U);
  const rest = separator.keepRight(p).many();
  const parser = p.chain(first => rest.map(restItems => [first, ...restItems]));
  return parser.or(succeed([])).map(transform);
}

/**
 * Parses one or more occurrences of `p`, separated by `separator`.
 * Fails if `p` doesn't match at least once.
 *
 * @param p The parser for the item.
 * @param separator The parser for the separator.
 * @param into An optional function to transform the final array of results.
 * @returns A parser that produces a non-empty array of `p`'s results.
 * @example
 * const numberList = sepBy1(number, str(','));
 * // numberList.parse("1,2,3") returns [1, 2, 3]
 * // numberList.parse("") fails
 */
export const sepBy1 = <T, S, U = T[]>(
  p: Parser<T>,
  separator: Parser<S>,
  into?: (results: T[]) => U
): Parser<U> => {
  const transform = into ?? ((res: T[]) => res as unknown as U);
  const rest = separator.keepRight(p).many();
  return p.chain(first => rest.map(restItems => transform([first, ...restItems])));
}

/**
 * Parses `content` enclosed by `left` and `right` delimiter parsers.
 * This is a convenient shorthand for `left.keepRight(content).keepLeft(right)`.
 *
 * @param left The parser for the opening delimiter.
 * @param content The parser for the content.
 * @param right The parser for the closing delimiter.
 * @returns A parser that produces the result of the `content` parser.
 * @example
 * const stringInQuotes = between(str('"'), regex(/[^"]asterisk/), str('"'));
 * // stringInQuotes.parse('"hello"') returns "hello"
 */
export const between = <L, C, R>(left: Parser<L>, content: Parser<C>, right: Parser<R>): Parser<C> =>
  left.keepRight(content).keepLeft(right);

/** Standalone function version of the `.optional()` method. */
export const optional = <T>(parser: Parser<T>): Parser<T | null> => parser.optional();

/** Standalone function version of the `.many()` method. */
export const many = <T, U = T[]>(parser: Parser<T>, into?: (results: T[]) => U): Parser<U> => parser.many(into);

/** Standalone function version of the `.many1()` method. */
export const many1 = <T, U = T[]>(parser: Parser<T>, into?: (results: T[]) => U): Parser<U> => parser.many1(into);

// =================================================================
// Section 6: Advanced & Utility Combinators
// =================================================================

/**
 * Overrides a parser's failure message and its `description`. This is useful
 * for providing more user-friendly error messages than the automatically
 * generated ones.
 *
 * @param parser The parser to wrap.
 * @param message The new error message and description.
 * @returns A parser with the customized message.
 * @example
 * const identifier = label(regex(/[a-zA-Z_][a-zA-Z0-9_]* /), "a valid identifier");
 * // identifier.parse("123") fails with "Expected a valid identifier"
 */
export const label = <T>(parser: Parser<T>, message: string): Parser<T> => {
    const p = new Parser(state => {
        const result = parser.run(state);
        return result.type === "failure" ? { ...result, message } : result;
    });
    p.description = message;
    return p;
};

/**
 * Prepends a context string to a parser's error message. This is extremely
 * useful for pinpointing where in a complex grammar an error occurred.
 *
 * @param parser The parser to wrap.
 * @param ctx The context string (e.g., "function declaration", "object literal").
 * @returns A parser with contextual error messages.
 * @example
 * const argList = between(str('('), sepBy(number, str(',')), str(')'));
 * // If argList fails on a missing comma, the error might be:
 * // "[in function call] Expected a comma"
 * const funcCall = context(sequence([regex(/[a-z]+/), argList]), "function call");
 */
export const context = <T>(parser: Parser<T>, ctx: string): Parser<T> =>
  new Parser(state => {
    const result = parser.run(state);
    if (result.type === 'failure') {
      return failure(`[in ${ctx}] ${result.message}`, result.state, result.found);
    }
    return result;
  });

/**
 * A helper for building Abstract Syntax Trees (ASTs). It wraps a parser's
 * result in a basic node object: `{ type: L, value: T }`.
 * @template T The type of the node's `value`.
 * @template L The string literal type for the node's `type`.
 * @param type The string literal to use as the node's `type`.
 * @param parser The parser for the node's `value`.
 * @returns A parser that produces a typed AST node.
 * @example
 * const numberNode = astNode("NumberLiteral", number);
 * // numberNode.parse("123") returns { type: "NumberLiteral", value: 123 }
 */
export function astNode<T, L extends string>(type: L, parser: Parser<T>): Parser<{ type: L; value: T }> {
  return parser.map(value => ({ type, value }));
}

/**
 * Filters a parser's successful result using a predicate function. If the
 * predicate returns `false`, the parser fails. This is a form of semantic
 * validation.
 *
 * @param parser The parser to filter.
 * @param predicate The function to test the result.
 * @param message An optional, custom error message for when the predicate fails.
 * @returns A parser that only succeeds if its result passes the predicate.
 * @example
 * const evenNumber = filter(number, n => n % 2 === 0, "an even number");
 * // evenNumber.parse("4") succeeds with 4
 * // evenNumber.parse("3") fails with "Expected an even number"
 */
export function filter<T>(parser: Parser<T>, predicate: (value: T) => boolean, message?: string): Parser<T> {
  const failureMessage = message || `value to satisfy predicate from '${parser.description || 'parser'}'`;
  return parser.tryMap(value =>
    predicate(value) ? success(value, undefined as any) : failure(failureMessage, undefined as any, `${value}`)
  );
}

/**
 * Succeeds if `parser` would succeed, but crucially, consumes no input.
 * This is a "positive lookahead" assertion. It's used to check for a
 * pattern without actually moving the parser state forward.
 *
 * @param parser The parser to look ahead with.
 * @returns A parser that succeeds with the lookahead result but at the original state.
 * @example
 * // Succeeds if the input is 'ab', but only consumes 'a', returning 'b'.
 * const parser = str('a').keepRight(lookahead(str('b')));
 */
export const lookahead = <T>(parser: Parser<T>): Parser<T> =>
  new Parser(state => {
    const result = parser.run(state);
    return result.type === "success" ? success(result.value, state) : result;
  });

/**
 * Succeeds if `parser` would fail at the current position. Consumes no input
 * and returns `null`. This is a "negative lookahead" assertion, essential for
 * resolving ambiguities in grammars.
 *
 * @param parser The parser that must *not* match.
 * @returns A parser that succeeds with `null` if the forbidden pattern isn't found.
 * @example
 * // A parser for an identifier that isn't a reserved keyword.
 * const keyword = choice([str("if"), str("else"), str("while")]);
 * const identifier = notFollowedBy(keyword).keepRight(regex(/[a-z]+/));
 * // identifier.parse("test") succeeds with "test"
 * // identifier.parse("if") fails
 */
export const notFollowedBy = (parser: Parser<any>): Parser<null> =>
  new Parser(state => {
    const result = lookahead(parser).run(state);
    const expected = parser.description || "something else";
    return result.type === "failure"
      ? success(null, state)
      : failure(`something not followed by ${expected}`, state, `found match for ${expected}`);
  });

/**
 * Memoizes a parser's result to avoid re-computation at the same input position.
 * This is the core of "Packrat Parsing" and can dramatically improve performance
 * for grammars with significant backtracking or overlapping rules, at the cost of memory.
 *
 * @param parser The parser to memoize.
 * @returns A memoized version of the parser.
 */
export const memo = <T>(parser: Parser<T>): Parser<T> => {
  const cache = new Map<number, ParseResult<T>>();
  return new Parser(state => {
    if (cache.has(state.index)) return cache.get(state.index)!;
    const result = parser.run(state);
    cache.set(state.index, result);
    return result;
  });
};

/**
 * Enables parsing of left-recursive grammars by detecting and handling the recursion.
 * A simple recursive descent parser would enter an infinite loop on a left-recursive
 * rule like `expr = expr '+' term`. This combinator uses memoization and progress-checking
 * to correctly parse such rules.
 *
 * @param fn A function that returns the left-recursive parser definition.
 * @returns The complete left-recursive parser.
 * @example
 * // A simple left-recursive expression parser for `1+2+3`
 * const term = number;
 * const addOp = lexeme(str('+'));
 * const expr = leftRecursive(() =>
 *   choice([
 *     // Recursive case: expr + term
 *     sequence([expr, addOp, term]).map(([left, op, right]) => left + right),
 *     // Base case: term
 *     term,
 *   ])
 * );
 * // expr.parse("1+2+3") returns 6
 */
export function leftRecursive<T>(fn: () => Parser<T>): Parser<T> {
  const memo = new Map<number, ParseResult<T>>();
  return new Parser((state: ParserState) => {
    const pos = state.index;
    if (memo.has(pos)) return memo.get(pos)!;
    
    let lastResult: ParseResult<T> = failure('Left recursion base', state);
    memo.set(pos, lastResult);
    
    const parser = fn();
    
    while (true) {
      const currentResult = parser.run(state);
      if (currentResult.type === 'failure') break;
      
      if (lastResult.type === 'success' && currentResult.state.index <= lastResult.state.index) {
          break;
      }
      
      lastResult = currentResult;
      memo.set(pos, lastResult);
    }
    return lastResult;
  });
}

/**
 * A generator-based helper for building sequential parsers in a more "imperative"
 * or synchronous-looking style. This can be more readable than deeply nested
 * `.chain()` calls for complex sequences.
 *
 * Each `yield` returns a parser, and the result of that parse is passed back
 * into the generator. The final `return` of the generator is the success value.
 *
 * @param gen A generator function that yields parsers.
 * @returns A parser that executes the generator's logic.
 * @example
 * const letBinding = genParser(function* () {
 *   yield lexeme(str("let"));
 *   const identifier = yield lexeme(regex(/[a-z]+/));
 *   yield lexeme(str("="));
 *   const value = yield number;
 *   yield str(';');
 *   return { identifier, value };
 * });
 * // letBinding.parse("let x = 10;") returns { identifier: "x", value: 10 }
 */
export function genParser<T>(gen: () => Generator<Parser<any>, T, any>): Parser<T> {
  return new Parser(state => {
    const iterator = gen();
    let currentState = state;
    let nextValue: any = undefined;

    while (true) {
      const { value: parser, done } = iterator.next(nextValue);
      if (done) return success(parser, currentState);
      
      const result = (parser as Parser<any>).run(currentState);
      if (result.type === "failure") return result;

      currentState = result.state;
      nextValue = result.value;
    }
  });
}

/**
 * Consumes and returns characters as a string until the `terminator` parser
 * succeeds. The terminator itself is not consumed.
 *
 * @param terminator The parser that signals the end of the content.
 * @returns A parser that produces the string content.
 * @example
 * // A parser for a C-style block comment /* comment text * /
 * const startComment = str('/asterisk');
 * const endComment = str('asterisk/');
 * const commentText = until(endComment);
 * const blockComment = startComment.keepRight(commentText).keepLeft(endComment);
 * // blockComment.parse('/asterisk hello asterisk/') returns ' hello '
 */
export function until(terminator: Parser<any>): Parser<string> {
  const p = many(anyChar.keepLeft(notFollowedBy(terminator))).map(chars => chars.join(''));
  p.description = `content until ${terminator.description}`;
  return p;
}

/**
 * Applies `parser` exactly `n` times, returning the results in an array.
 * Fails if the parser cannot be applied exactly `n` times.
 *
 * @param n The exact number of times to apply the parser.
 * @param parser The parser to apply repeatedly.
 * @returns A parser that produces an array of `n` results.
 * @example
 * const threeDigits = count(3, charClass("Digit"));
 * // threeDigits.parse("123") returns ["1", "2", "3"]
 * // threeDigits.parse("12") fails
 */
export function count<T>(n: number, parser: Parser<T>): Parser<T[]> {
  const p = new Parser(state => {
      const results: T[] = [];
      let currentState = state;
      for (let i = 0; i < n; i++) {
          const result = parser.run(currentState);
          if (result.type === 'failure') {
              return failure(`${i+1}-th item of ${n} for ${parser.description}`, result.state, result.found);
          }
          results.push(result.value);
          currentState = result.state;
      }
      return success(results, currentState);
  });
  p.description = `${n} of ${parser.description}`;
  return p;
}

/** A placeholder for a potential future feature to generate a full parser from a formal grammar definition string. */
export function fromGrammar(_grammar: string): never {
  throw new ParserError("fromGrammar is a placeholder and not implemented.");
}

/**
 * Flattens a parser's nested array result to a specified depth.
 * This is a convenience wrapper around `Array.prototype.flat`.
 *
 * @param parser The parser which produces an array (often nested).
 * @param depth The depth to flatten to. Defaults to 1.
 * @returns A parser that produces a flattened array.
 * @example
 * const parser = sequence([str('a'), sequence([str('b'), str('c')])]); // Produces ['a', ['b', 'c']]
 * const flattened = flatten(parser);
 * // flattened.parse('abc') returns ['a', 'b', 'c']
 */
export function flatten<D extends number = 1>(parser: Parser<any[]>, depth?: D): Parser<any[]> {
  return parser.map(arr => arr.flat(depth));
}

// =================================================================
// Section 7: Type-Safe Character Class Parser
// =================================================================

/**
 * The primary, recommended way to parse single characters. It provides powerful
 * type inference based on its input.
 *
 * It accepts either a named character class from a predefined set (e.g., 'Digit')
 * or a custom string of allowed characters.
 *
 * @param name A named character class like 'Digit' or 'UppercaseLetter'.
 * @returns A parser with a precise, specific return type derived from the class.
 * @example
 * // digitParser has type Parser<"0" | "1" | ... | "9">
 * const digitParser = charClass('Digit');
 */
export function charClass<N extends CC.CharClassName>(name: N): Parser<CC.CharClassTypeMap[N]>;
/**
 * The primary, recommended way to parse single characters.
 *
 * When given a custom string literal, it uses advanced TypeScript types
 * to infer a union of the characters in that string as the return type.
 *
 * @param chars A custom string of characters to match against.
 * @returns A parser whose success type is a union of the characters provided.
 * @example
 * // vowelParser has type Parser<"a" | "e" | "i" | "o" | "u">
 * const vowelParser = charClass('aeiou');
 */
export function charClass<S extends string>(chars: S): Parser<ToCharUnion<S>>;
export function charClass(nameOrChars: string): Parser<string> {
  if (nameOrChars in CC.CHAR_CLASS_STRINGS) {
    const charSet = CC.CHAR_CLASS_STRINGS[nameOrChars as CC.CharClassName];
    const p = anyOf(charSet) as Parser<any>;
    p.description = `a ${nameOrChars}`;
    return p;
  }
  return anyOf(nameOrChars);
}