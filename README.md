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

## 🤝 Contributing

We welcome contributions! Whether it's reporting a bug, improving documentation, or submitting a pull request, we'd love to have your help. Please see our contributing guidelines for more details.

<br />

## 📄 License

MIT License - see the [LICENSE](LICENSE) file for details.