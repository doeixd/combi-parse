# Combi-Parse
A friendly, type-safe parser combinator library for TypeScript.

[![NPM Version](https://img.shields.io/npm/v/@doeixd/combi-parse.svg)](https://www.npmjs.com/package/@doeixd/combi-parse)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](#)
[![TypeScript](https://img.shields.io/badge/%3C/%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/)

This library provides a set of tools to build complex parsers from simple, reusable functions ("combinators"). It's designed to transform structured text into meaningful data structures, like Abstract Syntax Trees (ASTs), with a strong emphasis on leveraging TypeScript's type system to make your parsers robust and your development experience smooth.

### ✨ Key Features

*   ✅ **Type-Safe by Design**: The library is built from the ground up with TypeScript. Parsers know the type of data they produce, catching integration errors at compile time, not runtime.
*   🧩 **Composable & Readable**: Build complex parsers by combining smaller ones. The resulting code often reads like a formal grammar, making it easy to understand, debug, and maintain.
*   🕊️ **Zero Dependencies**: A lightweight, single-file library with no external dependencies.
*   📍 **Detailed Error Reporting**: When a parse fails, you get a clear error message with the exact line and column number, helping you pinpoint issues quickly.
*   🚀 **Advanced Features Included**: Out-of-the-box support for common but tricky parsing scenarios, including left-recursion (`leftRecursive`), memoization (`memo`), and ergonomic generator-based syntax (`genParser`).

<br />

## 📥 Installation

```bash
# Using npm
npm install @doeixd/combi-parse

# Using yarn
yarn add @doeixd/combi-parse

# Using pnpm
pnpm add @doeixd/combi-parse
```

<br />

## 🚀 Quick Example

Let's write a parser for a simple variable declaration like `let user = "jane";`. We want to turn this string into a structured object `{ name: "user", value: "jane" }`.

```typescript
import { str, regex, sequence, between, lexeme } from '@doeixd/combi-parse';

// A parser for any valid identifier (e.g., variable names).
const identifier = regex(/[a-zA-Z_][a-zA-Z0-9_]*/);

// A parser for a string literal enclosed in double quotes.
const stringLiteral = between(str('"'), regex(/[^"]*/), str('"'));

// A "lexeme" is a parser that also consumes any trailing whitespace.
// This is incredibly useful for ignoring spaces between tokens.
const letKeyword = lexeme(str('let'));
const equalsSign = lexeme(str('='));

// Now, we combine them in a sequence.
const declarationParser = sequence(
  [
    letKeyword,
    lexeme(identifier),
    equalsSign,
    stringLiteral,
    str(';'),
  ] as const, // `as const` helps TypeScript infer the precise types!
  ([, name, , value]) => ({ type: 'declaration', name, value })
);

// Let's run it!
const code = 'let user = "jane";';
const result = declarationParser.parse(code);

console.log(result);
// Output: { type: 'declaration', name: 'user', value: 'jane' }
```

<br />

## 🤔 The "Why" and "How": A Gentle Introduction

### What is Parsing?

Parsing is the process of taking raw text and turning it into a structured, meaningful representation. A web browser parses HTML into a DOM tree, a JavaScript engine parses code into an Abstract Syntax Tree (AST), and a command-line tool parses arguments into a configuration object. This library gives you the tools to do the same for any structured text you can imagine.

### Why Parser Combinators?

You could parse text with a series of `indexOf`, `substring`, and regular expression calls. However, this approach quickly becomes brittle, hard to read, and difficult to maintain as the complexity of your format grows.

Parser combinators offer a different approach. The core idea is:

1.  **Create small, simple parsers** that do one thing well (e.g., parse a specific word, parse a number).
2.  **Use "combinator" functions** to combine these small parsers into bigger ones that recognize more complex patterns (e.g., parse a number *or* a word, parse a list of numbers separated by commas).

This approach leads to code that is declarative, modular, and often mirrors the formal grammar of the language you are parsing.

### Core Concepts

A few key ideas form the foundation of this library. Understanding them will make the API feel intuitive.

*   **The `Parser<T>` Object**: A `Parser<T>` isn't a result; it's a *recipe*. It's an object that holds a function describing *how* to parse a piece of text to produce a value of type `T`. It only does its work when you call the final `.parse(input)` method.

*   **State and Result**: As a parser runs, it tracks its `ParserState` (`{ input: string, index: number }`). When a parser recipe is executed, it returns a `ParseResult<T>`, which is either a `Success<T>` (containing the parsed value and the *new* state) or a `Failure` (containing an error message and the state where it failed).

*   **Combinators**: These are the heart of the library. They are functions that take one or more parsers and return a new, more powerful parser. `sequence`, `choice`, `many`, and `sepBy` are prime examples.

*   **Mapping (`.map`)**: This is for when you've successfully parsed something but need to transform the result. For example, the `regex(/[0-9]+/)` parser produces a `string`, but you can use `.map(Number)` to create a new parser that produces a `number`.

*   **Chaining (`.chain`)**: This is for when the *next step* of your parsing logic depends on the *result* of the previous step. For example, to parse a length-prefixed string like `"3:abc"`, you first need to parse the `3`, and then use that value to know how many characters to parse next.

<br />

## 📚 A Tour of the API

Here are some of the most common tools you'll use, grouped by purpose.

### Primitive Parsers

These are the fundamental building blocks.

*   `str("hello")`: Matches the exact string `"hello"`.
*   `regex(/[a-z]+/)`: Matches a regular expression at the current position.
*   `number`: A pre-built parser for one or more digits that returns a `number`.
*   `charClass('Digit')`: The recommended way to parse single characters from pre-defined sets (like `'Digit'`, `'Whitespace'`, `'Hiragana'`) or custom sets (`charClass('abc')`). It's highly type-safe.

### Combining Parsers

These functions assemble small parsers into larger ones.

*   `sequence([p1, p2])`: Runs a sequence of parsers in order. Fails if any of them fail. Returns an array of their results.
*   `choice([p1, p2])`: Tries each parser in order and returns the result of the first one that succeeds.
*   `p.many()`: Applies parser `p` zero or more times, returning an array of results.
*   `p.many1()`: Applies parser `p` one or more times.
*   `sepBy(p, sep)`: Parses zero or more occurrences of `p` separated by `sep`.
*   `between(left, content, right)`: Parses `content` that is enclosed by `left` and `right`, returning only the result of `content`.

### Handling Whitespace

Whitespace is often syntactically insignificant. These helpers make it easy to ignore.

*   `whitespace`: Parses one or more whitespace characters.
*   `lexeme(parser)`: A powerful combinator that wraps another parser and consumes any trailing whitespace after it succeeds. This is the key to writing clean grammars.

### Error Handling

Provide clear, helpful errors to the user of your parser.

*   `label(p, "...")`: Replaces the default error message of parser `p` with a custom one.
*   `context(p, "...")`: Prepends a contextual message to an error, creating a "stack trace" of what the parser was attempting to do.

### Advanced Flow Control

For more complex grammars, especially recursive ones.

*   `lazy(() => p)`: Defers the creation of a parser until it's actually needed. This is **essential** for defining recursive parsers (e.g., a JSON value can contain an object which can contain a value...).
*   `leftRecursive(() => p)`: A specialized helper to safely define left-recursive grammars (e.g., `expr = expr + term`), which would otherwise cause infinite loops.

<br />

## 📖 Full API Reference

### The `Parser<T>` Class

| Method | Signature | Description |
| :--- | :--- | :--- |
| **`.parse(input)`** | `(input: string, opts?: ParseOptions) => T` | Runs the parser on an input string and returns the result or throws a detailed error. |
| **`.map(fn)`** | `<U>(fn: (value: T) => U) => Parser<U>` | Transforms the successful result of the parser into a new value. |
| **`.chain(fn)`** | `<U>(fn: (value: T) => Parser<U>) => Parser<U>` | Runs a second parser that depends on the result of the first. |
| **`.many()`** | `<U>(into?: (res: T[]) => U) => Parser<U>` | Matches the parser zero or more times, returning an array of results. |
| **`.many1()`** | `<U>(into?: (res: T[]) => U) => Parser<U>` | Matches the parser one or more times. |
| **`.or(other)`** | `<U>(other: Parser<U>) => Parser<T \| U>` | Tries this parser, then `other` if this one fails without consuming input. |
| **`.optional()`** | `() => Parser<T \| null>` | Makes the parser optional, returning `null` on failure. |
| **`.keepRight(p)`** | `<U>(p: Parser<U>) => Parser<U>` | Runs `p` after this, keeping `p`'s result. |
| **`.keepLeft(p)`** | `<U>(p: Parser<U>) => Parser<T>` | Runs `p` after this, keeping this parser's result. |

### Primitive Parsers

| Function | Signature | Description |
| :--- | :--- | :--- |
| **`str(s)`** | `<S extends string>(s: S) => Parser<S>` | Parses a specific string literal. |
| **`regex(re)`** | `(re: RegExp) => Parser<string>` | Parses a string matching a regular expression. |
| **`number`** | `Parser<number>` | Parses one or more digits into a number. |
| **`whitespace`** | `Parser<string>` | Parses one or more whitespace characters. |
| **`eof`** | `Parser<null>` | Succeeds only at the end of the input. |
| **`charClass(name)`** | `(name: CharClassName) => Parser<CharClassType>` | Type-safe parser for a named character class (e.g., `'Digit'`). |
| **`charClass(chars)`**| `<S extends string>(s: S) => Parser<ToCharUnion<S>>`| Type-safe parser for any character in a custom string. |
| **`noneOf(chars)`** | `(chars: string) => Parser<string>` | Parses any single character *not* in the given string. |
| **`succeed(val)`** | `<T>(value: T) => Parser<T>` | A parser that always succeeds with a value, consuming no input. |
| **`fail(msg)`** | `(message: string) => Parser<never>` | A parser that always fails with a message, consuming no input. |

### Combinator Functions

| Function | Signature | Description |
| :--- | :--- | :--- |
| **`sequence(ps)`** | `<T, U>(parsers: Parser<T[K]>[], into?) => Parser<U>` | Applies parsers in order, collecting results into a tuple. |
| **`choice(ps)`** | `<T, U>(parsers: Parser<T[K]>[], into?) => Parser<U>` | Tries a list of parsers, returns the first success. |
| **`sepBy(p, sep)`** | `<T, S, U>(p, sep, into?) => Parser<U>` | Parses zero or more items separated by a separator. |
| **`sepBy1(p, sep)`**| `<T, S, U>(p, sep, into?) => Parser<U>` | Parses one or more items separated by a separator. |
| **`between(l, c, r)`** | `<L, C, R>(l, c, r) => Parser<C>` | Parses content between two delimiters, discarding the delimiters. |
| **`optional(p)`** | `<T>(parser: Parser<T>) => Parser<T \| null>` | Makes a parser optional, returning `null` on failure. |
| **`lexeme(p)`** | `<T>(parser: Parser<T>) => Parser<T>` | Wraps a parser to consume any trailing whitespace. |

### Utility & Advanced Functions

| Function | Signature | Description |
| :--- | :--- | :--- |
| **`lazy(fn)`** | `<T>(fn: () => Parser<T>) => Parser<T>` | Lazily evaluates a parser, essential for recursion. |
| **`leftRecursive(fn)`** | `<T>(fn: () => Parser<T>) => Parser<T>` | Safely defines a left-recursive grammar. |
| **`memo(p)`** | `<T>(parser: Parser<T>) => Parser<T>` | Memoizes a parser's result at each position (packrat parsing). |
| **`label(p, msg)`** | `<T>(p: Parser<T>, msg: string) => Parser<T>` | Overrides a parser's error message. |
| **`context(p, ctx)`**| `<T>(p: Parser<T>, ctx: string) => Parser<T>` | Adds a contextual label to an error message. |
| **`genParser(gen)`**| `<T>(gen: () => Generator<...>) => Parser<T>` | Builds a parser from a generator function for imperative-style logic. |
| **`astNode(label, p)`**| `<T, L>(label, p) => Parser<{ type: L; value: T }>` | Wraps a result in a labeled object to form an AST node. |
| **`filter(p, pred)`**| `<T>(p, pred, msg?) => Parser<T>` | Fails if the parser's successful result doesn't match a predicate. |
| **`lookahead(p)`**| `<T>(p: Parser<T>) => Parser<T>` | Succeeds if `p` would succeed, but consumes no input. |
| **`notFollowedBy(p)`**| `(parser: Parser<any>) => Parser<null>` | Succeeds if `p` would fail, consuming no input. |

Excellent idea. A section with practical, reusable patterns is one of the most valuable parts of a library's documentation. Here it is, written in the same educational style.

---

<br />

## 💡 Common Patterns & Helpful Examples

This section demonstrates how to solve common parsing problems by combining the library's tools in idiomatic ways. Understanding these patterns will help you build your own complex parsers more effectively.

### Pattern 1: Ignoring Whitespace with `lexeme`

Most text formats allow for flexible spacing between meaningful tokens. Hard-coding `whitespace` parsers everywhere is tedious and clutters your grammar. The `lexeme` combinator is the standard solution.

**The Goal**: Create "token" parsers that automatically handle any trailing whitespace.

**The Pattern**: Wrap your primitive parsers with `lexeme`. Then, combine these new lexeme parsers without worrying about the space between them.

```typescript
import { lexeme, str, number, sequence } from '@doeixd/combi-parse';

// --- Building Blocks ---
// Create lexemes for our tokens. Each one parses its content
// AND any whitespace that follows.
const plusToken = lexeme(str('+'));
const numberToken = lexeme(number);

// --- Grammar ---
// Now our grammar is clean and readable. We don't need to mention
// whitespace at all; the lexemes handle it.
const additionParser = sequence(
  [numberToken, plusToken, numberToken] as const,
  ([num1, , num2]) => num1 + num2
);

// --- Execution ---
// It works regardless of the spacing.
console.log(additionParser.parse("10+20"));      // -> 30
console.log(additionParser.parse("  10  +  20  ")); // -> 30
```

### Pattern 2: Parsing Separated Lists (e.g., CSV)

Parsing lists of items, like comma-separated values or function arguments, is a very common task. The `sepBy` and `sepBy1` combinators are designed specifically for this.

**The Goal**: Parse a list of numbers inside square brackets, like `[1, 2, 3, 4]`.

**The Pattern**: Use `between` to handle the delimiters (`[` and `]`) and `sepBy` to handle the comma-separated content.

```typescript
import { lexeme, str, number, sepBy, between } from '@doeixd/combi-parse';

// A comma that also consumes trailing whitespace.
const comma = lexeme(str(','));

// A parser for zero or more numbers separated by our comma lexeme.
const listOfNumbers = sepBy(lexeme(number), comma);

// Now, wrap the list parser with `between` to handle the brackets.
// We use lexeme on the brackets too, to handle space like `[ 1, 2 ]`.
const arrayParser = between(
  lexeme(str('[')),
  listOfNumbers,
  lexeme(str(']'))
);

// --- Execution ---
console.log(arrayParser.parse("[1, 2, 3]"));   // -> [1, 2, 3]
console.log(arrayParser.parse("[ 42 ]"));        // -> [42]
console.log(arrayParser.parse("[]"));            // -> []
// Use sepBy1 if the list must not be empty.
```

### Pattern 3: Creating Structured Data (AST Nodes)

Parsing isn't just about recognizing text; it's about transforming it into a useful data structure, like an Abstract Syntax Tree (AST).

**The Goal**: Parse `const x = 100` into the object `{ kind: 'variable', name: 'x', value: 100 }`.

**The Pattern**: Use `sequence` with its `into` function, or chain `.map()` onto a parser, to restructure the raw parsed results into a meaningful object. The `astNode` helper is also great for this.

```typescript
import { lexeme, str, number, regex, sequence, astNode } from '@doeixd/combi-parse';

const identifier = lexeme(regex(/[a-z]+/));

// --- Method 1: Using the `into` argument of `sequence` ---
const assignmentParser = sequence(
  [lexeme(str("const")), identifier, lexeme(str("=")), number] as const,
  // The `into` function receives a tuple of results and reshapes it.
  ([, name, , value]) => ({ kind: 'variable', name, value })
);

console.log(assignmentParser.parse("const x = 100"));
// -> { kind: 'variable', name: 'x', value: 100 }


// --- Method 2: Using `astNode` for cleaner AST construction ---
// This is often more composable.
const numberNode = astNode("NumberLiteral", number); // -> Parser<{ type: "NumberLiteral", value: number }>
const identifierNode = astNode("Identifier", identifier); // -> Parser<{ type: "Identifier", value: string }>

const simpleAssignment = sequence(
  [lexeme(str("const")), identifierNode, lexeme(str("=")), numberNode] as const,
  ([, nameNode, , valueNode]) => ({
    type: 'Assignment',
    name: nameNode,

    value: valueNode,
  })
);

console.log(simpleAssignment.parse("const y = 200"));
// -> { type: 'Assignment', name: { type: 'Identifier', value: 'y' }, value: { type: 'NumberLiteral', value: 200 } }
```

### Pattern 4: Handling Recursive Structures with `lazy`

Many formats are recursive. A JSON value can be an object, which contains more JSON values. A mathematical expression can contain other expressions in parentheses. Directly defining a parser that refers to itself will cause an infinite loop. `lazy` is the solution.

**The Goal**: Parse nested S-expressions like `(add 1 (mul 2 3))`.

**The Pattern**: Whenever a parser needs to refer to itself (or another parser that refers back to it), wrap the recursive reference in `lazy()`.

```typescript
import { str, number, regex, choice, between, lexeme, lazy } from '@doeixd/combi-parse';

// An "atom" is a number or an identifier.
const atom = choice([
  number,
  regex(/[a-zA-Z]+/)
]);

// An S-expression is either an atom or a list of other S-expressions.
// We must forward-declare the type so TypeScript knows what to expect.
let sExpression: Parser<any>;

// A list is `(` followed by zero or more s-expressions, then `)`.
// Notice the `lazy(() => sExpression)` call. This breaks the infinite loop.
const list = between(
  lexeme(str('(')),
  () => sExpression.many(), // We can use a thunk here or lazy()
  lexeme(str(')'))
);

// Now we can fully define sExpression.
sExpression = choice([
    atom,
    list
]);


console.log(sExpression.parse("(add 1 (mul 2 3))"));
// -> [ 'add', 1, [ 'mul', 2, 3 ] ]
```

### Pattern 5: Parsing Left-Recursive Expressions (Arithmetic)

A common challenge is parsing left-associative expressions, like `5 - 2 + 1`. A naive grammar `expr = expr OP term` is left-recursive and creates an infinite loop that even `lazy` cannot solve on its own. `leftRecursive` is the specialized tool for this.

**The Goal**: Parse `10 + 5 - 3` and get the correct result `12`.

**The Pattern**: Define your expression parser inside a `leftRecursive` call. The recursive part of the parser should build upon the result of the previous expression.

```typescript
import { choice, sequence, str, number, lexeme, leftRecursive } from '@doeixd/combi-parse';

const term = lexeme(number);
const addOp = lexeme(str('+'));
const subOp = lexeme(str('-'));

// The magic happens here.
const expressionParser = leftRecursive<number>(() =>
  // The choice is between a recursive expression or a base case.
  choice([
    // The recursive case: parse an existing expression, an operator, and a term.
    sequence(
      [expressionParser, addOp, term] as const,
      ([left, , right]) => left + right
    ),
    sequence(
      [expressionParser, subOp, term] as const,
      ([left, , right]) => left - right
    ),
    // The base case: if it's not a recursive expression, it must be a simple term.
    term,
  ])
);

console.log(expressionParser.parse("10 + 5 - 3")); // -> 12
console.log(expressionParser.parse("100"));          // -> 100
```


<br />


## 📜 License

This project is licensed under the **MIT License**. See the LICENSE file for details.

<br />

## Contributing
Contributions are welcome! Please make a PR
