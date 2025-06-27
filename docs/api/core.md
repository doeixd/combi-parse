# Core API Reference

This document provides detailed reference information for the core parsing functionality in Combi-Parse.

## Core Types

### `Parser<T>`

The main parser class that wraps parsing logic.

```typescript
class Parser<T> {
  constructor(run: (state: ParserState) => ParseResult<T>)
  parse(input: string, options?: ParseOptions): T
  map<U>(fn: (value: T) => U): Parser<U>
  chain<U>(fn: (value: T) => Parser<U>): Parser<U>
  many<U = T[]>(into?: (results: T[]) => U): Parser<U>
  many1<U = T[]>(into?: (results: T[]) => U): Parser<U>
  or<U>(other: Parser<U>): Parser<T | U>
  optional(): Parser<T | null>
  keepRight<U>(p: Parser<U>): Parser<U>
  keepLeft<U>(p: Parser<U>): Parser<T>
  sepBy<S, U = T[]>(separator: Parser<S>, into?: (results: T[]) => U): Parser<U>
  sepBy1<S, U = T[]>(separator: Parser<S>, into?: (results: T[]) => U): Parser<U>
  debug(label?: string): Parser<T>
}
```

#### Methods

##### `parse(input: string, options?: ParseOptions): T`

Executes the parser against input text. Throws `ParserError` on failure.

**Parameters:**
- `input`: The string to parse
- `options`: Optional parsing configuration
  - `consumeAll`: Whether parser must consume entire input (default: `true`)

**Returns:** The parsed value of type `T`

**Throws:** `ParserError` with line/column information on failure

```typescript
const parser = str("hello");
const result = parser.parse("hello world"); // → "hello"
```

##### `map<U>(fn: (value: T) => U): Parser<U>`

Transforms successful parser results.

**Parameters:**
- `fn`: Transformation function applied to successful results

**Returns:** New parser that produces transformed values

```typescript
const number = regex(/[0-9]+/).map(Number);
number.parse("123"); // → 123 (number, not string)
```

##### `chain<U>(fn: (value: T) => Parser<U>): Parser<U>`

Sequences parsers where the second depends on the first's result.

**Parameters:**
- `fn`: Function that takes first parser's result and returns next parser

**Returns:** New parser representing the sequence

```typescript
const lengthPrefixed = number.chain(len =>
  str(":").keepRight(regex(new RegExp(`.{${len}}`)))
);
lengthPrefixed.parse("5:hello"); // → "hello"
```

##### `many<U = T[]>(into?: (results: T[]) => U): Parser<U>`

Applies parser zero or more times, collecting results.

**Parameters:**
- `into`: Optional transformation function for result array

**Returns:** Parser that never fails, produces array or transformed result

**Note:** Parser must consume input on success to prevent infinite loops.

```typescript
const digits = regex(/[0-9]/).many();
digits.parse("123"); // → ["1", "2", "3"]
digits.parse("");    // → []

const digitCount = regex(/[0-9]/).many(arr => arr.length);
digitCount.parse("123"); // → 3
```

##### `many1<U = T[]>(into?: (results: T[]) => U): Parser<U>`

Applies parser one or more times, collecting results.

**Parameters:**
- `into`: Optional transformation function for result array

**Returns:** Parser that fails if no matches, otherwise produces array

```typescript
const digits = regex(/[0-9]/).many1();
digits.parse("123"); // → ["1", "2", "3"]
// digits.parse(""); // throws ParserError
```

##### `or<U>(other: Parser<U>): Parser<T | U>`

Provides alternative parser if current parser fails without consuming input.

**Parameters:**
- `other`: Alternative parser to try

**Returns:** Parser that produces either type

```typescript
const keyword = str("let").or(str("const"));
keyword.parse("let x"); // → "let"
keyword.parse("const y"); // → "const"
```

##### `optional(): Parser<T | null>`

Makes parser optional, succeeding with `null` if it fails.

**Returns:** Parser that never fails

```typescript
const optionalSign = str("-").optional();
optionalSign.parse("-42"); // → "-"
optionalSign.parse("42");  // → null
```

##### `keepRight<U>(p: Parser<U>): Parser<U>`

Sequences parsers, keeping only the second result.

**Parameters:**
- `p`: Parser whose result to keep

**Returns:** Parser producing second parser's result

```typescript
const value = str("=").keepRight(number);
value.parse("=42"); // → 42
```

##### `keepLeft<U>(p: Parser<U>): Parser<T>`

Sequences parsers, keeping only the first result.

**Parameters:**
- `p`: Parser whose result to discard

**Returns:** Parser producing first parser's result

```typescript
const token = regex(/[a-z]+/).keepLeft(regex(/\s*/));
token.parse("hello   "); // → "hello"
```

