[![NPM Version](https://img.shields.io/npm/v/@doeixd/combi-parse.svg)](https://www.npmjs.com/package/@doeixd/combi-parse)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](#)
[![TypeScript](https://img.shields.io/badge/%3C/%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/)

# Combi-Parse

A friendly, powerful, and type-safe parser combinator library for TypeScript. It helps you transform raw, structured text into meaningful data with confidence and clarity.

Combi-Parse is built on a simple but powerful idea: **parser combinators**. Think of them like Lego blocks. You start with tiny, simple parsers that do one thing well (like matching the word "let" or a number). You then "combine" these blocks to build bigger, more sophisticated parsers that can understand complex structures, like a programming language or a JSON file.

The library handles the complex details—like tracking the current position in the text, managing state, and reporting helpful errors—so you can focus on describing the *what* of your data's grammar, not the *how*.

<br />

## 📥 Installation

```bash
npm install @doeixd/combi-parse
```

<br />

## 🚀 Quick Start: A Guided Tour

Let's build our first parser. Our goal is to parse a simple variable declaration string like `let user = "jane";` and turn it into a structured JavaScript object.

We'll build this up step-by-step to understand what’s happening.

### Step 1: Understanding the "Parser"

First, what *is* a parser in this library?

A parser is an object that "knows" how to recognize a specific piece of text. It's not the *result* itself; it's the *machine* that produces the result. Every parser has a `.parse()` method that you run on an input string.

Let's make the simplest possible parser: one that recognizes the exact word `let`.

```typescript
import { str } from '@doeixd/combi-parse';

// Create a parser that looks for the literal string 'let'.
const letParser = str('let');

// Let's run it!
const result = letParser.parse('let there be light');

console.log(result); // Output: 'let'

// What happens if it fails?
try {
  letParser.parse('const there be light');
} catch (error) {
  console.error(error.message); // Output: "ParseError at 1:1, expected 'let' but got 'const...'"
}
```
As you can see, a parser either successfully returns the value it parsed or throws a descriptive error.

### Step 2: Handling Patterns and Whitespace

Hardcoding every string isn't enough. We need to parse things like variable names, which follow a pattern. For that, we use the `regex` parser.

We also need to handle whitespace. It would be annoying to manually parse spaces after every token. This is where `lexeme` comes in. A **lexeme** is a token followed by any insignificant trailing whitespace.

`lexeme()` is a **higher-order parser**: it takes a parser as input and returns a *new* parser that does the original job and *also* consumes any whitespace that follows.

```typescript
import { str, regex, lexeme } from '@doeixd/combi-parse';

// `lexeme` wraps our basic parsers to also handle trailing whitespace.
// This makes composing them much cleaner.

// A parser for the 'let' keyword, ignoring any space after it.
const letKeyword = lexeme(str('let'));

// A parser for a variable name using a regular expression.
const identifier = lexeme(regex(/[a-zA-Z_][a-zA-Z0-9_]*/));

// A parser for the equals sign.
const equals = lexeme(str('='));

// We don't need lexeme for the final semicolon, as there's no trailing space to consume.
const semicolon = str(';');
```

### Step 3: Parsing a Sequence of Things

Now we have parsers for the individual pieces: `let`, `user`, `=`, and `;`. We need to tell Combi-Parse to run them in a specific order. For that, we use the `sequence` combinator.

`sequence` takes an array of parsers and runs them one after another. If they all succeed, it returns an array of their results.

```typescript
// ... imports and parsers from above

// Let's define a parser for a string literal like "jane".
// The `between` parser is perfect for this. It parses whatever is
// between a start and end token.
const stringLiteral = between(str('"'), regex(/[^"]*/), str('"'));

// Now, let's combine everything into a sequence.
const declarationParser = sequence([
  letKeyword,
  identifier,
  equals,
  stringLiteral,
  semicolon
]);

// Run it on our input string.
const result = declarationParser.parse('let user = "jane";');

console.log(result);
// Output: [ 'let', 'user', '=', 'jane', ';' ]
```
It worked! We got back an array of all the successfully parsed parts.

### Step 4: Transforming the Result into Something Useful

The array `['let', 'user', '=', 'jane', ';']` is correct, but it’s not very useful. We want a clean object like `{ name: 'user', value: 'jane' }`.

The `sequence` combinator can take a second argument: a **mapper function**. This function receives the array of results and lets you transform it into any shape you want.

This is also where `as const` becomes incredibly useful. By adding `as const` to our array of parsers, we give TypeScript more precise information. It knows *exactly* what type is at each position in the array (e.g., the first element is a `string`, the second is a `string`, etc.), giving us perfect type-safety and autocompletion in our mapper function!

### Final Code: Putting It All Together

```typescript
import { str, regex, sequence, between, lexeme } from '@doeixd/combi-parse';

// 1. Define parsers for the smallest pieces (tokens).
// `lexeme` is a helper that wraps a parser to also consume trailing whitespace.
const letKeyword = lexeme(str('let'));
const identifier = lexeme(regex(/[a-zA-Z_][a-zA-Z0-9_]*/));
const equals = lexeme(str('='));
const semicolon = str(';');

// A string literal is any text between double quotes.
const stringLiteral = between(str('"'), regex(/[^"]*/), str('"'));

// 2. Compose the small parsers into a larger one that understands a sequence.
const declarationParser = sequence(
  // The list of parsers to run in order.
  [
    letKeyword,
    identifier,
    equals,
    stringLiteral,
    semicolon,
  ] as const, // `as const` tells TypeScript to infer the exact shape of the results array.

  // 3. Transform the raw results into a clean, structured object.
  // We only care about the identifier (name) and the string literal (value).
  // Because of `as const`, TypeScript knows `name` and `value` are strings!
  ([_let, name, _eq, value, _semi]) => ({
    type: 'declaration',
    name,
    value
  })
);

// 4. Run it!
const result = declarationParser.parse('let user = "jane";');

// The output is a perfectly typed and structured object.
console.log(result);
// Output: { type: 'declaration', name: 'user', value: 'jane' }
```
And there you have it! You've seen the core idea: **build big, powerful parsers by combining small, simple ones.**

<br />

## The Power of Composition: A Full JSON Parser

You can use these same building blocks to create a complete, robust parser for a complex format like JSON. This demonstrates how the simple ideas of `sequence`, `choice`, and `many` can scale up.

A new concept here is `lazy()`. Since JSON can be recursive (an object can contain other objects), we need a way to reference a parser before it's fully defined. `lazy()` acts as a placeholder for this purpose.

```typescript
import { str, regex, sequence, choice, between, many, sepBy, lazy, lexeme, Parser } from '@doeixd/combi-parse';

// `lazy()` lets us define recursive parsers, since a `jsonValue`
// can contain other `jsonValue`s (e.g., in an array or object).
const jsonValue: Parser<any> = lazy(() => choice([
  str('null').map(() => null),
  str('true').map(() => true),
  str('false').map(() => false),
  regex(/-?\d+(\.\d+)?/).map(Number),
  between(str('"'), regex(/[^"]*/), str('"')),
  jsonArray,  // A value can be an array...
  jsonObject  // ...or an object.
]));

const jsonString = between(str('"'), regex(/[^"]*/), str('"'));

// A property is a key-value pair, like "name": "John"
const jsonProperty = sequence(
  [lexeme(jsonString), str(':'), jsonValue] as const,
  ([key, , value]) => [key, value]
);

// An object is a comma-separated list of properties between curly braces.
const jsonObject = between(
  lexeme(str('{')),
  sepBy(jsonProperty, lexeme(str(','))),
  str('}')
).map(pairs => Object.fromEntries(pairs));

// An array is a comma-separated list of values between square brackets.
const jsonArray = between(
  lexeme(str('[')),
  sepBy(jsonValue, lexeme(str(','))),
  str(']')
);

// Run the final parser on a complex JSON string.
const parsed = jsonValue.parse('{"users": [{"id": 1, "name": "Alice"}]}');
console.log(parsed.users[0].name); // "Alice"
```
This parser is readable, reusable, and type-safe. Each component can be tested and used independently.

<br />

## ✨ Core Philosophy

We designed Combi-Parse around a few key principles to make parsing a better experience.

*   ✅ **Type-Safety First**: The library leverages TypeScript's type system to the fullest. You get precise type inference and compile-time validation, so if your grammar changes, your code will tell you what needs fixing.

*   🧩 **Radical Composability**: Every parser is a small, reusable component. This lets you build incredibly complex grammars from simple, testable pieces. A parser for a `number` can be used in a parser for a `date`, which can be used in a parser for a `log file`.

*   📍 **Human-Friendly Errors**: Say goodbye to `undefined is not a function`. Combi-Parse gives you precise error locations with line and column numbers, along with contextual messages that tell you *what* the parser was trying to do when it failed.

*   🛠️ **A Tool for Every Task**: Real-world parsing is more than just text. Combi-Parse provides specialized toolkits for different domains, so you always have the right tool for the job.

<br />

## 🧰 A Tool for Every Task: Parsing Paradigms

Combi-Parse gives you a toolkit of specialized approaches so you can choose the right one for your project.

| Paradigm | Best For... | Example Import |
| :--- | :--- | :--- |
| **Traditional Combinators** | General parsing, functional style | `import { sequence } from '@doeixd/combi-parse';` |
| **Generator-Based Parsing** | Complex, multi-step, or stateful logic | `import { genParser } from '@doeixd/combi-parse';` |
| **Binary Data Parsing** | File formats, network protocols | `import { Binary } from '@doeixd/combi-parse/binary';` |
| **Stream Processing** | Large files, real-time data feeds | `import { createStreamParser } from '@doeixd/combi-parse/stream';` |
| **Incremental Parsing** | Code editors, IDEs, live previews | `import { IncrementalParser } from '@doeixd/combi-parse/incremental';` |
| **Secure Parsing** | Untrusted user input, API endpoints | `import { SecureParser } from '@doeixd/combi-parse/secure';` |
| **Type-Level Regex** | Compile-time validation, type-safe patterns | `import type { CompileRegex } from '@doeixd/combi-parse/regex';` |

<br />

## 📖 Documentation & Learning

Ready to build your own parser? We have comprehensive documentation to guide you.

| To... | See... |
| :--- | :--- |
| **Understand the fundamentals** | **[Core Concepts](docs/core-concepts.md)** |
| **Follow a guided example** | **[Tutorial: Your First Parser](docs/tutorial.md)** |
| **See a real-world example** | **[Complete JSON Parser Example](docs/examples/json.md)** |
| **Choose the right tools** | **[API Overview](docs/api/overview.md)** |
| **Handle tricky situations** | **[Advanced Techniques](docs/advanced-techniques.md)** |
| **Parse a binary file format** | **[Binary Parsing Guide](docs/binary.md)** |
| **Handle a real-time data feed**| **[Async & Streaming Guide](docs/async-streaming.md)** |
| **Write a type-safe regex** | **[Type-Level Regex Guide](docs/regex-and-type-safety.md)** |
| **Tune for speed** | **[Performance Guide](docs/performance.md)** |
| **Fix a common problem** | **[Troubleshooting Guide](docs/troubleshooting.md)** |

<br />

# API Reference

A guide to the Combi-Parse library, organized by module and functionality.

## Core API (`@doeixd/combi-parse`)

The primary entry point containing the most frequently used parsers and combinators for text parsing.

### Primitive Parsers

These are the fundamental building blocks for recognizing basic patterns.

#### String & Pattern Matching

**`str(text: string)`** → `Parser<string>`
Matches the exact string `text`.
```javascript
str("let") // matches "let" exactly
```

**`regex(pattern: RegExp)`** → `Parser<string>`
Matches a regular expression. The pattern is automatically anchored to the current position.
```javascript
regex(/\d+/) // matches one or more digits
```

**`charClass(...classes)`** → `Parser<string>`
Matches a single character from a type-safe class (e.g., `'Digit'`) or a custom string.
```javascript
charClass('Digit') // matches 0-9
charClass('aeiou') // matches vowels
```

**`anyOf(strings: readonly string[])`** → `Parser<T[number]>`
Matches any of the provided literal strings. A type-safe and ergonomic alternative to `choice`.
```javascript
anyOf(['GET', 'POST'] as const) // matches HTTP methods
```

#### Character & Number Parsing

**`number`** → `Parser<number>`
Parses an integer or floating-point number.
```javascript
number // matches "123", "3.14", "-42"
```

**`anyChar`** → `Parser<string>`
Consumes and returns any single character. Fails only at the end of input.

**`noneOf(chars: string)`** → `Parser<string>`
Matches any single character that is *not* in the `chars` string.
```javascript
noneOf('()[]{}') // matches any char except brackets
```

**`whitespace`** → `Parser<string>`
Matches one or more whitespace characters (`\s+`).

#### Control Flow

**`succeed(value: T)`** → `Parser<T>`
Always succeeds with the given `value`, consuming no input. Useful for injecting defaults.

**`fail(message: string)`** → `Parser<never>`
Always fails with the given `message`, consuming no input. For semantic validation.

**`eof`** → `Parser<null>`
Succeeds only at the very end of the input string, ensuring it was all consumed.

### Combinator Functions

These higher-order functions assemble simple parsers into more complex ones.

#### Sequence & Choice

**`sequence(parsers: Parser[], mapper?: Function)`** → `Parser<any[] | U>`
Runs parsers in order. Returns an array of results, or a transformed value via the optional `mapper`.
```javascript
sequence([str('('), number, str(')')], ([, num]) => num)
```

**`choice(parsers: Parser[])`** → `Parser<T>`
Tries parsers in order, returning the first success. Provides intelligent, combined error messages.
```javascript
choice([str('true'), str('false'), number])
```

#### Repetition

**`many(parser: Parser<T>)`** → `Parser<T[]>`
Matches the `parser` zero or more times. Returns an array of results. Never fails.
```javascript
many(regex(/\w/)) // matches zero or more word characters
```

**`many1(parser: Parser<T>)`** → `Parser<T[]>`
Matches the `parser` one or more times. Fails if it can't match at least once.

**`count(n: number, parser: Parser<T>)`** → `Parser<T[]>`
Matches the `parser` exactly `n` times.
```javascript
count(3, regex(/\d/)) // matches exactly 3 digits
```

#### Lists & Separators

**`sepBy(item: Parser<T>, sep: Parser<U>)`** → `Parser<T[]>`
Matches zero or more `item`s separated by `sep`. Ideal for lists like `1,2,3`.
```javascript
sepBy(number, str(',')) // matches "1,2,3" or ""
```

**`sepBy1(item: Parser<T>, sep: Parser<U>)`** → `Parser<T[]>`
Matches one or more `item`s separated by `sep`.
```javascript
sepBy1(number, str(',')) // matches "1,2,3" but not ""
```

#### Delimiters & Structure

**`between(left: Parser<L>, content: Parser<C>, right: Parser<R>)`** → `Parser<C>`
Matches `content` surrounded by `left` and `right` delimiters.
```javascript
between(str('('), number, str(')')) // matches "(42)"
```

**`until(terminator: Parser<T>)`** → `Parser<string>`
Consumes characters as a string until the `terminator` parser succeeds. Perfect for comments or string contents.
```javascript
until(str('*/')) // matches everything until "*/"
```

#### Advanced Combinators

**`lazy(fn: () => Parser<T>)`** → `Parser<T>`
Defers parser creation. **Essential for recursive grammars** (e.g., a JSON value parser).
```javascript
const jsonValue = lazy(() => choice([jsonObject, jsonArray, str('null')]))
```

### Parser Class Methods

These methods can be chained onto any parser instance for a fluent-style API.

#### Transformation

**`.map(fn: (value: T) => U)`** → `Parser<U>`
Transforms a parser's successful result. The most common way to shape your output data.
```javascript
regex(/\d+/).map(Number) // parse digits and convert to number
```

**`.tryMap(fn: (value: T) => Result<U>)`** → `Parser<U>`
Transforms a result using a function that can *also fail*. Used for semantic validation after a successful parse.
```javascript
number.tryMap(n => n < 256 ? success(n) : fail('too large'))
```

**`.chain(fn: (value: T) => Parser<U>)`** → `Parser<U>`
Sequences another parser where the next logic depends on the result of the first. The most powerful way to create dynamic parsers.
```javascript
str('repeat').chain(() => number).chain(n => count(n, anyChar))
```

#### Alternatives & Options

**`.or(other: Parser<U>)`** → `Parser<T | U>`
Provides an alternative `other` parser if the first one fails *without consuming input*.
```javascript
str('yes').or(str('no')) // matches either "yes" or "no"
```

**`.optional()`** → `Parser<T | null>`
Makes a parser optional. Succeeds with `null` if the parser would have failed.
```javascript
str('const').optional() // matches "const" or nothing
```

#### Sequencing

**`.keepLeft(other: Parser<U>)`** → `Parser<T>`
Runs `other` parser after, but keeps the result of the first one.
```javascript
str('hello').keepLeft(whitespace) // matches "hello " but returns "hello"
```

**`.keepRight(other: Parser<U>)`** → `Parser<U>`
Runs `other` parser after, but keeps the result of the second one.
```javascript
str('$').keepRight(number) // matches "$42" but returns 42
```

#### Utilities

**`.slice()`** → `Parser<string>`
Returns the raw string slice consumed by the parser instead of its structured result.
```javascript
many1(regex(/\w/)).slice() // returns the matched word as a string
```

**`.debug(label: string)`** → `Parser<T>`
Adds console logging to a parser's execution for debugging, without changing its behavior.
```javascript
number.debug('parsing number') // logs debug info when parsing
```

### Error Handling & Advanced Control

**`lexeme(parser: Parser<T>)`** → `Parser<T>`
Wraps a parser to also consume and discard any trailing whitespace. The key to writing clean, robust grammars.
```javascript
const token = (p) => lexeme(p) // helper for whitespace-aware parsing
```

**`label(parser: Parser<T>, msg: string)`** → `Parser<T>`
Replaces a parser's default error message with a more descriptive `msg`.
```javascript
label(number, 'expected a number') // custom error message
```

**`context(parser: Parser<T>, msg: string)`** → `Parser<T>`
Adds context to an error message, showing *what* the parser was trying to do when it failed.
```javascript
context(functionCall, 'in a function call') // adds context to errors
```

**`lookahead(parser: Parser<T>)`** → `Parser<T>`
Succeeds if `parser` would match, but consumes no input. A "positive lookahead".
```javascript
lookahead(str('if')).keepRight(keyword) // checks for 'if' without consuming
```

**`notFollowedBy(parser: Parser<T>)`** → `Parser<null>`
Succeeds if `parser` would *fail* to match. Consumes no input. A "negative lookahead", great for resolving ambiguity.
```javascript
str('if').keepLeft(notFollowedBy(regex(/\w/))) // 'if' not followed by word char
```

**`memo(parser: Parser<T>)`** → `Parser<T>`
Memoizes a parser's result at each position, dramatically improving performance for grammars with lots of backtracking.

**`leftRecursive(fn: () => Parser<T>)`** → `Parser<T>`
Correctly **handles** left-recursive grammars (e.g., `expr = expr + term`), which would cause infinite loops in simple parsers.

## Generator-Based Parsing (`@doeixd/combi-parse/generator`)

For writing parsers with a more readable, imperative `async/await`-like style.

**`genParser(fn: GeneratorFunction)`** → `Parser<T>`
Creates a parser from a generator function. Inside, `yield` a parser to run it and get its result. `return` the final value.
```javascript
const parser = genParser(function* () {
  yield str('(')
  const num = yield number
  yield str(')')
  return num
})
```

**`asyncGenParser(fn: AsyncGeneratorFunction)`** → `AsyncParser<T>`
Creates a parser from an `async function*`. Allows you to `await` promises (e.g., DB calls, API requests) inside your parsing logic.

**`gen`** → `object`
A helper object with control-flow utilities for use inside `genParser`, like `gen.tryParsers(...)` and `gen.while(...)`.

## Specialized Parser Modules

### Binary Parsing (`@doeixd/combi-parse/binary`)

Parses structured binary data. Provides the `Binary` namespace with parsers for working with file formats and network protocols.

- `Binary.u16LE` - Parse 16-bit unsigned little-endian integer
- `Binary.string(len)` - Parse fixed-length string
- `Binary.sequence(...)` - Parse binary sequence

### Stream Processing (`@doeixd/combi-parse/stream`)

Parses large files or real-time data feeds. Provides `createStreamSession` to process delimited data (like NDJSON) chunk-by-chunk without loading everything into memory.

### Incremental Parsing (`@doeixd/combi-parse/incremental`)

For editors and IDEs. Provides `createIncrementalSession` to efficiently re-parse a document after small text changes, reusing cached results for speed.

### Secure Parsing (`@doeixd/combi-parse/secure`)

For untrusted user input. Provides `createSecureSession` to run a parser with resource limits (max recursion depth, parse time) to prevent DoS attacks.

## Advanced & Type-Level Features

### Type-Level Regex (`@doeixd/combi-parse/regex`)

Provides compile-time validation of regex patterns. Exports `CompileRegex<Pattern>` and `Enumerate<Regex>` types for advanced TypeScript metaprogramming. The runtime functions `typedRegex` and `advancedTypedRegex` offer varying degrees of type-safety and performance trade-offs.

### Advanced Primitives (`@doeixd/combi-parse/primitives`)

A toolkit for building compilers. Includes modules for:

- **ParserAlgebra** - Formal language operations like `intersect`
- **AST** - Abstract syntax tree construction utilities
- **Grammar** - Advanced grammar analysis tools
- **Testing** - Property-based testing and fuzzing utilities
<br />

## 🤝 Contributing

We welcome contributions! Whether it's reporting a bug, improving documentation, or submitting a pull request, we'd love to have your help. Please see our contributing guidelines for more details.

<br />

## 📄 License

MIT License - see the [LICENSE](LICENSE) file for details.
