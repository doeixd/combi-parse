// =================================================================
//
//      A Type-Safe, Generic Parser Combinator Library for TypeScript
//
//      This library provides a set of tools to build complex parsers from
//      simple, reusable functions ("combinators"). It is designed to be:
//
//      - Type-Safe: Leverage the TypeScript type system to catch parsing
//        logic errors at compile time. Parsers know the type of data
//        they produce.
//      - Composable: Build complex parsers by combining smaller ones,
//        mirroring the structure of the data you want to parse.
//      - Readable: The code for the parser often looks like a formal
//        grammar, making it easy to understand and maintain.
//      - Powerful: Includes advanced features like left-recursion support,
//        generator-based syntax, and detailed error reporting.
//
// =================================================================

import * as CC from './master-char-classes';

// =================================================================
// Section 1: Core Types & Result Helpers
// =================================================================

/**
 * Represents the immutable state of the parser at any point in time.
 * It's a "cursor" that tracks the full input string and the current
 * position (index) within it.
 */
export interface ParserState {
  /** The full input string being parsed. This is never modified. */
  readonly input: string;
  /** The current zero-based offset into the `input` string. */
  readonly index: number;
}

/**
 * Represents a successful parse operation. It contains the data that was
 * successfully parsed and the new state of the parser, ready for the
 * next operation.
 *
 * @template T The type of the successfully parsed value.
 */
export interface Success<T> {
  readonly type: "success";
  /** The value constructed by the parser. */
  readonly value: T;
  /** The state of the parser *after* this part of the input was consumed. */
  readonly state: ParserState;
}

/**
 * Represents a failed parse operation. It contains a descriptive error
 * message and the state at which the parse failed, which is crucial for
 * providing useful error diagnostics to the user.
 */
export interface Failure {
  readonly type: "failure";
  /** A message explaining why the parser failed. */
  readonly message: string;
  /** The state of the parser at the exact point of failure. */
  readonly state: ParserState;
}

/**
 * A discriminated union representing the outcome of a parser's `run` function.
 * A parser can either succeed with a value of type `T` or fail.
 *
 * @template T The type of the value produced on success.
 */
export type ParseResult<T> = Success<T> | Failure;

/**
 * A factory function to create a `Success<T>` result object. Using this
 * helper ensures consistency and improves readability within the library.
 *
 * @template T The type of the successful value.
 * @param value The successfully parsed and constructed value.
 * @param state The new `ParserState` after consuming input.
 * @returns A `Success<T>` object.
 */
export const success = <T>(value: T, state: ParserState): Success<T> => ({
  type: 'success',
  value,
  state,
});

/**
 * A factory function to create a `Failure` result object. Using this
 * helper ensures consistency and improves readability within the library.
 *
 * @param message A string explaining the reason for the failure.
 * @param state The `ParserState` at the point of failure.
 * @returns A `Failure` object.
 */
export const failure = (message: string, state: ParserState): Failure => ({
  type: 'failure',
  message,
  state,
});


// =================================================================
// Section 2: Advanced Type-Level Utilities
// =================================================================

/**
 * A utility type that recursively splits a string literal into a union of its
 * individual characters. This is a powerful tool for creating highly specific
 * and type-safe parsers from string literals.
 *
 * It is used by `charClass` to infer a precise return type.
 *
 * @example
 * // The type `MyChars` will be `"a" | "b" | "c"`.
 * type MyChars = ToCharUnion<"abc">;
 */
export type ToCharUnion<S extends string> = S extends `${infer Char}${infer Rest}` ? Char | ToCharUnion<Rest> : never;


// =================================================================
// Section 3: The Parser Class
// =================================================================

/** Options for the final `.parse()` method execution. */
export interface ParseOptions {
  /**
   * If `true`, the parser must consume the entire input string for the
   * parse to be considered successful. If any input is left over, an
   * error will be thrown. This is useful for parsing complete documents.
   *
   * @default true
   */
  readonly consumeAll?: boolean;
}

class ParserError extends Error {}

/**
 * The core Parser class. A `Parser<T>` is an object that wraps a function
 * that knows how to parse a slice of an input string and produce a value of
 * type `T`.
 *
 * Parsers are immutable. Methods like `.map()` or `.chain()` do not modify
 * the original parser; they return a new `Parser` instance.
 *
 * @template T The type of the value this parser produces on success.
 */
export class Parser<T> {

  describe?(): string; 
  /**
   * The heart of the parser. This function takes the current `ParserState` and
   * attempts to parse the input. It returns either a `Success` or `Failure`.
   * All combinators and methods ultimately work by creating new `run` functions.
   */
  constructor(public readonly run: (state: ParserState) => ParseResult<T>) { }