##### `sepBy<S, U = T[]>(separator: Parser<S>, into?: (results: T[]) => U): Parser<U>`

Parses zero or more occurrences separated by delimiter.

**Parameters:**
- `separator`: Parser for separator (result discarded)
- `into`: Optional transformation function

**Returns:** Parser for separated list

```typescript
const numbers = number.sepBy(str(","));
numbers.parse("1,2,3"); // → [1, 2, 3]
numbers.parse("");      // → []
```

##### `sepBy1<S, U = T[]>(separator: Parser<S>, into?: (results: T[]) => U): Parser<U>`

Parses one or more occurrences separated by delimiter.

**Parameters:**
- `separator`: Parser for separator (result discarded)
- `into`: Optional transformation function

**Returns:** Parser for separated list (fails if empty)

```typescript
const numbers = number.sepBy1(str(","));
numbers.parse("1,2,3"); // → [1, 2, 3]
// numbers.parse("");   // throws ParserError
```

##### `debug(label?: string): Parser<T>`

Adds debug logging to parser execution.

**Parameters:**
- `label`: Optional label for debug output

**Returns:** Parser with debug logging

```typescript
const debugParser = number.debug("number-parser");
// Logs parsing attempts and results to console
```

### Result Types

#### `ParserState`

Immutable parsing state.

```typescript
interface ParserState {
  readonly input: string;  // Full input string
  readonly index: number;  // Current position
}
```

#### `Success<T>`

Successful parsing result.

```typescript
interface Success<T> {
  readonly type: "success";
  readonly value: T;           // Parsed value
  readonly state: ParserState; // New parser state
}
```

#### `Failure`

Failed parsing result.

```typescript
interface Failure {
  readonly type: "failure";
  readonly message: string;    // Error message
  readonly state: ParserState; // State at failure point
}
```

#### `ParseResult<T>`

Union of success and failure results.

```typescript
type ParseResult<T> = Success<T> | Failure;
```

### Options

#### `ParseOptions`

Configuration for the `parse` method.

```typescript
interface ParseOptions {
  readonly consumeAll?: boolean; // Must consume entire input (default: true)
}
```

## Primitive Parsers

### `str<S extends string>(s: S): Parser<S>`

Matches exact string literal.

**Parameters:**
- `s`: String to match

**Returns:** Parser that produces the matched string

```typescript
const hello = str("hello");
hello.parse("hello world"); // → "hello"
```

### `regex(re: RegExp): Parser<string>`

Matches regular expression pattern. Automatically anchored to current position.

**Parameters:**
- `re`: Regular expression to match

**Returns:** Parser that produces matched string

```typescript
const identifier = regex(/[a-zA-Z_][a-zA-Z0-9_]*/);
identifier.parse("myVar"); // → "myVar"
```

### `number: Parser<number>`

Pre-built parser for integers (`[0-9]+`).

```typescript
number.parse("123"); // → 123
```

### `whitespace: Parser<string>`

Pre-built parser for mandatory whitespace (`\s+`).

```typescript
whitespace.parse("   \n\t"); // → "   \n\t"
```

### `eof: Parser<null>`

Succeeds only at end of input.

```typescript
const complete = number.keepLeft(eof);
complete.parse("123");   // → 123
// complete.parse("123a"); // throws ParserError
```

### `succeed<T>(value: T): Parser<T>`

Always succeeds with given value, consuming no input.

**Parameters:**
- `value`: Value to produce

**Returns:** Parser that always succeeds

```typescript
const defaultValue = succeed(42);
defaultValue.parse("anything"); // → 42
```

### `fail(message: string): Parser<never>`

Always fails with given message.

**Parameters:**
- `message`: Error message

**Returns:** Parser that always fails

```typescript
const failParser = str("ok").chain(() => fail("Not implemented"));
```

### `noneOf(chars: string): Parser<string>`

Matches any character not in the given string.

**Parameters:**
- `chars`: String of disallowed characters

**Returns:** Parser producing the matched character

```typescript
const notQuote = noneOf('"');
notQuote.parse("hello"); // → "h"
```

## Combinator Functions

### `sequence<T, U = T>(parsers: Parser<T>[], into?: (results: T) => U): Parser<U>`

Runs parsers in sequence, collecting results.

**Parameters:**
- `parsers`: Array of parsers to run in order
- `into`: Optional transformation function

**Returns:** Parser producing tuple or transformed result

```typescript
const assignment = sequence(
  [regex(/[a-z]+/), str(" = "), number] as const,
  ([name, , value]) => ({ name, value })
);
assignment.parse("x = 42"); // → { name: "x", value: 42 }
```

### `choice<T, U = T[number]>(parsers: Parser<T>[], into?: (result: T[number]) => U): Parser<U>`

Tries parsers in order, returning first success.

