# API Overview

Combi-Parse provides several different approaches to parsing, each optimized for different use cases.

## 🧩 Core Parser Combinators

The traditional functional approach - build complex parsers by combining simple ones.

### Basic Parsers
- `str(text)` - Match exact strings
- `regex(pattern)` - Match regular expressions  
- `charClass(class)` - Match character classes with full type safety
- `number` - Parse numbers
- `whitespace` - Parse whitespace

### Combinators
- `sequence(parsers)` - Parse in order
- `choice(parsers)` - Try alternatives
- `many()` / `many1()` - Repetition
- `optional()` - Optional parsing
- `between(open, content, close)` - Parse surrounded content

### Example
```typescript
import { str, regex, sequence, choice } from '@doeixd/combi-parse';

const declaration = sequence([
  str('let'),
  regex(/[a-zA-Z_][a-zA-Z0-9_]*/),
  str('='),
  choice([number, stringLiteral])
] as const);
```

**Best for**: Traditional parser combinator style, functional programming approach

---

## 🔄 Generator-based Parsing

Write parsers using JavaScript generators for more natural, imperative-style syntax.

### Core Functions
- `gen(function*)` - Create generator-based parser
- `yield parser` - Run a parser and get its result
- `yield* parser` - Delegate to another generator parser

### Example
```typescript
import { gen, str, regex } from '@doeixd/combi-parse';

const declaration = gen(function*() {
  yield str('let');
  const name = yield regex(/[a-zA-Z_][a-zA-Z0-9_]*/);
  yield str('=');
  const value = yield choice([number, stringLiteral]);
  
  return { type: 'declaration', name, value };
});
```

**Best for**: Complex parsing logic, conditional parsing, more readable code

---

## ⚙️ Specialized Parsers

Purpose-built parsers for specific domains and requirements.

### Binary Data Parsing
```typescript
import { BinaryParser } from '@doeixd/combi-parse/binary';

const parser = BinaryParser.sequence([
  BinaryParser.uint32(),  // 4-byte integer
  BinaryParser.string(10), // 10-byte string
  BinaryParser.bytes(4)   // 4 raw bytes
]);
```

**Best for**: File formats, network protocols, embedded systems

### Stream Processing
```typescript
import { StreamParser } from '@doeixd/combi-parse/stream';

const parser = StreamParser.create(lineParser)
  .onResult(line => console.log('Parsed:', line))
  .onError(err => console.error('Error:', err));

stream.pipe(parser);
```

**Best for**: Real-time data, large files, memory-constrained environments

### Incremental Parsing
```typescript
import { IncrementalParser } from '@doeixd/combi-parse/incremental';

const parser = IncrementalParser.create(documentParser);
parser.parse(initialText);

// Later, apply changes
parser.applyChange({
  start: 100,
  deleteCount: 5,
  insertText: 'new content'
});
```

**Best for**: Code editors, IDEs, live preview systems

### Secure Parsing
```typescript
import { SecureParser } from '@doeixd/combi-parse/secure';

const parser = SecureParser.create(jsonParser, {
  maxDepth: 10,
  maxNodes: 1000,
  timeout: 5000
});
```

**Best for**: User-generated content, API endpoints, untrusted input

---

## 🎯 Type-Level Regex Engine

Compile-time regex validation and type-safe pattern matching.

```typescript
import type { CompileRegex, Match } from '@doeixd/combi-parse/regex';

type EmailRegex = CompileRegex<'^[^@]+@[^@]+\\.[a-z]+$'>;
type IsValid = Match<EmailRegex, 'user@example.com'>; // true
type Invalid = Match<EmailRegex, 'not-an-email'>; // false

// Runtime usage
const emailParser = pattern<EmailRegex>(); 
```

**Best for**: Compile-time validation, type-safe parsing, configuration validation

---

## 🛠️ Advanced Primitives

Low-level building blocks for sophisticated parsing systems.

### Parser Algebra
```typescript
import { ParserAlgebra } from '@doeixd/combi-parse/primitives';

const intersection = ParserAlgebra.intersect(parser1, parser2);
const difference = ParserAlgebra.difference(parser1, parser2);
const permutation = ParserAlgebra.permutation([a, b, c]);
```

### AST Construction
```typescript
import { ast } from '@doeixd/combi-parse/primitives';

const nodeParser = ast('BinaryExpression', {
  left: expressionParser,
  operator: operatorParser,
  right: expressionParser
});
```

### Error Recovery
```typescript
import { recover } from '@doeixd/combi-parse/primitives';

const robustParser = recover(parser, {
  on: ['SyntaxError'],
  with: () => ({ type: 'error' }),
  skipTo: [str(';'), str('\n')]
});
```

### Grammar Analysis
```typescript
import { analyzeGrammar } from '@doeixd/combi-parse/primitives';

const analysis = analyzeGrammar(parser);
console.log(analysis.isLL1); // true/false
console.log(analysis.firstSets); // FIRST sets
console.log(analysis.conflicts); // Grammar conflicts
```

**Best for**: Language implementations, advanced parsing theory, compiler construction

---

## 🚀 Getting Started

### For Beginners
Start with **Core Parser Combinators**:
```typescript
import { str, sequence, choice } from '@doeixd/combi-parse';
```

### For Complex Logic
Try **Generator-based Parsing**:
```typescript
import { gen } from '@doeixd/combi-parse';
```

### For Specific Domains
Use **Specialized Parsers**:
```typescript
import { BinaryParser } from '@doeixd/combi-parse/binary';
import { StreamParser } from '@doeixd/combi-parse/stream';
```

### For Type Safety
Leverage the **Type-Level Regex Engine**:
```typescript
import type { CompileRegex } from '@doeixd/combi-parse/regex';
```

## Next Steps

- [Core API Reference](core.md) - Detailed function documentation
- [Generator API Reference](generators.md) - Generator-based parsing
- [Specialized Parsers](specialized.md) - Domain-specific parsers
- [Examples](../examples/json.md) - Real-world use cases