  /**
   * Runs the parser against a given input string. This is the main entry point
   * for executing a parser you have constructed.
   *
   * If parsing is successful and (by default) the entire input is consumed,
   * it returns the parsed value of type `T`.
   *
   * On failure, it throws a detailed `ParserError` with a message that includes
   * the line and column number of the failure, making debugging much easier.
   *
   * @param input The string to parse.
   * @param options Configuration for the parsing process.
   * @returns The successfully parsed value of type `T`.
   * @throws {ParserError} if the parser fails or does not consume all input (when `consumeAll` is true).
   *
   * @example
   * const helloParser = str("Hello");
   * try {
   *   const result = helloParser.parse("Hello"); // -> "Hello"
   *   console.log(result);
   * } catch (e) {
   *   console.error(e.message); // e.g., "Parse error at line 1, col 1: Expected "Hello""
   * }
   */
  parse(input: string, options: ParseOptions = { consumeAll: true }): T {
    const result = this.run({ input, index: 0 });

    if (result.type === "failure") {
      const { index } = result.state;
      // Calculate line and column for better error reporting
      const lines = input.substring(0, index).split('\n');
      const line = lines.length;
      const col = lines[lines.length - 1].length + 1;
      throw new ParserError(`Parse error at line ${line}, col ${col}: ${result.message}`);
    }

    if (options.consumeAll && result.state.index !== input.length) {
      throw new ParserError(`Parse error: Parser did not consume entire input. Stopped at index ${result.state.index}.`);
    }

    return result.value;
  }

  /**
   * Transforms the successful result of a parser. If the parser succeeds,
   * its value is passed through the mapping function `fn` to produce a new value.
   * If the parser fails, the failure is passed through unchanged.
   *
   * This is one of the most common and useful combinators.
   *
   * @template U The new type of the parser's successful result.
   * @param fn The function to apply to the successful result.
   * @returns A new `Parser<U>` that produces the transformed value.
   *
   * @example
   * // A parser that reads one or more digits and converts the string to a number.
   * const numberParser = regex(/[0-9]+/).map(Number);
   * numberParser.parse("123"); // -> 123 (a number, not "123")
   */
  map<U>(fn: (value: T) => U): Parser<U> {
    return new Parser(state => {
      const result = this.run(state);
      return result.type === "success" ? success(fn(result.value), result.state) : result;
    });
  }

  /**
   * Chains a second parser after this one, allowing the second parser to
   * depend on the result of the first. This is the monadic "bind" operation
   * (`>>=` in Haskell) and is essential for creating context-sensitive parsers.
   *
   * If this parser fails, the whole chain fails. If it succeeds, its result
   * is passed to the function `fn`, which must return a *new parser* to be
   * run on the remaining input.
   *
   * @template U The result type of the next parser.
   * @param fn A function that takes the result of the current parser and returns the next parser to run.
   * @returns A new `Parser<U>` that represents the sequential composition.
   *
   * @example
   * // Parse a length-prefixed string: "3:abc"
   * const lengthPrefixedString = number.chain(len =>
   *   str(":").keepRight(regex(new RegExp(`.{${len}}`)))
   * );
   * lengthPrefixedString.parse("4:test"); // -> "test"
   */
  chain<U>(fn: (value: T) => Parser<U>): Parser<U> {
    return new Parser(state => {
      const result = this.run(state);
      // If the first parser failed, the whole chain fails.
      if (result.type === "failure") return result;
      // Otherwise, run the parser produced by the chaining function.
      return fn(result.value).run(result.state);
    });
  }

  /**
   * Applies the parser zero or more times, collecting all successful results
   * into an array. This parser cannot fail; if it can't match even once, it
   * succeeds with an empty array.
   *
   * **Note:** The parser provided to `many` *must* consume input on success
   * to prevent infinite loops. An error is returned if a zero-width success occurs.
   *
   * @template U The desired output type. Defaults to an array of the parser's results (`T[]`).
   * @param into An optional function to transform the final array of results.
   * @returns A `Parser<U>` that collects multiple results.
   *
   * @example
   * const aParser = str("a");
   * const aS = aParser.many();
   * aS.parse("aaa"); // -> ["a", "a", "a"]
   * aS.parse("");    // -> []
   *
   * // With an `into` function to count the occurrences
   * const countAs = aParser.many(results => results.length);
   * countAs.parse("aa"); // -> 2
   */
  many<U = T[]>(into?: (results: T[]) => U): Parser<U> {
    const transform = into ?? ((res: T[]) => res as unknown as U);
    return new Parser(state => {
      const results: T[] = [];
      let currentState = state;
      while (true) {
        const result = this.run(currentState);

        if (result.type === 'failure') {
          // It's not a failure for `many`, it just means we're done.
          return success(transform(results), currentState);
        }

        // Infinite loop guard: if a parser succeeds without consuming input,
        // `many` would loop forever. We must fail.
        if (result.state.index === currentState.index) {
          return failure('Infinite loop in .many(): parser succeeded without consuming input.', state);
        }

        results.push(result.value);
        currentState = result.state;
      }
    });
  }

  /**
   * Applies the parser **one** or more times, collecting all successful results
   * into an array. This parser will fail if it cannot match at least once.
   *
   * @template U The desired output type. Defaults to an array of the parser's results (`T[]`).
   * @param into An optional function to transform the final array of results.
   * @returns A `Parser<U>` that collects one or more results.
   *
   * @example
   * const digitParser = regex(/[0-9]/);
   * const digits = digitParser.many1();
   * digits.parse("123"); // -> ["1", "2", "3"]
   *
   * // This will fail because it needs at least one match.
   * // digits.parse("abc"); // Throws ParserError
   *
   * // With an `into` function to join the strings.
   * const numberString = digitParser.many1(results => results.join(''));
   * numberString.parse("456"); // -> "456"
   */
  many1<U = T[]>(into?: (results: T[]) => U): Parser<U> {
    // This is defined in terms of one mandatory parse, followed by `many`.
    return this.chain(first =>
      this.many().map(rest => {
        const all = [first, ...rest];
        return into ? into(all) : (all as unknown as U);
      })
    );
  }

