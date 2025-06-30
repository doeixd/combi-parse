Of course. Here is the revised `README.md` with a `<br />` tag and an extra newline before each `<h2>` header for better visual separation.

---

### Improved `README.md` (with spacing)

[![NPM Version](https://img.shields.io/npm/v/@doeixd/combi-parse.svg)](https://www.npmjs.com/package/@doeixd/combi-parse)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](#)
[![TypeScript](https://img.shields.io/badge/%3C/%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/)

# Combi-Parse

A friendly, powerful, and type-safe parser combinator library for TypeScript. It helps you transform structured text into meaningful data with confidence and clarity.

Combi-Parse is built on the idea that parsing shouldn't be a tedious and error-prone task. By providing a set of simple, composable building blocks, it allows you to describe the structure of your data declaratively. The library handles the complex details—like tracking position, managing state, and reporting errors—so you can focus on your grammar.

<br />

## 📥 Installation

```bash
npm install @doeixd/combi-parse
```

<br />

## 🚀 Quick Start: Your First Parser

Let's build a simple parser for a variable declaration, like `let user = "jane";`.

```typescript
import { str, regex, sequence, between, lexeme } from '@doeixd/combi-parse';

// 1. Define the small, individual pieces of our grammar.
// `lexeme` is a helper that wraps a parser and also consumes any trailing whitespace.
const letKeyword = lexeme(str('let'));
const identifier = lexeme(regex(/[a-zA-Z_][a-zA-Z0-9_]*/));
const equals = lexeme(str('='));
const semicolon = str(';');

// A string literal is any text between double quotes.
const stringLiteral = between(str('"'), regex(/[^"]*/), str('"'));

// 2. Compose the pieces into a sequence.
// `sequence` runs each parser in order and collects their results.
const declarationParser = sequence(
  [
    letKeyword,
    identifier,
    equals,
    stringLiteral,
    semicolon,
  ] as const, // `as const` gives us perfect type safety!
  
  // 3. Transform the raw results into a clean, structured object.
  // We only care about the identifier (name) and the string literal (value).
  ([, name, , value]) => ({ type: 'declaration', name, value })
);

// 4. Run it!
const result = declarationParser.parse('let user = "jane";');

// The output is a perfectly typed and structured object.
console.log(result);
// Output: { type: 'declaration', name: 'user', value: 'jane' }
```

This example shows the core idea: **build big parsers by combining small ones.**

<br />

## The Power of Composition: A Full JSON Parser

You can use these same simple building blocks to create a complete, robust parser for a complex format like JSON.

```typescript
import { str, regex, sequence, choice, between, many, sepBy, lazy, lexeme, Parser } from '@doeixd/combi-parse';

// We define parsers for each part of the JSON spec. `lazy()` lets us
// define recursive parsers (like a JSON value containing an array of values).
const jsonValue: Parser<any> = lazy(() => choice([
  str('null').map(() => null),
  str('true').map(() => true),
  str('false').map(() => false),
  regex(/-?\d+(\.\d+)?/).map(Number),
  between(str('"'), regex(/[^"]*/), str('"')),
  jsonArray,  // A value can be an array
  jsonObject  // Or a value can be an object
]));

// A string is anything between double quotes.
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

| Paradigm | Best For... | Example |
| :--- | :--- | :--- |
| **Traditional Combinators** | General parsing, functional style | `sequence([a, b, c])` |
| **Generator-Based Parsing** | Complex, multi-step, or stateful logic | `genParser(function*() { ... })` |
| **Binary Data Parsing** | File formats, network protocols | `Binary.u32LE` |
| **Stream Processing** | Large files, real-time data feeds | `createStreamParser(...)` |
| **Incremental Parsing** | Code editors, IDEs, live previews | `IncrementalParser.create(...)` |
| **Secure Parsing** | Untrusted user input, API endpoints | `SecureParser.create(...)` |
| **Type-Level Regex** | Compile-time validation, type-safe patterns | `type Email = CompileRegex<'...'>` |

<br />

## 📖 Documentation & Learning

Ready to build your own parser? We have comprehensive documentation to guide you.

| To... | See... |
| :--- | :--- |
| **Understand the fundamentals** | **[Core Concepts](docs/core-concepts.md)** |
| **See all available functions** | **[API Overview](docs/api/overview.md)** |
| **Fix a common problem** | **[Troubleshooting Guide](docs/troubleshooting.md)** |
| **Parse a binary file format** | **[Binary Parsing Guide](docs/binary.md)** |
| **Handle a real-time data feed**| **[Async & Streaming Guide](docs/async-streaming.md)** |
| **Write a type-safe regex** | **[Type-Level Regex Guide](docs/regex-and-type-safety.md)** |

<br />

## 🤝 Contributing

We welcome contributions! Whether it's reporting a bug, improving documentation, or submitting a pull request, we'd love to have your help. Please see our contributing guidelines for more details.

<br />

## 📄 License

MIT License - see the [LICENSE](LICENSE) file for details.