**Parameters:**
- `parsers`: Array of alternative parsers
- `into`: Optional transformation function

**Returns:** Parser producing union type or transformed result

```typescript
const keyword = choice([str("let"), str("const"), str("var")]);
keyword.parse("const"); // → "const"
```

### `sepBy<T, S, U = T[]>(p: Parser<T>, separator: Parser<S>, into?: (results: T[]) => U): Parser<U>`

Parses zero or more items separated by delimiter.

**Parameters:**
- `p`: Parser for items
- `separator`: Parser for separator
- `into`: Optional transformation function

**Returns:** Parser for separated list

```typescript
const csvRow = regex(/[^,]*/).sepBy(str(","));
csvRow.parse("a,b,c"); // → ["a", "b", "c"]
```

### `sepBy1<T, S, U = T[]>(p: Parser<T>, separator: Parser<S>, into?: (results: T[]) => U): Parser<U>`

Parses one or more items separated by delimiter.

**Parameters:**
- `p`: Parser for items
- `separator`: Parser for separator
- `into`: Optional transformation function

**Returns:** Parser for separated list (fails if empty)

### `between<L, C, R>(left: Parser<L>, content: Parser<C>, right: Parser<R>): Parser<C>`

Parses content between delimiters.

**Parameters:**
- `left`: Opening delimiter parser
- `content`: Content parser
- `right`: Closing delimiter parser

**Returns:** Parser producing content result

```typescript
const quoted = between(str('"'), regex(/[^"]*/), str('"'));
quoted.parse('"hello"'); // → "hello"
```

### `lazy<T>(fn: () => Parser<T>): Parser<T>`

Enables recursive parser definitions through lazy evaluation.

**Parameters:**
- `fn`: Function returning parser (called when needed)

**Returns:** Parser that defers construction

```typescript
const expr: Parser<any> = choice([
  number,
  lazy(() => between(str("("), expr, str(")")))
]);
```

### `lexeme<T>(parser: Parser<T>): Parser<T>`

Wraps parser to consume trailing whitespace.

**Parameters:**
- `parser`: Parser to wrap

**Returns:** Parser that handles trailing whitespace

```typescript
const lexNumber = lexeme(number);
const sum = sequence([lexNumber, str("+"), lexNumber]);
sum.parse("1 + 2   "); // → [1, "+", 2]
```

### `optional<T>(parser: Parser<T>): Parser<T | null>`

Makes parser optional.

**Parameters:**
- `parser`: Parser to make optional

**Returns:** Parser that never fails

```typescript
const optionalMinus = optional(str("-"));
optionalMinus.parse("-5"); // → "-"
optionalMinus.parse("5");  // → null
```

### `many<T, U = T[]>(parser: Parser<T>, into?: (results: T[]) => U): Parser<U>`

Applies parser zero or more times.

**Parameters:**
- `parser`: Parser to repeat
- `into`: Optional transformation function

**Returns:** Parser that collects results

### `many1<T, U = T[]>(parser: Parser<T>, into?: (results: T[]) => U): Parser<U>`

Applies parser one or more times.

**Parameters:**
- `parser`: Parser to repeat
- `into`: Optional transformation function

**Returns:** Parser that collects results (fails if empty)

## Error Handling

### `label<T>(parser: Parser<T>, message: string): Parser<T>`

Replaces parser's error message.

**Parameters:**
- `parser`: Parser to wrap
- `message`: New error message

**Returns:** Parser with custom error message

```typescript
const email = label(
  regex(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/),
  "a valid email address"
);
```

### `context<T>(parser: Parser<T>, ctx: string): Parser<T>`

Adds context to error messages.

**Parameters:**
- `parser`: Parser to wrap
- `ctx`: Context string

**Returns:** Parser with contextualized errors

```typescript
const userParser = context(
  sequence([str("name:"), regex(/[a-z]+/)]),
  "parsing user"
);
```

## Generator Support

### `genParser<T>(genFn: GeneratorFunction): Parser<T>`

Creates parser from generator function for imperative-style parsing.

**Parameters:**
- `genFn`: Generator function that yields parsers and returns result

**Returns:** Parser executing generator logic

```typescript
const assignment = genParser(function* () {
  const name = yield regex(/[a-z]+/);
  yield str(" = ");
  const value = yield number;
  return { name, value };
});
```

## Utility Types

### `ToCharUnion<S extends string>`

Type-level utility that converts string literal to character union.

```typescript
type Chars = ToCharUnion<"abc">; // "a" | "b" | "c"
```

## Factory Functions

### `success<T>(value: T, state: ParserState): Success<T>`

Creates success result.

### `failure(message: string, state: ParserState): Failure`

Creates failure result.

These factory functions are primarily used internally but can be useful when creating custom parsers.