  /**
   * Provides an alternative parser. It first tries to run the current parser.
   * If it succeeds, the result is used. If it fails *without consuming any input*,
   * it then tries the `other` parser.
   *
   * This "no-input consumed" rule is important. If a parser fails after consuming
   * input, it often means we've committed to a specific parsing path, and
   * switching to an alternative is not the right thing to do.
   *
   * @template U The type of the alternative parser's result.
   * @param other The parser to try if this one fails without consuming input.
   * @returns A new `Parser<T | U>` that can produce a value of either type.
   *
   * @example
   * const tryA = str("a");
   * const tryB = str("b");
   * const aOrB = tryA.or(tryB);
   *
   * aOrB.parse("a"); // -> "a"
   * aOrB.parse("b"); // -> "b"
   */
  or<U>(other: Parser<U>): Parser<T | U> {
    return new Parser<T | U>((state: ParserState) => {
      const result = this.run(state);
      // Only try the other parser if the first one failed at the same spot.
      if (result.type === 'failure' && result.state.index === state.index) {
        return other.run(state);
      }
      return result as ParseResult<T | U>; // Type cast is safe here
    });
  }

  /**
   * Makes the parser optional. If the parser succeeds, its result is returned.
   * If it fails (without consuming input), it succeeds with a value of `null`.
   *
   * @returns A new `Parser<T | null>` that will never fail.
   *
   * @example
   * const optionalFlag = str("-v").optional();
   *
   * optionalFlag.parse("-v"); // -> "-v"
   * optionalFlag.parse("");   // -> null
   */
  optional(): Parser<T | null> {
    return this.or(succeed(null));
  }

  /**
   * Runs another parser `p` *after* this one succeeds, but discards the result
   * of this parser, keeping the result of `p`.
   *
   * Also known as "sequence and keep right".
   *
   * @template U The result type of the parser to keep.
   * @param p The parser to run second.
   * @returns A `Parser<U>` that produces the result of `p`.
   *
   * @example
   * const tagStart = str("<");
   * const tagName = regex(/[a-z]+/);
   *
   * // We parse "<" then a tag name, but only care about the name.
   * const openTag = tagStart.keepRight(tagName);
   * openTag.parse("<tag"); // -> "tag"
   */
  keepRight<U>(p: Parser<U>): Parser<U> {
    return this.chain(() => p);
  }

  /**
   * Runs another parser `p` *after* this one succeeds, but discards the result
   * of `p`, keeping the result of this parser.
   *
   * Also known as "sequence and keep left". This is very useful for parsing
   * tokens followed by delimiters or whitespace.
   *
   * @template U The result type of the parser to discard.
   * @param p The parser to run second.
   * @returns A `Parser<T>` that produces the result of the first parser.
   *
   * @example
   * const identifier = regex(/[a-z]+/);
   * const semicolon = str(";");
   *
   * // We parse an identifier then a semicolon, but only care about the identifier.
   * const statement = identifier.keepLeft(semicolon);
   * statement.parse("myVar;"); // -> "myVar"
   */
  keepLeft<U>(p: Parser<U>): Parser<T> {
    return this.chain(res => p.map(() => res));
  }
  
  debug(label?: string): Parser<T> {
    return new Parser(state => {
      const prefix = label ? `[${label}] ` : '';
      console.log(`${prefix}Trying at position ${state.index}: "${state.input.slice(state.index, state.index + 20)}..."`);

      const result = this.run(state);

      if (result.type === 'success') {
        console.log(`${prefix}✅ Success! Consumed: "${state.input.slice(state.index, result.state.index)}"`);
      } else {
        console.log(`${prefix}❌ Failed: ${result.message}`);
      }

      return result;
    })
  };
  
}

// =================================================================
// Section 4: Primitive Parsers
// =================================================================
// These are the fundamental building blocks for all other parsers.

/**
 * A parser that always succeeds with the given `value`, and crucially,
 * **consumes no input**.
 *
 * This is useful as a starting point for `chain`, as a base case for
 * recursion, or as a way to inject a value into a parsing pipeline.
 *
 * @template T The type of the value to succeed with.
 * @param value The value the parser will produce.
 * @returns A `Parser<T>` that always succeeds.
 *
 * @example
 * // Succeeds and returns an empty object, consuming nothing.
 * succeed({}).parse(""); // -> {}
 */
export const succeed = <T>(value: T): Parser<T> => new Parser(state => success(value, state));

/**
 * A parser that always fails with the given `message`, and **consumes no input**.
 * This is useful for signaling a custom parsing error inside a `chain`.
 *
 * @param message The error message for the failure.
 * @returns A `Parser<never>` that always fails. Note `never` indicates it can never produce a value.
 *
 * @example
 * const aThenFail = str("a").chain(() => fail("Something went wrong after 'a'"));
 * // aThenFail.parse("a"); // Throws ParserError: "...Something went wrong after 'a'"
 */
