# Core Concepts

This guide explains the fundamental concepts behind parser combinators and how Combi-Parse implements them. Understanding these principles is key to using the library effectively.

## What is Parsing?

Parsing is the process of taking structured text and converting it into a meaningful data structure. You're parsing every time you:

-   Load a JSON file and convert it to objects.
-   Parse command-line arguments into a configuration map.
-   Read a CSV file and extract rows and columns.
-   Process a configuration file (`.toml`, `.yaml`, `.env`) for your application.

## The Parser Combinator Approach

### Traditional Parsing vs. Combinators

**Traditional parsing** often involves writing manual, imperative code that is brittle and difficult to maintain:
```typescript
// Manual, imperative parsing is hard to read and extend.
function parseDeclaration(input: string) {
  let index = 0;
  
  // Skip whitespace
  while (input[index] === ' ') index++;
  
  // Check for "let"
  if (input.substring(index, index + 3) !== 'let') {
    throw new Error('Expected "let"');
  }
  index += 3;
  
  // Skip more whitespace, then parse an identifier...
  // This quickly becomes unmanageable!
}
```

**Parser combinators** offer a fundamentally different approach:

> Instead of writing code that manually tracks position and state, we build small, declarative "recipes" (parsers) and combine them into more sophisticated ones.

## The Four Pillars of Parser Combinators

### 1. 🧱 Atomic Parsers: The Building Blocks

Atomic parsers are simple, single-purpose functions that recognize basic patterns. They are the foundation of any grammar.

```typescript
import { str, regex, charClass } from 'combi-parse';

// Matches the exact string "const"
const constParser = str('const');

// Matches one or more digits using a regular expression
const digits = regex(/[0-9]+/);

// Matches any single digit with full type safety
const singleDigit = charClass('Digit');
// Type: Parser<'0'|'1'|'2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'>
```

### 2. 🔧 Combinator Functions: Assembly Instructions

Combinators are higher-order functions that take simple parsers and assemble them into more complex ones. This is where the "composition" happens.

```typescript
import { sequence, choice, many } from 'combi-parse';

// Parse things in order: `sequence([a, b, c])`
const greetingParser = sequence([
  str('Hello'),
  str(' '),
  regex(/[A-Z][a-z]+/)
] as const);

// Try alternatives until one succeeds: `choice([a, b, c])`
const keywordParser = choice([
  str('let'),
  str('const'),
  str('var')
]);

// Parse a repeated pattern zero or more times: `p.many()`
const commaSeparatedDigits = charClass('Digit').sepBy(str(','));
```

### 3. ⚡ Pure Functions: Predictable Behavior

Every parser in the library is a wrapper around a pure function. Given the same input and position, it always produces the same result without side effects.

```typescript
// Conceptually, every parser is a function with this signature:
type ParserFunction<T> = (state: ParserState) => ParseResult<T>;

// This functional purity means parsers are:
// - Predictable: Same input → same output.
// - Composable: Can be combined safely without hidden state.
// - Testable: Easy to unit test individual components of your grammar.
// - Reusable: A parser for an `identifier` can be used anywhere one is needed.
```

### 4. 🔄 Automatic Plumbing: The Magic Behind the Scenes

The library handles all the complex, error-prone details of parsing for you:

-   **Position Tracking**: Knows exactly where in the input string each parser is working.
-   **Backtracking**: When a `choice` fails, it automatically and safely rewinds the position to try the next alternative.
-   **Error Aggregation**: Collects and reports the most helpful error message from the point in the input where parsing got the furthest.
-   **State Threading**: Passes the parser's state (input and index) between combinators seamlessly.

## Key Concepts in Detail

### Parser State

Every parser operation receives the current state and returns a new state upon success. The state is immutable, making backtracking safe.

```typescript
// The state is simple and immutable.
interface ParserState {
  readonly input: string;
  readonly index: number;
}

// Note: Line and column numbers are calculated on demand from this state
// when an error needs to be formatted for a user.
```

### Success and Failure

A parser's `run` method returns a `ParseResult`, which is a discriminated union representing either a success or a failure.

```typescript
// The two possible outcomes of running a parser
type ParseResult<T> =
  | { readonly type: 'success'; readonly value: T; readonly state: ParserState }
  | { readonly type: 'failure'; readonly message: string; readonly state: ParserState };
```

### Backtracking

