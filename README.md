[![NPM Version](https://img.shields.io/npm/v/@doeixd/combi-parse.svg)](https://www.npmjs.com/package/@doeixd/combi-parse)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](#)
[![TypeScript](https://img.shields.io/badge/%3C/%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/)

# Combi-Parse
A friendly, type-safe parser combinator library for TypeScript.

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
npm i @doeixd/combi-parse
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

## 🤔 Understanding Parser Combinators: The Deep Dive

### What is Parsing?

Parsing is the process of taking raw text and turning it into a structured, meaningful representation. A web browser parses HTML into a DOM tree, a JavaScript engine parses code into an Abstract Syntax Tree (AST), and a command-line tool parses arguments into a configuration object. This library gives you the tools to do the same for any structured text you can imagine.

### The Traditional Approach vs. Parser Combinators

You could parse text with a series of `indexOf`, `substring`, and regular expression calls:

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

Parser combinators offer a fundamentally different approach. The core insight is:

**Instead of writing imperative code that manually tracks position and state, we compose declarative "recipes" that describe what we want to parse.**

### How Parser Combinators Work

The magic happens through **composition**. Here's the conceptual flow:

1. **Create atomic parsers** that recognize simple patterns (like a specific string or a number)
2. **Use combinator functions** to combine these into more complex parsers
3. **Each parser is a pure function** that takes input and returns either success or failure
4. **Combinators handle the plumbing** of threading state, backtracking on failures, and collecting results

```typescript
// Each of these is a "recipe" - a Parser<T> object
const keyword = str('let');           // Parser<'let'>
const identifier = regex(/[a-z]+/);   // Parser<string>
const equals = str('=');              // Parser<'='>

// Combinators compose these recipes into bigger recipes
const declaration = sequence([        // Parser<[string, string, string]>
  keyword,
  identifier, 
  equals
]);

// Only when you call .parse() does the actual parsing happen
const result = declaration.parse('let x =');
```

### The State Machine Under the Hood

When you call `.parse()`, here's what happens internally:

1. **Initialize state**: `{ input: "let x = 42", index: 0 }`
2. **Thread state through parsers**: Each parser receives the current state and returns either:
   - `Success<T>` with the parsed value and new state
   - `Failure` with an error message and the failure position
3. **Backtrack on failure**: If a parser fails, the state rewinds to where it started
4. **Collect and transform results**: Successful parsers can transform their results with `.map()`

```typescript
// Conceptual implementation of how `str()` works
function str(expected: string): Parser<string> {
  return {
    run(state: ParserState): ParseResult<string> {
      const { input, index } = state;
      
      if (input.substring(index, index + expected.length) === expected) {
        return {
          success: true,
          value: expected,
          state: { input, index: index + expected.length }
        };
      } else {
        return {
          success: false,
          error: `Expected "${expected}"`,
          state
        };
      }
    }
  };
}
```

### Why This Approach is Powerful

**🎯 Composability**: Small parsers combine into larger ones naturally. A JSON parser is built from string, number, array, and object parsers.

**📖 Readability**: The code reads like a formal grammar. Compare:
```typescript
// Parser combinator approach
const jsonValue = choice([
  jsonString,
  jsonNumber,
  jsonArray,
  jsonObject,
  jsonBoolean,
  jsonNull
]);

// vs. manual parsing
function parseJsonValue(input, index) {
  if (input[index] === '"') return parseString(input, index);
  else if (input[index] === '[') return parseArray(input, index);
  else if (input[index] === '{') return parseObject(input, index);
  // ... lots more imperative code
}
```

**🔧 Modularity**: Each parser is independent and testable. You can build a library of reusable parsers.

**🛡️ Error Handling**: Sophisticated error reporting comes for free. The library tracks exactly where and why parsing failed.

**🎪 Flexibility**: Need to change the grammar? Just swap out or recombine parsers. No need to rewrite large chunks of imperative code.

### Core Concepts Deep Dive

**The `Parser<T>` Object**: Think of this as a "recipe card" that knows how to extract a value of type `T` from text. It's lazy - it only does work when you call `.parse()`.

**Backtracking**: When a parser fails, the input position automatically rewinds. This lets you try alternative approaches without manually managing state.

```typescript
const numberOrWord = choice([
  number,    // Try to parse a number first
  word       // If that fails, try a word
]);

// If parsing "hello" as a number fails, it automatically
// backtracks and tries parsing it as a word
```

**State Threading**: Each parser receives the current parsing state and returns a new state. This is how the library keeps track of position without you having to manage it.

**Transformation Pipeline**: Use `.map()` to transform results and `.chain()` for conditional parsing:

```typescript
const evenNumber = number
  .map(n => n * 2)                    // Transform the result
  .chain(n => 
    n % 2 === 0 
      ? succeed(n) 
      : fail(`${n} is not even`)      // Conditional logic
  );
```

<br />

## ⚠️ Common Gotchas & Troubleshooting

This section covers the most frequent issues you'll encounter and how to solve them.

### 🔄 Left Recursion Infinite Loops

**Problem**: Defining a grammar like `expr = expr + term` causes infinite recursion.

```typescript
// ❌ This will cause a stack overflow
const expr = choice([
  sequence([expr, str('+'), term]),  // expr refers to itself immediately
  term
]);
```

**Solution**: Use `leftRecursive` for left-associative expressions:

```typescript
// ✅ This works correctly
const expr = leftRecursive(() => choice([
  sequence([expr, str('+'), term], ([left, , right]) => left + right),
  term
]));
```

**Why it happens**: JavaScript evaluates `expr` immediately, creating an infinite loop before any parsing begins.

### 🐌 Performance Issues with Backtracking

**Problem**: Complex grammars with lots of backtracking can be slow, especially with repeated patterns.

```typescript
// ❌ This can be slow on large inputs
const inefficientParser = choice([
  sequence([word, str(','), word, str(','), word]),
  sequence([word, str(','), word]),
  word
]);
```

**Solution**: Use `memo()` for expensive parsers or restructure to reduce backtracking:

```typescript
// ✅ Memoized version
const memoizedWord = memo(word);
const efficientParser = sequence([
  memoizedWord,
  optional(sequence([str(','), memoizedWord])),
  optional(sequence([str(','), memoizedWord]))
]);
```

### 🔧 Confusing Error Messages

**Problem**: Default error messages are often unhelpful, especially in complex grammars.

```typescript
// ❌ Error: "Expected 'function' at line 1, column 5"
const fn = str('function');
```

**Solutions**: Use `label()` and `context()` to provide better errors:

```typescript
// ✅ Better error reporting
const fn = label(str('function'), 'function keyword');
const declaration = context(
  sequence([fn, identifier, str('(')]),
  'parsing function declaration'
);

// Now you get: "Expected function keyword at line 1, column 5 while parsing function declaration"
```

### 🧹 Whitespace Handling Confusion

**Problem**: Forgetting to handle whitespace leads to brittle parsers.

```typescript
// ❌ Breaks with extra spaces
const assignment = sequence([
  str('let'),
  identifier,
  str('='),
  number
]);

assignment.parse('let x = 42');    // ✅ Works
assignment.parse('let  x  =  42'); // ❌ Fails
```

**Solution**: Use `lexeme()` consistently:

```typescript
// ✅ Handles whitespace gracefully
const assignment = sequence([
  lexeme(str('let')),
  lexeme(identifier),
  lexeme(str('=')),
  number
]);
```

### 🎯 TypeScript Type Inference Issues

**Problem**: TypeScript can't infer complex parser types, leading to `any` types.

```typescript
// ❌ Results in Parser<any>
const complexParser = sequence([
  str('data'),
  choice([str('number'), str('string')]),
  str(':'),
  choice([number, stringLiteral])
]);
```

**Solution**: Use `as const` and explicit type annotations:

```typescript
// ✅ Properly typed
const complexParser = sequence([
  str('data'),
  choice([str('number'), str('string')]),
  str(':'),
  choice([number, stringLiteral])
] as const, (results) => {
  const [, type, , value] = results;
  return { type, value };
});
```

### 💾 Memory Issues with Large Inputs

**Problem**: Parsing very large files can cause memory issues due to string slicing.

**Solution**: Use streaming approaches or parse in chunks:

```typescript
// For large files, consider parsing line by line
const lineParser = sequence([
  regex(/[^\n]*/),  // Everything except newline
  str('\n')
]);

const manyLines = lineParser.many();
```

### 🔄 Recursive Parser Definition Order

**Problem**: Circular dependencies between parsers cause initialization issues.

```typescript
// ❌ ReferenceError: Cannot access 'expression' before initialization
const factor = choice([number, sequence([str('('), expression, str(')')])]);
const expression = choice([factor, sequence([factor, str('+'), expression])]);
```

**Solution**: Use `lazy()` to defer evaluation:

```typescript
// ✅ Works correctly
const factor = choice([
  number, 
  sequence([str('('), lazy(() => expression), str(')')])
]);

const expression = choice([
  factor, 
  sequence([factor, str('+'), lazy(() => expression)])
]);
```

### 🎪 Choice Order Matters

**Problem**: Parser order in `choice()` affects results due to left-to-right evaluation.

```typescript
// ❌ 'catch' will never be matched because 'cat' succeeds first
const keyword = choice([
  str('cat'),
  str('catch'),
  str('car')
]);
```

**Solution**: Order from most specific to least specific:

```typescript
// ✅ Correct order
const keyword = choice([
  str('catch'),  // More specific first
  str('cat'),
  str('car')
]);
```

### 🛟 Losing Type Safety

**Problem**: Your parsers return overly generic types like `string` or `any`, losing the precise type information that makes TypeScript useful.

**Common Causes**:

1. **`regex()` always returns `string`** - even when you know the exact pattern:
```typescript
// ❌ Returns Parser<string>, not Parser<'true' | 'false'>
const booleanRegex = regex(/true|false/);

// ✅ Better: use choice() for literal types
const booleanParser = choice([str('true'), str('false')]);
// Returns Parser<'true' | 'false'>
```

2. **Missing `as const` in `sequence()`**:
```typescript
// ❌ TypeScript can't infer the exact tuple type
const declaration = sequence([
  str('let'),
  identifier,
  str('='),
  number
]);
// Results in Parser<(string | number)[]> - not very useful!

// ✅ Use `as const` for precise tuple types
const declaration = sequence([
  str('let'),
  identifier, 
  str('='),
  number
] as const);
// Results in Parser<['let', string, '=', number]>
```

3. **Generic inference issues with transformations**:
```typescript
// ❌ TypeScript loses track of the types
const parser = sequence([str('count'), number], (results) => {
  // results is inferred as (string | number)[]
  return { type: 'count', value: results[1] }; // Type error!
});

// ✅ Use proper generic annotations
const parser = sequence(
  [str('count'), number] as const,
  ([keyword, value]: ['count', number]) => ({
    type: 'count' as const,
    value
  })
);
```

**Solutions**:

**For specific string patterns**, use `choice()` instead of `regex()`:
```typescript
// Instead of regex(/GET|POST|PUT|DELETE/)
const httpMethod = choice([
  str('GET'),
  str('POST'), 
  str('PUT'),
  str('DELETE')
]); // Parser<'GET' | 'POST' | 'PUT' | 'DELETE'>
```

**Use `as const` everywhere in `sequence()`**:
```typescript
// Always do this
const parser = sequence([a, b, c] as const, ([a, b, c]) => {
  // Now a, b, c have their precise types
});
```

**Explicitly type your transformation functions**:
```typescript
const assignment = sequence(
  [str('let'), identifier, str('='), number] as const,
  ([_let, name, _eq, value]: ['let', string, '=', number]) => ({
    type: 'assignment' as const,
    name,
    value
  })
);
// Results in Parser<{ type: 'assignment', name: string, value: number }>
```

**When to use the `into` parameter vs `.map()`**:
```typescript
// ✅ Use `into` parameter when transforming sequence results
const parser1 = sequence(
  [str('user'), str(':'), identifier] as const,
  ([, , name]) => ({ type: 'user', name })
);

// ✅ Use `.map()` for simpler transformations
const parser2 = number.map(n => n * 2);

// ✅ Use `.chain()` when the next parser depends on the result
const lengthPrefixed = number.chain(length =>
  regex(new RegExp(`.{${length}}`))
);
```

### 🔍 Debugging Parser Failures

When a parser fails, here's how to debug it:

1. **Use `console.log`** with intermediate parsers
2. **Add `label()` calls** to identify which part failed
3. **Test components in isolation** before combining
4. **Use the browser debugger** to step through parser execution

```typescript
// Debugging example
const debugParser = sequence([
  label(str('let'), 'let keyword'),
  label(lexeme(identifier), 'variable name'),
  label(str('='), 'equals sign'),
  label(number, 'number value')
]);

// Now failures will clearly indicate which part failed
```

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