export const fail = (message: string): Parser<never> => new Parser(state => failure(message, state));

/**
 * Creates a parser that matches a specific string literal at the current position.
 *
 * @template S The exact string literal type.
 * @param s The string to match.
 * @returns A `Parser<S>` that succeeds if `s` is found at the current position.
 *
 * @example
 * const constParser = str("const");
 * constParser.parse("const x = 1;"); // -> "const"
 */
export const str = <S extends string>(s: S): Parser<S> =>
  new Parser(state => {
    if (state.input.startsWith(s, state.index)) {
      const newState = { ...state, index: state.index + s.length };
      return success(s, newState);
    }
    return failure(`Expected "${s}"`, state);
  });

/**
 * A low-level helper. Creates a parser that succeeds if the next character
 * in the input is a member of the given string `chars`.
 * This is the engine behind the more type-safe `charClass` parser.
 *
 * @param chars A string containing all allowed characters.
 * @returns A `Parser<string>` that produces the matched character.
 * @internal Prefer using the more powerful and type-safe `charClass` function.
 */
const anyOf = (chars: string): Parser<string> =>
  new Parser(state => {
    if (state.index >= state.input.length) {
      return failure('Unexpected end of input', state);
    }
    const char = state.input[state.index];
    if (chars.includes(char)) {
      const newState = { ...state, index: state.index + 1 };
      return success(char, newState);
    }
    const truncatedChars = chars.length > 20 ? `${chars.slice(0, 20)}...` : chars;
    return failure(`Expected one of [${truncatedChars}]`, state);
  });

/**
 * Creates a parser that succeeds if the next character in the input is **not**
 * a member of the given string `chars`.
 *
 * @param chars A string containing all disallowed characters.
 * @returns A `Parser<string>` that produces the matched character.
 *
 * @example
 * // A parser for any character that is not a quote.
 * const notQuote = noneOf('"');
 * notQuote.parse("abc"); // -> "a"
 */
export const noneOf = (chars:string): Parser<string> =>
  new Parser(state => {
    if (state.index >= state.input.length) {
      return failure('Unexpected end of input', state);
    }
    const char = state.input[state.index];
    if (!chars.includes(char)) {
      const newState = { ...state, index: state.index + 1 };
      return success(char, newState);
    }
    return failure(`Expected a character not in "${chars}"`, state);
  });

/**
 * Creates a parser that matches a regular expression at the current position.
 * The regex is automatically anchored with `^` to ensure it only matches
 * from the current index.
 *
 * @param re The `RegExp` to match.
 * @returns A `Parser<string>` that produces the full matched string.
 *
 * @example
 * const identifier = regex(/[a-zA-Z_][a-zA-Z0-9_]* /);
 * identifier.parse("my_var = 42"); // -> "my_var"
 */
export const regex = (re: RegExp): Parser<string> => {
  // We create a new RegExp to ensure it's anchored to the start of the slice.
  // This is crucial for correct behavior within the parser state.
  const anchoredRegex = new RegExp(`^${re.source}`, re.flags);
  return new Parser(state => {
    const remainingInput = state.input.slice(state.index);
    const match = remainingInput.match(anchoredRegex);
    if (match) {
      const matchedString = match[0];
      const newState = { ...state, index: state.index + matchedString.length };
      return success(matchedString, newState);
    }
    return failure(`Expected to match regex /${re.source}/`, state);
  });
};

/**
 * A pre-built parser for one or more digits (`[0-9]+`) that returns the
 * parsed value as a `number`.
 *
 * @example
 * number.parse("12345xyz"); // -> 12345
 */
export const number: Parser<number> = regex(/[0-9]+/).map(Number);

/**
 * A pre-built parser for one or more whitespace characters (`\s+`).
 * This is useful for mandatory spacing between tokens. For optional
 * spacing, see `lexeme`.
 *
 * @example
 * whitespace.parse("   \n\t "); // -> "   \n\t "
 */
export const whitespace: Parser<string> = regex(/\s+/);

/**
 * A parser that succeeds only if it is at the end of the input string.
 * It consumes no input and returns `null` on success.
 *
 * This is often used at the end of a top-level parser to ensure the
 * entire file has been consumed.
 *
 * @example
 * const fullNumber = number.keepLeft(eof);
 * fullNumber.parse("123"); // -> 123
 * // fullNumber.parse("123a"); // Throws ParserError: "...Expected end of file"
 */
export const eof: Parser<null> = new Parser(state =>
  state.index === state.input.length
    ? success(null, state)
    : failure('Expected end of file', state)
);


// =================================================================
// Section 5: Combinator Functions
// =================================================================

/**
 * Wraps a parser-producing function to enable lazy evaluation. This is
 * **essential** for defining recursive parsers, such as for nested data
 * structures (e.g., JSON, parenthesized expressions), which would otherwise
 * cause an infinite loop during parser construction.
 *
 * @template T The result type of the wrapped parser.
 * @param fn A zero-argument function that returns the parser to be used.
 * @returns A `Parser<T>` that will not be fully constructed until it is run.
 *
 * @example
 * // A parser for values in a nested list like `(a b (c) d)`
 * // `lazy` is required here because `valueParser` refers to itself.
 * const valueParser: Parser<any> = choice([
 *   regex(/[a-z]+/),
 *   lazy(() => listParser)
 * ]);
 * const listParser = between(str("("), valueParser.many(), str(")"));
 *
 * listParser.parse("(a b (c) d)"); // -> ['a', 'b', ['c'], 'd']
 */