When a parser in a `choice` or `or` fails *without consuming any input*, the library automatically backtracks, allowing the next parser to try from the same starting position.

```typescript
const numberOrWord = choice([
  number,    // Try to parse a number first
  word       // If that fails, backtrack and try a word
]);

// When parsing "hello":
// 1. `number.run("hello")` is called → fails at index 0.
// 2. Because no input was consumed, the library backtracks.
// 3. `word.run("hello")` is called from index 0 → succeeds.
```

### The Transformation Pipeline

Parsers are monadic, meaning you can chain operations like `.map()` and `.chain()` to create a powerful data transformation pipeline.

```typescript
const numberParser = regex(/\d+/)
  .map(str => parseInt(str, 10))                // string → number
  .map(n => ({ value: n }))                      // number → { value: number }
  .chain(obj =>                                  // Use the result to create a new parser
    obj.value > 100 ? fail('too big') : succeed(obj)
  );
```

## Type Safety

Combi-Parse leverages TypeScript's advanced type system to catch errors at compile time and provide excellent autocompletion.

### Literal Type Preservation

Using `as const` with `sequence` or `choice` preserves the exact string types, giving you a precise union or tuple type.

```typescript
const httpMethod = choice([
  str('GET'),
  str('POST'),
  str('PUT'),
] as const);
// Result type: Parser<'GET' | 'POST' | 'PUT'>
```

### Tuple Type Inference

The `sequence` combinator infers a perfectly typed tuple of its results.

```typescript
const declaration = sequence([
  str('let'),      // Type: 'let'
  identifier,      // Type: string
  str('='),        // Type: '='
  number           // Type: number
] as const);
// Result type: Parser<['let', string, '=', number]>
```

### Character Class Types

The `charClass` parser infers a union type of all possible characters it can match.

```typescript
const digit = charClass('Digit');
// Type: Parser<'0'|'1'|'2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'>

const hexDigit = charClass('0123456789abcdef');
// Type: Parser<'0'|'1'|'2'|...|'e'|'f'>
```

## Error Handling Philosophy

Combi-Parse is designed to produce human-friendly error messages out of the box.

### Precise Location Tracking & Context

Errors automatically include line and column numbers, and the `context` combinator helps you explain what the parser was attempting to do.

```typescript
import { context, label } from 'combi-parse';

const userParser = context(
  sequence([
    label(str('id:'), 'the id label'),
    label(number, 'a numeric user id')
  ]),
  'a user record'
);

// If you parse "id: abc", you'll get a detailed, contextual error:
// → Parse error at Line 1, Col 5: [in a user record] Expected a numeric user id but found "a"
```

### Building for Error Recovery

The library's primitives can be used to build sophisticated error recovery mechanisms. Instead of stopping, you can define a rule that skips bad input and continues parsing.

```typescript
// A conceptual example of error recovery.
const statement = choice([
  validAssignment,
  validFunctionCall,
  // If no valid statement matches, this 'recovery' parser runs.
  // It skips to the next semicolon and succeeds with an 'ErrorNode'.
  recoverToSemicolon.map(skippedText => ({
    type: 'ErrorNode',
    message: 'Invalid statement syntax',
    skipped: skippedText
  }))
]);
```

## Key Architectural Decisions

### Immutable State

All parsing operations are immutable. A parser receives a state and returns a **new** state object on success. The original state is never modified. This makes backtracking trivial and eliminates a whole class of bugs related to hidden state.

### Lazy Evaluation

Defining a parser is cheap. `const myParser = sequence([...])` just creates a lightweight object containing a function. No parsing work is done until you call `.parse(input)` on the final, composed parser. This allows for the definition of complex and even infinitely recursive grammars.

### Performance: Memoization and Left-Recursion

For performance-critical or highly recursive grammas, Combi-Parse provides advanced tools:

-   **`memo(parser)`**: Wraps a parser to cache its result at each input position. This implements "Packrat parsing," which can dramatically speed up parsers with overlapping rules.
-   **`leftRecursive(parserFn)`**: Provides a robust mechanism to handle left-recursive grammars (e.g., `expr = expr + term`) directly, which would cause an infinite loop in simple recursive descent parsers.

## Next Steps

Now that you understand the core concepts, you're ready to start building.

-   Follow the **Tutorial** for a hands-on example of building a JSON parser.
-   Explore the **API Reference** for detailed function and method documentation.
-   Review the **Error Handling & Debugging Guide** for advanced techniques.