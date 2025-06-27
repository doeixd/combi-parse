[![NPM Version](https://img.shields.io/npm/v/@doeixd/combi-parse.svg)](https://www.npmjs.com/package/@doeixd/combi-parse)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](#)
[![TypeScript](https://img.shields.io/badge/%3C/%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/)

# Combi-Parse
A comprehensive, type-safe parser combinator library for TypeScript with multiple parsing approaches and advanced features.

Transform structured text into meaningful data structures with full type safety, comprehensive error reporting, and multiple parsing paradigms to suit any use case.

## ✨ Key Features

*   🎯 **Multiple Parsing Approaches**: Traditional combinators, generator-based syntax, streaming, binary data, and more
*   ✅ **Type-Safe by Design**: Full TypeScript integration with precise type inference and compile-time validation
*   🧩 **Highly Composable**: Build complex parsers by combining simple, reusable components
*   📍 **Detailed Error Reporting**: Precise error locations with contextual messages and recovery strategies
*   ⚡ **High Performance**: Memoization, left-recursion handling, and grammar optimization built-in
*   🛡️ **Production Ready**: Security-hardened parsers, DoS protection, and comprehensive testing utilities
*   🔄 **Advanced Features**: Binary parsing, streaming, incremental parsing, and type-level regex engine

<br />

## 📥 Installation

```bash
# Using npm
npm i @doeixd/combi-parse
```

<br />

## 🚀 Quick Examples

### Traditional Combinators
```typescript
import { str, regex, sequence, between, lexeme } from '@doeixd/combi-parse';

const identifier = regex(/[a-zA-Z_][a-zA-Z0-9_]*/);
const stringLiteral = between(str('"'), regex(/[^"]*/), str('"'));

const declarationParser = sequence([
  lexeme(str('let')),
  lexeme(identifier),
  lexeme(str('=')),
  stringLiteral,
  str(';')
] as const, ([, name, , value]) => ({ type: 'declaration', name, value }));

const result = declarationParser.parse('let user = "jane";');
// Output: { type: 'declaration', name: 'user', value: 'jane' }
```

### Generator-Based Parsing
```typescript
import { gen, str, regex } from '@doeixd/combi-parse';

const declarationParser = gen(function*() {
  yield str('let');
  const name = yield regex(/[a-zA-Z_][a-zA-Z0-9_]*/);
  yield str('=');
  const value = yield stringLiteral;
  yield str(';');
  
  return { type: 'declaration', name, value };
});
```

### Binary Data Parsing
```typescript
import { BinaryParser } from '@doeixd/combi-parse/binary';

const headerParser = BinaryParser.sequence([
  BinaryParser.uint32(),     // File size
  BinaryParser.string(4),    // Magic bytes
  BinaryParser.uint16()      // Version
]);
```

### Stream Processing
```typescript
import { StreamParser } from '@doeixd/combi-parse/stream';

const csvParser = StreamParser.create(csvRowParser)
  .onResult(row => processRow(row))
  .onError(err => logError(err));
```

<br />

## 🧩 Multiple Parsing Approaches

Combi-Parse provides several specialized parsing approaches for different use cases:

### 🔧 Traditional Combinators
The classic functional approach - build parsers by combining simple functions.
```typescript
import { str, sequence, choice, many } from '@doeixd/combi-parse';
```
**Best for**: General parsing, functional programming style, composable parsers

### 🔄 Generator-Based Parsing  
Write parsers using JavaScript generators for more natural, imperative-style syntax.
```typescript
import { gen } from '@doeixd/combi-parse';
```
**Best for**: Complex parsing logic, conditional parsing, more readable code

### ⚙️ Binary Data Parsing
Parse structured binary data like file formats and network protocols.
```typescript
import { BinaryParser } from '@doeixd/combi-parse/binary';
```
**Best for**: File formats, network protocols, embedded systems

### 🌊 Stream Processing
Real-time parsing of data streams with backpressure handling.
```typescript
import { StreamParser } from '@doeixd/combi-parse/stream';
```
**Best for**: Large files, real-time data, memory-constrained environments

### 📝 Incremental Parsing
Editor-optimized parsing with efficient change tracking and recomputation.
```typescript
import { IncrementalParser } from '@doeixd/combi-parse/incremental';
```
**Best for**: Code editors, IDEs, live preview systems

### 🛡️ Secure Parsing
Security-hardened parsers with DoS protection and resource limits.
```typescript
import { SecureParser } from '@doeixd/combi-parse/secure';
```
**Best for**: User-generated content, API endpoints, untrusted input

### 🎯 Type-Level Regex Engine
Compile-time regex validation with full type safety.
```typescript
import type { CompileRegex, Match } from '@doeixd/combi-parse/regex';
```
**Best for**: Compile-time validation, configuration parsing, type-safe patterns

## 📖 Documentation

**Complete documentation is available in the [docs/](docs/) directory:**

### 🚀 Getting Started
- **[Core Concepts](docs/core-concepts.md)** - Understanding parser combinators
- **[API Overview](docs/api/overview.md)** - Choose the right parsing approach
- **[Troubleshooting](docs/troubleshooting.md)** - Common issues and solutions

### 📚 API Reference
- **[Core API](docs/api/core.md)** - Traditional combinators and basic functionality
- **[Generators API](docs/api/generators.md)** - Generator-based parsing
- **[Parsers API](docs/api/parsers.md)** - Specialized parsers (binary, stream, secure, etc.)
- **[Primitives API](docs/api/primitives.md)** - Advanced primitives and utilities

### 🎯 Specialized Topics
- **[Async & Streaming](docs/async-streaming.md)** - Real-time and asynchronous parsing
- **[Character Classes](docs/character-classes.md)** - Type-safe character classification

### 🔍 Need Help?
- Check the **[Troubleshooting Guide](docs/troubleshooting.md)** for common issues
- Review the **[API Documentation](docs/api/overview.md)** for detailed references
- See **[Real-world Examples](docs/async-streaming.md#real-world-examples)** for practical implementations

## 🤔 Why Parser Combinators?

Traditional parsing approaches are brittle and hard to maintain:

```typescript
// Traditional approach - brittle and hard to maintain
function parseDeclaration(input: string) {
  let index = 0;
  
  // Skip whitespace
  while (input[index] === ' ') index++;
  
  // Check for "let"
  if (!input.substring(index, index + 3) === 'let') {
    throw new Error('Expected "let"');
  }
  index += 3;
  
  // Skip whitespace
  while (input[index] === ' ') index++;
  
  // Parse identifier... and so on
  // This gets unwieldy fast!
}
```

**Parser combinators offer a fundamentally different approach:**

> Instead of writing imperative code that manually tracks position and state, we compose declarative "recipes" that describe what we want to parse.

### The Power of Composition

Build complex parsers from simple, reusable pieces:

**🧱 Atomic Parsers**: Simple building blocks like `str('hello')`, `regex(/\d+/)`, `charClass('Digit')`

**🔧 Combinators**: Assembly instructions like `sequence()`, `choice()`, `many()`

**⚡ Pure Functions**: Predictable, composable, testable

**🔄 Automatic Plumbing**: Position tracking, backtracking, error handling

### Complete JSON Parser Example

```typescript
import { str, regex, sequence, choice, between, many, lexeme } from '@doeixd/combi-parse';

// Build a complete JSON parser from simple pieces
const jsonValue = choice([
  str('null').map(() => null),
  str('true').map(() => true),
  str('false').map(() => false),
  regex(/\d+/).map(Number),
  between(str('"'), regex(/[^"]*/), str('"')), // String
  between(str('['), sepBy(lazy(() => jsonValue), str(',')), str(']')), // Array  
  between(str('{'), sepBy(jsonProperty, str(',')), str('}'))
    .map(pairs => Object.fromEntries(pairs)) // Object
]);

const jsonProperty = sequence([
  between(str('"'), regex(/[^"]*/), str('"')),
  lexeme(str(':')),
  jsonValue
], ([key, , value]) => [key, value]);

// Parse complex JSON
const result = jsonValue.parse('{"users": [{"name": "John", "age": 30}]}');
```

This example demonstrates the core principles:
- **Composability**: Complex parsers built from simple pieces
- **Type Safety**: Full TypeScript integration
- **Readability**: Code reads like a grammar specification
- **Reusability**: Each piece can be used independently

## 🚀 Get Started

1. **Install**: `npm install @doeixd/combi-parse`
2. **Learn**: Read the [Core Concepts](docs/core-concepts.md)
3. **Choose**: Pick your [parsing approach](docs/api/overview.md)
4. **Build**: Create your parser
5. **Debug**: Use the [troubleshooting guide](docs/troubleshooting.md) if needed

## 🌟 What Makes This Special

### 🎯 **Multiple Paradigms**
- Traditional combinators for functional programming
- Generator syntax for imperative-style parsing
- Stream processing for real-time data
- Binary parsing for structured data formats

### ✅ **Production Ready**
- Security-hardened parsers with DoS protection
- Comprehensive error recovery mechanisms
- Performance optimization and profiling tools
- Extensive testing utilities and property-based testing

### 🔬 **Advanced Features**
- Type-level regex engine for compile-time validation
- Incremental parsing for editor integration
- Grammar analysis and optimization
- Parser algebra operations

### 📚 **Developer Experience**
- Comprehensive documentation with real-world examples
- Interactive debugging and visualization tools
- Detailed error messages with context
- Property-based testing and fuzzing support

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines for details on how to:

- Report bugs and request features
- Submit pull requests
- Improve documentation
- Add examples and tutorials

---

**Ready to start parsing?** Check out the [Core Concepts](docs/core-concepts.md) to understand the fundamentals, then explore the [API Documentation](docs/api/overview.md) to find the right tools for your use case.