export const lazy = <T>(fn: () => Parser<T>): Parser<T> => new Parser(state => fn().run(state));

/** A parser for zero or more whitespace characters. Used by `lexeme`. Defined once for performance. */
const optionalWhitespace = regex(/\s*/);

/**
 * A "lexing" combinator that transforms a parser into one that consumes
 * any trailing whitespace. This is a common pattern for tokenizing input,
 * where the space between tokens is insignificant.
 *
 * @template T The result type of the wrapped parser.
 * @param parser The parser for the "content" or "token".
 * @returns A new `Parser<T>` that parses the content and then any trailing whitespace.
 *
 * @example
 * // A parser for a number that also eats the whitespace after it.
 * const lexedNumber = lexeme(number);
 *
 * // Notice how the whitespace is consumed but not part of the result.
 * const p = sequence([lexedNumber, lexedNumber]);
 * p.parse("10  20  "); // -> [10, 20]
 */
export const lexeme = <T>(parser: Parser<T>): Parser<T> => parser.keepLeft(optionalWhitespace);

/**
 * Applies a sequence of parsers in order and collects their results into a
 * tuple. If any parser in the sequence fails, the entire `sequence` fails.
 *
 * The type of the resulting tuple is inferred from the input array of parsers,
 * providing excellent type safety.
 *
 * @template T A tuple of the result types from the parsers.
 * @template U The desired output type after transformation.
 * @param parsers An array of parsers to run in order. The `const` assertion (`as const`)
 * is recommended on the call-site for the best type inference.
 * @param into An optional function to transform the resulting tuple into a different type `U`.
 * @returns A `Parser<U>` that produces the collected or transformed results.
 *
 * @example
 * // Parse `let x = 10;`
 * const letParser = sequence(
 *   [lexeme(str("let")), lexeme(regex(/[a-z]+/)), lexeme(str("=")), lexeme(number), str(";")] as const,
 *   ([, name, , val]) => ({ name, value: val }) // Use `into` to build an object
 * );
 *
 * letParser.parse("let myVar = 42;"); // -> { name: "myVar", value: 42 }
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
 * Tries a list of alternative parsers in order, returning the result of the
 * first one to succeed.
 *
 * If all alternatives fail, `choice` reports the error from the parser that
 * made the most progress through the input string. This "best-effort" error
 * reporting is more helpful than just reporting the last failure.
 *
 * @template T A tuple of the potential result types.
 * @template U The final output type. Defaults to a union of all possible parser results.
 * @param parsers An array of parsers to try.
 * @param into An optional function to transform the successful result.
 * @returns A `Parser<U>` representing the choice.
 *
 * @example
 * const keywordParser = choice([str("let"), str("const"), str("var")]);
 * keywordParser.parse("let x"); // -> "let"
 * keywordParser.parse("const y"); // -> "const"
 *
 * const valueParser = choice([number, str("true").map(() => true), str("false").map(() => false)]);
 * valueParser.parse("123"); // -> 123
 * valueParser.parse("true"); // -> true
 */
export const choice = <const T extends readonly any[], U = T[number]>(
  parsers: [...{ [K in keyof T]: Parser<T[K]> }],
  into?: (result: T[number]) => U
): Parser<U> =>
  new Parser(state => {
    let furthestFailure: Failure | null = null;
    for (const parser of parsers) {
      const result = parser.run(state);
      if (result.type === 'success') {
        const finalValue = into ? into(result.value) : (result.value as U);
        return success(finalValue, result.state);
      }
      // Track the failure that got the furthest into the input.
      if (!furthestFailure || result.state.index > furthestFailure.state.index) {
        furthestFailure = result;
      }
    }
    return furthestFailure ?? failure("Choice: No alternatives succeeded", state);
  });

/**
 * Parses **zero or more** occurrences of `p`, separated by `separator`.
 * This is extremely useful for parsing comma-separated lists, for example.
 *
 * @template T The type of the item being parsed.
 * @template S The type of the separator (often discarded).
 * @template U The desired output type, defaults to `T[]`.
 * @param p The parser for the item.
 * @param separator The parser for the separator.
 * @param into An optional function to transform the final array of results.
 * @returns A `Parser<U>` for the separated list.
 *
 * @example
 * const comma = lexeme(str(","));
 * const listOfNumbers = sepBy(number, comma);
 *
 * listOfNumbers.parse("1, 2, 3"); // -> [1, 2, 3]
 * listOfNumbers.parse("42");      // -> [42]
 * listOfNumbers.parse("");        // -> []
 */
export const sepBy = <T, S, U = T[]>(
  p: Parser<T>,
  separator: Parser<S>,
  into?: (results: T[]) => U
): Parser<U> => {
  const transform = into ?? ((res: T[]) => res as unknown as U);
  // `p` followed by many `separator` `p`'s, or an empty list.
  const rest = separator.keepRight(p).many();
  const parser = p.chain(first => rest.map(restItems => [first, ...restItems]));
  return parser.or(succeed([])).map(transform);
}

