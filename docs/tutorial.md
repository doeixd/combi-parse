# Tutorial: Building Parsers with Combi-Parse

This tutorial will guide you through building parsers from simple to complex using the Combi-Parse library. We'll start with basic concepts and gradually work up to real-world examples.

## Getting Started

First, let's understand what a parser is. A parser takes input text and extracts structured data from it. In Combi-Parse, parsers are composable functions that can be combined to handle complex input formats.

```typescript
import { str, regex, number, sequence } from 'combi-parse';

// A simple parser that matches the exact string "hello"
const hello = str("hello");
const result = hello.parse("hello world");
// result: "hello"
```

## Basic Building Blocks

### String Matching

The `str` function creates a parser that matches exact strings:

```typescript
const keyword = str("const");
keyword.parse("const x = 5"); // → "const"
```

### Regular Expressions

Use `regex` for pattern matching:

```typescript
const identifier = regex(/[a-zA-Z_][a-zA-Z0-9_]*/);
identifier.parse("myVariable"); // → "myVariable"

const spaces = regex(/\s+/);
spaces.parse("   \n\t"); // → "   \n\t"
```

### Numbers

The built-in `number` parser handles integers:

```typescript
number.parse("42"); // → 42
number.parse("123abc"); // → 123 (stops at first non-digit)
```

## Combining Parsers

### Sequence

The `sequence` function runs parsers in order:

```typescript
const assignment = sequence([
  regex(/[a-z]+/),  // variable name
  str(" = "),       // equals with spaces
  number,           // numeric value
  str(";")          // semicolon
] as const);

assignment.parse("x = 42;");
// → ["x", " = ", 42, ";"]
```

### Transforming Results

Use the `into` parameter to transform sequence results:

```typescript
const assignment = sequence(
  [regex(/[a-z]+/), str(" = "), number, str(";")] as const,
  ([name, , value]) => ({ name, value })
);

assignment.parse("count = 5;");
// → { name: "count", value: 5 }
```

### Choice

The `choice` function tries alternatives:

```typescript
const keyword = choice([
  str("let"),
  str("const"),
  str("var")
]);

keyword.parse("let x"); // → "let"
keyword.parse("const y"); // → "const"
```

## Parser Methods

### Mapping Results

Transform parser output with `.map()`:

```typescript
const upperStr = str("hello").map(s => s.toUpperCase());
upperStr.parse("hello"); // → "HELLO"

const boolParser = choice([
  str("true").map(() => true),
  str("false").map(() => false)
]);
```

### Chaining Parsers

Use `.chain()` when the next parser depends on previous results:

```typescript
// Parse length-prefixed strings like "4:test"
const lengthPrefixed = number.chain(len =>
  str(":").keepRight(regex(new RegExp(`.{${len}}`)))
);

lengthPrefixed.parse("5:hello"); // → "hello"
```

### Repetition

Parse repeated elements:

```typescript
// Zero or more
const digits = regex(/[0-9]/).many();
digits.parse("123"); // → ["1", "2", "3"]
digits.parse("abc"); // → []

// One or more
const digits1 = regex(/[0-9]/).many1();
digits1.parse("123"); // → ["1", "2", "3"]
// digits1.parse("abc"); // throws error
```

### Optional Elements

Make parsers optional:

```typescript
const optionalSign = str("-").optional();
optionalSign.parse("-42"); // → "-"
optionalSign.parse("42");  // → null
```

## Working with Whitespace

### Keeping and Discarding

Use `.keepLeft()` and `.keepRight()` to control what you keep:

```typescript
const token = regex(/[a-z]+/).keepLeft(regex(/\s*/));
// Parses identifier and trailing spaces, keeps only identifier

const value = str("=").keepRight(number);
// Parses "=" then number, keeps only the number
```

### Lexical Parsing

The `lexeme` helper automatically handles trailing whitespace:

```typescript
const lexNumber = lexeme(number);
const lexEquals = lexeme(str("="));

const assignment = sequence([
  lexeme(regex(/[a-z]+/)),
  lexEquals,
  lexNumber
] as const);

assignment.parse("x = 42   "); // → ["x", "=", 42]
```

