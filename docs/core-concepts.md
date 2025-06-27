# Core Concepts

This guide explains the fundamental concepts behind parser combinators and how Combi-Parse implements them.

## What is Parsing?

Parsing is the process of taking structured text and converting it into meaningful data structures. Every time you:

- Load a JSON file and convert it to objects
- Parse command-line arguments into configuration
- Read a CSV file and extract rows and columns
- Process a configuration file for your application

...you're performing parsing operations.

## The Parser Combinator Approach

### Traditional Parsing vs. Combinators

**Traditional parsing** often involves:
```typescript
// Manual, imperative parsing - brittle and hard to maintain
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

**Parser combinators** offer a fundamentally different approach:

> Instead of writing imperative code that manually tracks position and state, we compose declarative "recipes" that describe what we want to parse.

## The Four Pillars of Parser Combinators

### 1. 🧱 Atomic Parsers: The Building Blocks

Atomic parsers are simple, single-purpose parsers that recognize basic patterns:

```typescript
import { str, regex, charClass } from '@doeixd/combi-parse';

// Matches the exact string "hello"
const helloParser = str('hello');

// Matches one or more digits
const digits = regex(/\d+/);

// Matches any single digit with full type safety
const singleDigit = charClass('Digit');
// Type: Parser<'0'|'1'|'2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'>
```

### 2. 🔧 Combinator Functions: Assembly Instructions

Combinators take simple parsers and combine them into more sophisticated ones:

```typescript
import { sequence, choice, many } from '@doeixd/combi-parse';

// Parse things in order
const greeting = sequence([
  str('Hello'),
  str(' '),
  regex(/[A-Z][a-z]+/)
] as const);

// Try alternatives
const politeness = choice([
  str('please'),
  str('thank you'),
  str('sorry')
]);

// Parse repeated patterns
const digits = charClass('Digit').many();
```

### 3. ⚡ Pure Functions: Predictable Behavior

Every parser is a pure function - given the same input, it always produces the same result:

```typescript
// Conceptually, every parser is:
type Parser<T> = (state: ParserState) => ParseResult<T>;

// This means parsers are:
// - Predictable: same input → same output
// - Composable: can be combined safely
// - Testable: easy to unit test
// - Reusable: no hidden state
```

### 4. 🔄 Automatic Plumbing: The Magic Behind the Scenes

The library handles all the complex details automatically:

- **Position tracking**: Knows exactly where in the input each parser is working
- **Backtracking**: When a parser fails, it automatically rewinds to try alternatives
- **Error aggregation**: Collects and reports the most helpful error messages
- **State threading**: Passes parsing state between combinators seamlessly

## Key Concepts in Detail

### Parser State

Every parser operation works with a parsing state:

```typescript
interface ParserState {
  input: string;      // The text being parsed
  index: number;      // Current position in the input
  line: number;       // Current line number (for error reporting)
  column: number;     // Current column number
}
```

### Success and Failure

Parsers return one of two types of results:

```typescript
type ParseResult<T> = 
  | { success: true; value: T; newState: ParserState }
  | { success: false; error: string; state: ParserState };
```

### Backtracking

When a parser fails, the parsing position automatically rewinds:

```typescript
const numberOrWord = choice([
  number,    // Try to parse a number first
  word       // If that fails, backtrack and try a word
]);

// When parsing "hello":
// 1. Try number.parse("hello") → fails at position 0
// 2. Automatically backtrack to position 0
// 3. Try word.parse("hello") → succeeds, returns "hello"
```

### Transformation Pipeline

Transform results as they flow through your parser:

```typescript
const numberParser = regex(/\d+/)
  .map(str => parseInt(str, 10))           // string → number
  .map(n => n * 2)                        // double it
  .chain(n => n > 100 ? fail('too big') : succeed(n)); // conditional logic
```

## Type Safety

One of Combi-Parse's key strengths is leveraging TypeScript's type system:

### Literal Type Preservation

```typescript
// Preserves exact string types
const httpMethod = choice([
  str('GET'),    // Type: Parser<'GET'>
  str('POST'),   // Type: Parser<'POST'>
  str('PUT'),    // Type: Parser<'PUT'>
  str('DELETE')  // Type: Parser<'DELETE'>
]);
// Result type: Parser<'GET' | 'POST' | 'PUT' | 'DELETE'>
```

### Tuple Type Inference

```typescript
const declaration = sequence([
  str('let'),      // Type: Parser<'let'>
  identifier,      // Type: Parser<string>
  str('='),        // Type: Parser<'='>
  number          // Type: Parser<number>
] as const);
// Result type: Parser<['let', string, '=', number]>
```

### Character Class Types

```typescript
const digit = charClass('Digit');
// Type: Parser<'0'|'1'|'2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'>

const boolean = charClass('tf');
// Type: Parser<'t'|'f'>
```

## Error Handling Philosophy

Combi-Parse prioritizes helpful error messages:

### Precise Location Tracking

```typescript
// Error: Expected "function" at line 3, column 15
```

### Contextual Error Messages

```typescript
const betterParser = context(
  sequence([
    label(str('let'), 'let keyword'),
    label(identifier, 'variable name'),
    label(str('='), 'assignment operator'),
    label(number, 'numeric value')
  ]),
  'parsing variable declaration'
);

// Error: Expected variable name at line 1, column 5 while parsing variable declaration
```

### Error Recovery

```typescript
import { recover } from '@doeixd/combi-parse';

const robustParser = recover(fragileParser, {
  on: ['ParseError'],
  with: () => ({ type: 'error', message: 'Invalid syntax' }),
  skipTo: [str(';'), str('\n')]
});
```

## Memory Model

### Immutable State

All parsing operations create new state objects rather than mutating existing ones:

```typescript
// Each parser operation returns a new state
const state1 = { input: "hello world", index: 0 };
const result = str('hello').run(state1);
// state1 is unchanged, result.newState is { input: "hello world", index: 5 }
```

### Lazy Evaluation

Parsers are lazy - they only do work when `.parse()` is called:

```typescript
// This just creates a parser object, no parsing happens yet
const complexParser = sequence([a, b, c]);

// Parsing only happens here
const result = complexParser.parse(input);
```

## Performance Characteristics

### Memoization

Expensive parsers can be memoized for better performance:

```typescript
import { memo } from '@doeixd/combi-parse';

const expensiveParser = memo(complexRegex);
// Results are cached based on input position
```

### Left-Recursion Handling

Special handling for left-recursive grammars:

```typescript
import { leftRecursive } from '@doeixd/combi-parse';

const expression = leftRecursive(() => choice([
  sequence([expression, str('+'), term]),  // Left-recursive rule
  term                                     // Base case
]));
```

## Next Steps

Now that you understand the core concepts, you can:

- Follow the [Tutorial](tutorial.md) for hands-on examples
- Explore the [API Reference](api/core.md) for detailed function documentation
- Check out [Advanced Techniques](advanced-techniques.md) for complex scenarios
- Review [Examples](examples/json.md) for real-world use cases

## Further Reading

- [Parser Combinators Explained](parser-combinators.md) - Deep dive into the theory
- [Error Handling & Debugging](error-handling.md) - Advanced error handling techniques
- [Performance Optimization](performance.md) - Making your parsers fast