/**
 * Parses **one or more** occurrences of `p`, separated by `separator`.
 * This will fail if it cannot parse at least one `p`.
 *
 * @template T The type of the item being parsed.
 * @template S The type of the separator (often discarded).
 * @template U The desired output type, defaults to `T[]`.
 * @param p The parser for the item.
 * @param separator The parser for the separator.
 * @param into An optional function to transform the final array of results.
 * @returns A `Parser<U>` for the separated list.
 *
 * @example
 * const comma = lexeme(str(","));
 * const listOfNumbers = sepBy1(number, comma);
 *
 * listOfNumbers.parse("1, 2, 3"); // -> [1, 2, 3]
 * listOfNumbers.parse("42");      // -> [42]
 * // listOfNumbers.parse("");     // Throws ParserError
 */
export const sepBy1 = <T, S, U = T[]>(
  p: Parser<T>,
  separator: Parser<S>,
  into?: (results: T[]) => U
): Parser<U> => {
  const transform = into ?? ((res: T[]) => res as unknown as U);
  const rest = separator.keepRight(p).many();
  // `p` followed by many `separator` `p`'s. No empty case.
  return p.chain(first => rest.map(restItems => transform([first, ...restItems])));
}

/**
 * A combinator for parsing content enclosed by delimiters (like parentheses,
 * brackets, or quotes), discarding the delimiters' results.
 *
 * It is equivalent to `left.keepRight(content).keepLeft(right)`.
 *
 * @template L The type of the left delimiter (discarded).
 * @template C The type of the content (kept).
 * @template R The type of the right delimiter (discarded).
 * @param left The parser for the opening delimiter.
 * @param content The parser for the content.
 * @param right The parser for the closing delimiter.
 * @returns A `Parser<C>` that produces the result of the `content` parser.
 *
 * @example
 * const doubleQuote = str('"');
 * const anyString = regex(/[^"]/);
 * const quotedString = between(doubleQuote, anyString, doubleQuote);
 *
 * quotedString.parse('"hello world"'); // -> "hello world"
 */
export const between = <L, C, R>(left: Parser<L>, content: Parser<C>, right: Parser<R>): Parser<C> =>
  left.keepRight(content).keepLeft(right);

/**
 * Makes a parser optional. If the parser succeeds, its result is returned.
 * If it fails (without consuming input), it succeeds with a value of `null`.
 * This is the standalone function version of the `.optional()` method.
 *
 * @template T The type of the parser's result.
 * @param parser The parser to make optional.
 * @returns A new `Parser<T | null>` that will never fail on non-consuming input.
 *
 * @example
 * const optionalFlag = optional(str("--verbose"));
 * optionalFlag.parse("--verbose main.c"); // -> "--verbose"
 * optionalFlag.parse("main.c");          // -> null
 */
export const optional = <T>(parser: Parser<T>): Parser<T | null> => parser.optional();


// =================================================================
// Section 6: Advanced & Utility Combinators
// =================================================================

/**
 * Overrides the error message of a parser. If the given parser fails,
 * its original message is replaced with the new `message`. This is useful
 * for creating more specific and user-friendly error diagnostics.
 *
 * @template T The parser's result type.
 * @param parser The parser to wrap.
 * @param message The new error message to use on failure.
 * @returns A `Parser<T>` with a custom failure message.
 *
 * @example
 * const ipPart = regex(/[0-9]{1,3}/);
 * const labeledIpPart = label(ipPart, "an IP address part (0-255)");
 *
 * // Throws with a much clearer error message.
 * // labeledIpPart.parse("abc"); // ParserError: "...an IP address part (0-255)"
 * // instead of the default:     // ParserError: "...Expected to match regex /[0-9]{1,3}/"
 */
export const label = <T>(parser: Parser<T>, message: string): Parser<T> =>
  new Parser(state => {
    const result = parser.run(state);
    // If it's a failure, replace the message. Otherwise, pass through.
    return result.type === "failure" ? { ...result, message } : result;
  });

/**
 * Adds a contextual label to a parser's error message. If the parser fails,
 * the context string is prepended to the error message. This helps create a
 * "stack trace" of what the parser was trying to do when it failed.
 *
 * @template T The parser's result type.
 * @param parser The parser to wrap.
 * @param ctx The context string to prepend to the error message.
 * @returns A `Parser<T>` with a contextualized failure message.
 *
 * @example
 * const numberParser = context(number, "parsing a value");
 * const assignmentParser = context(sequence([regex(/[a-z]+/), str("="), numberParser]), "parsing an assignment");
 *
 * // Throws ParserError: "...[parsing an assignment] [parsing a value] Expected to match regex /[0-9]+/"
 * // assignmentParser.parse("x=y");
 */
export const context = <T>(parser: Parser<T>, ctx: string): Parser<T> =>
  new Parser(state => {
    const result = parser.run(state);
    if (result.type === 'failure') {
      return failure(`[${ctx}] ${result.message}`, result.state);
    }
    return result;
  });