## Generator Syntax

For complex parsing, use generator functions for cleaner code:

```typescript
import { genParser } from 'combi-parse';

const assignment = genParser(function* () {
  const name = yield regex(/[a-z]+/);
  yield str(" = ");
  const value = yield number;
  yield str(";");
  return { name, value };
});

assignment.parse("count = 42;");
// → { name: "count", value: 42 }
```

## Handling Lists

### Separated Lists

Parse comma-separated values:

```typescript
const numbers = number.sepBy(str(","));
numbers.parse("1,2,3"); // → [1, 2, 3]
numbers.parse("42");    // → [42]
numbers.parse("");      // → []

// At least one item
const numbers1 = number.sepBy1(str(","));
numbers1.parse("1,2,3"); // → [1, 2, 3]
// numbers1.parse("");   // throws error
```

### Between Delimiters

Parse content between delimiters:

```typescript
const quoted = between(str('"'), regex(/[^"]*/), str('"'));
quoted.parse('"hello world"'); // → "hello world"

const parenthesized = between(str("("), number, str(")"));
parenthesized.parse("(42)"); // → 42
```

## Error Handling

### Custom Error Messages

Provide better error messages:

```typescript
import { label } from 'combi-parse';

const email = label(
  regex(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/),
  "a valid email address"
);

// email.parse("invalid"); // Parse error: a valid email address
```

### Contextual Errors

Add context to errors:

```typescript
import { context } from 'combi-parse';

const userParser = context(
  sequence([str("name:"), regex(/[a-z]+/)]),
  "parsing user information"
);
```

## Practical Example: Configuration Parser

Let's build a parser for a simple configuration format:

```typescript
const configParser = genParser(function* () {
  const config: Record<string, any> = {};
  
  // Skip initial whitespace
  yield regex(/\s*/).optional();
  
  while (true) {
    // Try to parse a key-value pair
    const line = yield choice([
      // Comment line
      regex(/#.*/).map(() => null),
      // Key-value pair
      genParser(function* () {
        const key = yield regex(/[a-zA-Z_][a-zA-Z0-9_]*/);
        yield regex(/\s*=\s*/);
        const value = yield choice([
          number,
          between(str('"'), regex(/[^"]*/), str('"')),
          choice([
            str("true").map(() => true),
            str("false").map(() => false)
          ])
        ]);
        return { key, value };
      })
    ]).optional();
    
    if (!line) break;
    
    if (line && typeof line === 'object' && 'key' in line) {
      config[line.key] = line.value;
    }
    
    // Optional newline
    yield regex(/\s*\n/).optional();
    yield regex(/\s*/).optional();
    
    // Check if we're at end of input
    if (yield lookahead(eof).optional()) break;
  }
  
  return config;
});

// Usage
const config = configParser.parse(`
  # Database configuration
  host = "localhost"
  port = 5432
  debug = true
`);
// → { host: "localhost", port: 5432, debug: true }
```

## Next Steps

Now that you understand the basics, explore these advanced topics:

- [API Reference](api/core.md) - Complete function documentation
- [Advanced Techniques](advanced-techniques.md) - Complex parsing scenarios
- [Examples](examples/json.md) - Real-world parsing examples
- [Error Handling](error-handling.md) - Better error messages and recovery
- [Performance](performance.md) - Optimizing your parsers

## Common Patterns

### Whitespace Handling

```typescript
// Mandatory whitespace
const ws = regex(/\s+/);

// Optional whitespace
const optWs = regex(/\s*/).optional();

// Token with trailing whitespace
const token = (p: Parser<any>) => p.keepLeft(optWs);
```

### Identifiers and Keywords

```typescript
const identifier = regex(/[a-zA-Z_][a-zA-Z0-9_]*/);
const keyword = (word: string) => str(word).keepLeft(regex(/\b/));
```

### Bracketed Expressions

```typescript
const brackets = <T>(content: Parser<T>) =>
  between(str("["), content, str("]"));

const parens = <T>(content: Parser<T>) =>
  between(str("("), content, str(")"));
```

These patterns form the foundation for building more complex parsers. Practice with simple examples before moving on to complete language parsers.