/**
 * A helper to wrap a parser's successful result in a labeled object,
 * forming a basic Abstract Syntax Tree (AST) node. This is a common pattern
 * for structuring parsed output.
 *
 * @template T The type of the value being wrapped.
 * @template L The string literal type for the node's `type` property.
 * @param label The label to use for the `type` property of the node.
 * @param parser The parser that produces the `value` for the node.
 * @returns A `Parser` that produces an object `{ type: L, value: T }`.
 *
 * @example
 * const numberNode = astNode("NumberLiteral", number);
 * numberNode.parse("123"); // -> { type: "NumberLiteral", value: 123 }
 */
export function astNode<T, L extends string>(label: L, parser: Parser<T>): Parser<{ type: L; value: T }> {
  return parser.map(value => ({ type: label, value }));
}

/**
 * Filters a parser's result using a predicate function. If the parser
 * succeeds, the predicate is called with the result. If the predicate
 * returns `true`, the `filter` parser succeeds. If it returns `false`,
 * the `filter` parser fails.
 *
 * This allows for semantic validation on top of syntactic parsing.
 *
 * @template T The parser's result type.
 * @param parser The parser to filter.
 * @param predicate A function that returns `true` for valid results.
 * @param message An optional error message for when the filter fails.
 * @returns A `Parser<T>` that also validates the parsed value.
 *
 * @example
 * // A parser for a single even digit
 * const evenDigit = filter(
 *   regex(/[0-9]/).map(Number),
 *   (n) => n % 2 === 0,
 *   "Expected an even digit"
 * );
 * evenDigit.parse("4"); // -> 4
 * // evenDigit.parse("3"); // Throws ParserError: "...Expected an even digit"
 */
export function filter<T>(parser: Parser<T>, predicate: (value: T) => boolean, message = "filter failed"): Parser<T> {
  return parser.chain(value =>
    predicate(value) ? succeed(value) : fail(message)
  );
}

/**
 * A lookahead combinator. It succeeds if the given `parser` would succeed,
 * but crucially, it **does not consume any input**, returning the parser to
 * its original state. The lookahead's result is passed through.
 *
 * This is useful for checking a condition ahead in the input stream
 * without committing to consuming it.
 *
 * @template T The parser's result type.
 * @param parser The parser to "look ahead" with.
 * @returns A `Parser<T>` that succeeds without consuming input.
 *
 * @example
 * const p = sequence([lookahead(str("a")), str("abc")]);
 * p.parse("abc"); // -> ["a", "abc"]. 'a' was matched twice, but only consumed once.
 */
export const lookahead = <T>(parser: Parser<T>): Parser<T> =>
  new Parser(state => {
    const result = parser.run(state);
    // On success, return the value but with the *original* state.
    return result.type === "success" ? success(result.value, state) : result;
  });

/**
 * A negative lookahead combinator. It succeeds if the given `parser` would
 * **fail**. It consumes no input and returns `null` on success.
 * It fails if the given `parser` would succeed.
 *
 * This is extremely useful for resolving ambiguities in grammars, for
 * example, to ensure a keyword is not part of a larger identifier.
 *
 * @param parser The parser that is *not* expected to succeed.
 * @returns A `Parser<null>` that succeeds when `parser` fails.
 *
 * @example
 * // Parse the keyword "if" but not "iffy"
 * const ifKeyword = str("if").keepLeft(notFollowedBy(regex(/[a-zA-Z0-9_]/)));
 * ifKeyword.parse("if (x)"); // -> "if"
 * // ifKeyword.parse("iffy"); // Throws ParserError
 */
export const notFollowedBy = (parser: Parser<any>): Parser<null> =>
  new Parser(state => {
    const result = lookahead(parser).run(state);
    return result.type === "failure"
      ? success(null, state)
      : failure("Negative lookahead failed: parser unexpectedly succeeded", state);
  });

/**
 * Memoizes a parser's result at each input position. This is the core of
 * "packrat parsing". If a memoized parser is run at a position it has seen
 * before, it will return the cached result instead of re-running the logic.
 *
 * This is critical for parsing grammars with significant backtracking or
 * left-recursion, as it can turn an exponential-time parse into a linear-time one.
 *
 * @template T The parser's result type.
 * @param parser The parser to memoize.
 * @returns A new, memoized `Parser<T>`.
 */
export const memo = <T>(parser: Parser<T>): Parser<T> => {
  const cache = new Map<number, ParseResult<T>>();
  return new Parser(state => {
    if (cache.has(state.index)) {
      return cache.get(state.index)!;
    }
    const result = parser.run(state);
    cache.set(state.index, result);
    return result;
  });
};

/**
 * A helper for defining left-recursive grammars, which are grammars that
 * would otherwise cause infinite loops. A common example is arithmetic
 * expressions: `expr = expr '+' term | term`.
 *
 * This combinator wraps a parser-producing function in both `memo` and `lazy`
 * to safely handle the self-reference. It should be used for any parser
 * that directly or indirectly refers to itself on the left-hand side of a rule.
 *
 * @template T The recursive parser's result type.
 * @param fn A function that returns the recursive parser definition.
 * @returns A `Parser<T>` that can handle left-recursion.
 *
 * @example
 * // A simple left-recursive grammar for addition: expr = expr + number | number
 * const term = number;
 * const expr = leftRecursive(() =>
 *   choice([
 *     sequence([expr, lexeme(str('+')), term] as const).map(([e1, , t]) => e1 + t),
 *     term
 *   ])
 * );
 * expr.parse("1+2+3"); // -> 6
 */
export function leftRecursive<T>(fn: () => Parser<T>): Parser<T> {
  return memo(lazy(fn));
}

/**
 * A generator-based helper for building sequential parsers. This provides
 * an ergonomic, "imperative" style that can be more readable than deeply
 * nested `.chain()` calls.
 *
 * Inside the generator function, you can `yield` parsers. The result of each
 * yielded parser will be sent back as the result of the `yield` expression.
 * The final `return` value of the generator becomes the success value of the
 * `genParser`.
 *
 * @template T The final return type of the parser.
 * @param gen A generator function that yields parsers.
 * @returns A `Parser<T>` that executes the generator's logic.
 *
 * @example
 * // Parses "key: value"
 * const keyValueParser = genParser(function* () {
 *   const key = yield lexeme(regex(/[a-z]+/));
 *   yield lexeme(str(":"));
 *   const value = yield number;
 *   return { [key]: value };
 * });
 *
 * keyValueParser.parse("myKey: 123"); // -> { myKey: 123 }
 */
export function genParser<T>(gen: () => Generator<Parser<any>, T, any>): Parser<T> {
  return new Parser(state => {
    const iterator = gen();
    let currentState = state;
    let nextValue: any = undefined;

    while (true) {
      // Pass the result of the last parse back into the generator
      const { value: parser, done } = iterator.next(nextValue);

      if (done) {
        // The generator has finished, `parser` is the final return value.
        return success(parser, currentState);
      }

      const result = (parser as Parser<any>).run(currentState);
      if (result.type === "failure") return result;

      currentState = result.state;
      nextValue = result.value;
    }
  });
}

/**
 * A placeholder for a potential future feature to generate a full parser from
 * a formal grammar definition string (e.g., EBNF).
 * **This is not implemented.**
 *
 * @throws {ParserError} always.
 */
export function fromGrammar(grammar: string): never {
  throw new ParserError("fromGrammar is a placeholder and not implemented. Please use the provided combinators.");
}

/**
 * A combinator that flattens a parser's nested array result. It wraps a
 * parser that is expected to return an array and applies `Array.prototype.flat`.
 *
 * @param parser A parser that resolves to an array (e.g., `any[]`).
 * @param depth The depth to flatten to. Defaults to 1.
 * @returns A `Parser` that produces a flattened array.
 *
 * @example
 * const p = succeed([1, [2, 3], [4, [5]]]);
 * flatten(p, 1).parse(''); // -> [1, 2, 3, 4, [5]]
 * flatten(p, 2).parse(''); // -> [1, 2, 3, 4, 5]
 */
export function flatten<D extends number = 1>(parser: Parser<any[]>, depth?: D): Parser<any[]> {
  return parser.map(arr => arr.flat(depth));
}

// =================================================================
// Section 7: Type-Safe Character Class Parser
// =================================================================

/**
 * The primary, recommended way to parse single characters. It is a powerful,
 * type-safe replacement for `anyOf` or simple `regex`. It has two modes:
 *
 * 1.  **Named Character Class**: When given a name of a pre-defined character
 *     class from `./master-char-classes.ts` (e.g., 'Digit', 'UppercaseLetter'),
 *     it returns a parser that matches any character in that class and has a
 *     precise, specific return type.
 *
 * 2.  **Custom Character Set**: When given a string of arbitrary characters,
 *     it returns a parser that matches any single character from that string.
 *     The return type is a type-safe union of the character literals in the string.
 *
 * @param name The name of a pre-defined character class (e.g., 'Digit', 'Hiragana').
 * @returns A `Parser` whose success type is the specific character class type (e.g., `Parser<Digit>`).
 *
 * @example
 * // 1. Using a named character class
 * const digitParser = charClass('Digit'); // Type is Parser<"0"|"1"|...|"9">
 * const d = digitParser.parse("7"); // -> "7", and its type is known to be a Digit
 *
 * // 2. Using a custom character string
 * const hexDigitParser = charClass('0123456789abcdefABCDEF');
 * const boolCharParser = charClass("yn"); // Type is Parser<"y" | "n">
 * const b = boolCharParser.parse("n"); // -> "n", and its type is "y" | "n"
 */
export function charClass<N extends CC.CharClassName>(name: N): Parser<CC.CharClassTypeMap[N]>;
/**
 * The primary, recommended way to parse single characters.
 *
 * @param chars A custom string of characters to match against.
 * @returns A `Parser` whose success type is a union of the characters in the input string.
 * @see The overload for named character classes.
 */
export function charClass<S extends string>(chars: S): Parser<ToCharUnion<S>>;
export function charClass(nameOrChars: string): Parser<string> {
  // Check if the input string is a known, named character class.
  if (nameOrChars in CC.CHAR_CLASS_STRINGS) {
    const charSet = CC.CHAR_CLASS_STRINGS[nameOrChars as CC.CharClassName];
    // We can safely cast the result because the runtime string (charSet)
    // perfectly corresponds to the compile-time type promised by the overload signature.
    return anyOf(charSet) as Parser<any>;
  }

  // If it's not a named class, treat it as a custom string of characters.
  return anyOf(nameOrChars);
}