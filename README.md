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

### How Parser Combinators Work: Building Intuition Through Examples

The magic of parser combinators isn't abstract—it's a concrete, systematic approach to building parsers. Instead of writing complex parsing logic from scratch, you build sophisticated parsers by combining simple, reusable pieces. Let's see exactly how this works through practical examples.

##### 1. 🧱 Atomic Parsers: The Building Blocks

**Atomic parsers** are the foundation—simple parsers that recognize basic patterns. Think of them as LEGO blocks: individually simple, but powerful when combined.

##### Simple String Matching

```typescript
import { str } from '@doeixd/combi-parse';

// An atomic parser that matches the exact string "hello"
const helloParser = str('hello');
// 🎯 Type safety gained: Parser<'hello'> - TypeScript knows the exact string

// Let's see what happens when we use it
console.log(helloParser.parse('hello world'));
// Output: 'hello'

console.log(helloParser.parse('hi there'));
// Throws: ParseError: Expected "hello" at line 1, column 1
```

**What's happening here?**
- `str('hello')` creates a parser that *only* succeeds if the input starts with "hello"
- When successful, it returns the matched string and advances the position
- When it fails, it throws a detailed error with the exact location

##### Pattern Matching with Regex

```typescript
import { regex } from '@doeixd/combi-parse';

// An atomic parser that matches one or more digits
const digitSequence = regex(/\d+/);
// ⚠️ Type safety lost: Parser<string> - regex always returns generic string

console.log(digitSequence.parse('123abc'));
// Output: '123'

console.log(digitSequence.parse('abc123'));
// Throws: ParseError: Expected pattern /\d+/ at line 1, column 1
```

##### Character Classes

```typescript
import { charClass } from '@doeixd/combi-parse';

// An atomic parser that matches any single digit
const singleDigit = charClass('Digit');
// 🎯 Type safety gained: Parser<'0'|'1'|'2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'>

console.log(singleDigit.parse('7'));
// Output: '7' (with type '0'|'1'|'2'|'3'|'4'|'5'|'6'|'7'|'8'|'9')

// An atomic parser that matches any whitespace character
const whitespaceChar = charClass('Whitespace');

console.log(whitespaceChar.parse(' '));
// Output: ' '
```

**Key Insight**: Each atomic parser has **one job**—recognizing a specific pattern. They're predictable, testable, and composable.

##### 2. 🔧 Combinator Functions: The Assembly Instructions

**Combinator functions** take simple parsers and combine them into more sophisticated ones. They're like assembly instructions that tell you how to connect your LEGO blocks.

##### Sequential Combination with `sequence`

```typescript
import { str, regex, sequence } from '@doeixd/combi-parse';

// Combine atomic parsers in sequence
const greeting = sequence([
  str('Hello'),
  str(' '),
  regex(/[A-Z][a-z]+/)  // Capitalized name
] as const);
// 🎯 Type safety gained: `as const` preserves exact tuple type

console.log(greeting.parse('Hello Alice'));
// Output: ['Hello', ' ', 'Alice']

// Transform the result into something more useful
const greetingWithTransform = sequence([
  str('Hello'),
  str(' '),
  regex(/[A-Z][a-z]+/)
] as const, ([greeting, space, name]) => ({ greeting, name }));

console.log(greetingWithTransform.parse('Hello Bob'));
// Output: { greeting: 'Hello', name: 'Bob' }
```

##### Alternative Choices with `choice`

```typescript
import { str, choice } from '@doeixd/combi-parse';

// Try multiple alternatives in order
const politeness = choice([
  str('please'),
  str('thank you'),
  str('sorry')
]);

console.log(politeness.parse('please help'));
// Output: 'please'

console.log(politeness.parse('thank you very much'));
// Output: 'thank you'

console.log(politeness.parse('hello'));
// Throws: ParseError (none of the alternatives matched)
```

##### Repetition with `.many()`

```typescript
import { charClass } from '@doeixd/combi-parse';

// Match zero or more digits
const digits = charClass('Digit').many();

console.log(digits.parse('12345abc'));
// Output: ['1', '2', '3', '4', '5']

console.log(digits.parse('abc'));
// Output: [] (zero digits is still valid)

// Match one or more digits
const atLeastOneDigit = charClass('Digit').many1();

console.log(atLeastOneDigit.parse('42'));
// Output: ['4', '2']

console.log(atLeastOneDigit.parse('abc'));
// Throws: ParseError (needs at least one digit)
```

##### Complex Combinations

```typescript
import { str, charClass, sequence, choice, between } from '@doeixd/combi-parse';

// Parse a simple email address
const emailParser = sequence([
  charClass('CIdentifierPart').many1(),  // username
  str('@'),
  charClass('CIdentifierPart').many1(),  // domain name
  str('.'),
  choice([str('com'), str('org'), str('net')])  // TLD
] as const, ([username, at, domain, dot, tld]) => ({
  username: username.join(''),
  domain: domain.join(''),
  tld
}));

console.log(emailParser.parse('john@example.com'));
// Output: { username: 'john', domain: 'example', tld: 'com' }
```

**Key Insight**: Combinators don't just stick parsers together—they define **how** to combine them (sequentially, as alternatives, with repetition, etc.).

##### 3. ⚡ Pure Functions: Predictable Input → Output

**Every parser is a pure function**—given the same input, it always produces the same result. No hidden state, no side effects, no surprises.

##### Understanding Parser State

```typescript
// Conceptually, every parser is a function like this:
type Parser<T> = (state: ParserState) => ParseResult<T>;

interface ParserState {
  input: string;
  index: number;  // Current position in the input
}

type ParseResult<T> = 
  | { success: true; value: T; newState: ParserState }
  | { success: false; error: string; state: ParserState };
```

##### Seeing State in Action

```typescript
import { str } from '@doeixd/combi-parse';

// Let's trace through what happens internally
const parser = str('hi');

// Initial state: { input: "hi there", index: 0 }
// Parser checks: input.substring(0, 2) === "hi" ✓
// Returns: { success: true, value: "hi", newState: { input: "hi there", index: 2 } }

console.log(parser.parse('hi there'));
// Output: 'hi'

// If we had more parsing to do, the next parser would start at index 2
```

##### Predictable Behavior

```typescript
import { charClass } from '@doeixd/combi-parse';

const digitParser = charClass('Digit');

// These calls are completely independent
console.log(digitParser.parse('7'));  // Always returns '7'
console.log(digitParser.parse('3'));  // Always returns '3'
console.log(digitParser.parse('7'));  // Still returns '7'

// No hidden state means no surprises!
```

##### Transformation with `.map()`

```typescript
import { regex } from '@doeixd/combi-parse';

// Pure transformation: string → number
const numberParser = regex(/\d+/).map(str => parseInt(str, 10));
// 🎯 Type safety transformed: Parser<string> becomes Parser<number>

console.log(numberParser.parse('42'));
// Output: 42 (number, not string)

// The original parser is unchanged
const stringParser = regex(/\d+/);
console.log(stringParser.parse('42'));
// Output: '42' (still a string)
```

**Key Insight**: Pure functions make parsers **predictable** and **composable**. You can reason about them in isolation and combine them fearlessly.

##### 4. 🔄 Automatic Plumbing: State, Backtracking, and Error Handling

**The combinator library handles all the messy details** so you don't have to. It automatically manages position tracking, tries alternatives when parsing fails, and provides helpful error messages.

##### Automatic State Threading

```typescript
import { str, sequence } from '@doeixd/combi-parse';

// You write this simple combination
const greeting = sequence([
  str('Hello'),
  str(' '),
  str('World')
] as const);

// But the library automatically handles:
// 1. Parse "Hello" starting at position 0
// 2. If successful, parse " " starting at position 5
// 3. If successful, parse "World" starting at position 6
// 4. Collect all results into an array

console.log(greeting.parse('Hello World'));
// Output: ['Hello', ' ', 'World']
```

##### Automatic Backtracking

```typescript
import { str, choice } from '@doeixd/combi-parse';

const keyword = choice([
  str('function'),
  str('fun'),
  str('func')
]);

// When parsing "function":
// 1. Try str('function') at position 0 → SUCCESS ✓
// 2. Return 'function', don't try other alternatives

// When parsing "fun":  
// 1. Try str('function') at position 0 → FAIL (no match)
// 2. Backtrack to position 0
// 3. Try str('fun') at position 0 → SUCCESS ✓
// 4. Return 'fun'

console.log(keyword.parse('function'));  // Output: 'function'
console.log(keyword.parse('fun'));       // Output: 'fun'
```

##### Automatic Error Collection

```typescript
import { str, sequence, choice } from '@doeixd/combi-parse';

const problematicParser = sequence([
  str('let'),
  str(' '),
  choice([
    str('x'),
    str('y'),
    str('z')
  ]),
  str(' = '),
  str('42')
] as const);

try {
  problematicParser.parse('let a = 42');
} catch (error) {
  console.log(error.message);
  // Output: Expected "x", "y", or "z" at line 1, column 5
  //         The library figured out exactly where and what failed!
}
```

##### Smart Error Messages with Context

```typescript
import { str, sequence, label, context } from '@doeixd/combi-parse';

const betterParser = context(
  sequence([
    label(str('let'), 'let keyword'),
    str(' '),
    label(choice([str('x'), str('y'), str('z')]), 'variable name'),
    str(' = '),
    label(str('42'), 'value')
  ] as const),
  'parsing variable declaration'
);

try {
  betterParser.parse('let a = 42');
} catch (error) {
  console.log(error.message);
  // Output: Expected variable name at line 1, column 5 while parsing variable declaration
  //         Much more helpful!
}
```

##### Handling Left Recursion Automatically

```typescript
import { str, choice, sequence, leftRecursive, lexeme } from '@doeixd/combi-parse';

// This would cause infinite recursion if we tried it naively
const expression = leftRecursive(() =>
  choice([
    // Recursive case: expr + expr
    sequence([expression, lexeme(str('+')), expression] as const,
      ([left, op, right]) => ({ type: 'add', left, right })),
    
    // Base case: just a number
    lexeme(regex(/\d+/)).map(n => ({ type: 'number', value: parseInt(n) }))
  ])
);

console.log(expression.parse('1 + 2 + 3'));
// Output: Complex AST representing ((1 + 2) + 3)
// The library handled the left-recursion automatically!
```

**Key Insight**: The combinator library is like having an **expert assistant**—it handles all the tedious, error-prone work while you focus on describing **what** you want to parse, not **how** to manage the parsing process.

##### 🎯 Putting It All Together: A Complete Example

Let's see all four concepts work together in a real parser:

```typescript
import { 
  str, regex, sequence, choice, between, many, lexeme,
  charClass, label, context 
} from '@doeixd/combi-parse';

// 1. ATOMIC PARSERS: Building blocks
const number = regex(/\d+/).map(n => parseInt(n, 10));
const identifier = regex(/[a-zA-Z_][a-zA-Z0-9_]*/);
const stringLiteral = between(str('"'), regex(/[^"]*/), str('"'));

// 2. COMBINATORS: Assembly instructions  
const value = choice([
  number,
  stringLiteral,
  identifier
]);

const assignment = sequence([
  lexeme(str('let')),
  lexeme(identifier),
  lexeme(str('=')),
  value,
  str(';')
] as const, ([, name, , val]) => ({ type: 'assignment', name, value: val }));

// 3. PURE FUNCTIONS: Predictable behavior
const program = many(lexeme(assignment));

// 4. AUTOMATIC PLUMBING: The library handles everything else
const result = program.parse(`
  let name = "Alice";
  let age = 25;
  let active = true;
`);

console.log(result);
// Output: [
//   { type: 'assignment', name: 'name', value: 'Alice' },
//   { type: 'assignment', name: 'age', value: 25 },
//   { type: 'assignment', name: 'active', value: 'true' }
// ]
```

**What just happened?**
1. **Atomic parsers** recognized individual tokens (numbers, strings, identifiers)
2. **Combinators** assembled them into larger structures (assignments, programs)
3. **Pure functions** made each step predictable and testable
4. **Automatic plumbing** handled whitespace, position tracking, and error reporting

You described **what** the language looks like, and the library figured out **how** to parse it. That's the magic of parser combinators!

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

# Robust Error Handling & Advanced Parsing Techniques

Building production-ready parsers requires more than just recognizing valid input—you need to handle invalid input gracefully, provide helpful error messages, and parse complex constructs like operator precedence correctly. This guide covers advanced techniques for building robust, user-friendly parsers.

## 🔄 Understanding Backtracking

Backtracking is the foundation of how parser combinators handle failures. Understanding it is crucial for writing efficient, predictable parsers.

### How Backtracking Works

When a parser fails, the input position automatically "rewinds" to where it started:

```typescript
const parser = choice([
  str('function'),  // Tries to match 'function'
  str('fun')        // If that fails, tries 'fun' from the same position
]);

// Input: "funky"
// 1. str('function') fails at position 0 (no match)
// 2. Position rewinds to 0
// 3. str('fun') succeeds, consuming 3 characters
// 4. Result: 'fun', position now at 3
```

### The Committed Choice Problem

Once a parser consumes input, other alternatives in `choice()` won't be tried:

```typescript
const problematicParser = choice([
  sequence([str('fun'), str('ction')]),  // This will consume 'fun'
  str('function')                        // This will never be tried
]);

// Input: "function"
// 1. First alternative matches 'fun', then fails on 'ction'
// 2. Since input was consumed, choice() doesn't try the second alternative
// 3. Parser fails with "Expected 'ction'" instead of succeeding
```

**Solution**: Order alternatives from most specific to least specific:

```typescript
const fixedParser = choice([
  str('function'),   // More specific first
  str('fun')         // Less specific second
]);
```

### Controlling Backtracking with `lookahead`

Sometimes you want to check what's ahead without consuming input:

```typescript
const conditionalParser = sequence([
  str('if'),
  lookahead(str('(')),  // Check for '(' but don't consume it
  expression,
  str('then'),
  statement
]);

// This ensures we only parse 'if' statements that have parentheses
// but lets the expression parser handle the actual parentheses
```

## 🛡️ Error Handling Strategies

### 1. Basic Error Labeling

Replace cryptic default errors with meaningful messages:

```typescript
// ❌ Unhelpful error: "Expected 'function' at line 1, column 1"
const fn = str('function');

// ✅ Clear error: "Expected function declaration at line 1, column 1"
const fn = label(str('function'), 'function declaration');
```

### 2. Error Context Stack

Build error "stack traces" to show parsing context:

```typescript
const functionDeclaration = context(
  sequence([
    label(str('function'), 'function keyword'),
    label(identifier, 'function name'),
    label(str('('), 'opening parenthesis'),
    parameterList,
    label(str(')'), 'closing parenthesis'),
    functionBody
  ] as const),
  'parsing function declaration'
);

// Error: "Expected closing parenthesis at line 2, column 15 while parsing function declaration"
```

### 3. Custom Error Types

Create domain-specific error information:

```typescript
interface ParseError {
  message: string;
  line: number;
  column: number;
  context: string[];
  suggestions?: string[];
}

const smartIdentifier = identifier.chain(name => {
  const keywords = ['function', 'if', 'while', 'for'];
  if (keywords.includes(name)) {
    return fail(`'${name}' is a reserved keyword. Try a different name.`);
  }
  return succeed(name);
});
```

### 4. Error Recovery Strategies

Instead of stopping at the first error, try to continue parsing:

```typescript
const robustStatementList = sequence([
  statement,
  many(choice([
    sequence([str(';'), statement]),
    // Recovery: skip to next semicolon and try again
    recoverTo(str(';')).chain(() => 
      context(statement, 'recovering from syntax error')
    )
  ]))
]);

function recoverTo<T>(delimiter: Parser<T>): Parser<null> {
  return regex(/[^;]*/).chain(() => delimiter).map(() => null);
}
```

## 🔢 Operator Precedence Parsing

Parsing expressions with proper operator precedence is a common challenge. Here are several approaches:

### 1. Precedence Climbing Algorithm

Build expressions bottom-up, handling precedence levels:

```typescript
// Define operators with precedence and associativity
const operators = {
  '+': { precedence: 1, associativity: 'left' },
  '-': { precedence: 1, associativity: 'left' },
  '*': { precedence: 2, associativity: 'left' },
  '/': { precedence: 2, associativity: 'left' },
  '**': { precedence: 3, associativity: 'right' }
};

function buildExpressionParser() {
  const factor = choice([
    number,
    between(str('('), () => expression, str(')'))
  ]);

  const expression = precedenceClimb(factor, operators);
  
  return expression;
}

function precedenceClimb(
  atom: Parser<Expr>, 
  ops: OperatorTable
): Parser<Expr> {
  return atom.chain(left => 
    parseRightOperands(left, 0, ops)
  );
}

function parseRightOperands(
  left: Expr, 
  minPrec: number, 
  ops: OperatorTable
): Parser<Expr> {
  return choice([
    // Try to parse an operator with sufficient precedence
    choice(Object.entries(ops).map(([op, info]) => {
      if (info.precedence < minPrec) return fail('precedence too low');
      
      return sequence([
        lexeme(str(op)),
        precedenceClimb(atom, ops)  // Parse right operand
      ] as const).chain(([operator, right]) => {
        const newLeft = { type: 'binary', left, operator, right };
        const nextMinPrec = info.associativity === 'left' 
          ? info.precedence + 1 
          : info.precedence;
        return parseRightOperands(newLeft, nextMinPrec, ops);
      });
    })),
    // No more operators, return current left
    succeed(left)
  ]);
}
```

### 2. Layered Expression Parsing

Build precedence as separate parser layers:

```typescript
const expressionParser = () => {
  // Lowest precedence: addition/subtraction
  const additive = leftRecursive(() => choice([
    sequence([additive, lexeme(str('+')), multiplicative] as const,
      ([left, , right]) => ({ type: 'add', left, right })),
    sequence([additive, lexeme(str('-')), multiplicative] as const,
      ([left, , right]) => ({ type: 'sub', left, right })),
    multiplicative
  ]));

  // Higher precedence: multiplication/division
  const multiplicative = leftRecursive(() => choice([
    sequence([multiplicative, lexeme(str('*')), exponential] as const,
      ([left, , right]) => ({ type: 'mul', left, right })),
    sequence([multiplicative, lexeme(str('/')), exponential] as const,
      ([left, , right]) => ({ type: 'div', left, right })),
    exponential
  ]));

  // Highest precedence: exponentiation (right-associative)
  const exponential = choice([
    sequence([primary, lexeme(str('**')), exponential] as const,
      ([left, , right]) => ({ type: 'pow', left, right })),
    primary
  ]);

  // Primary expressions: numbers, parentheses, etc.
  const primary = choice([
    number.map(n => ({ type: 'number', value: n })),
    between(lexeme(str('(')), additive, lexeme(str(')'))),
    identifier.map(name => ({ type: 'variable', name }))
  ]);

  return additive;
};
```

### 3. Pratt Parser Implementation

A more flexible approach using Pratt parsing:

```typescript
type PrefixParselet = () => Parser<Expr>;
type InfixParselet = (left: Expr, precedence: number) => Parser<Expr>;

class PrattParser {
  private prefixParselets = new Map<string, PrefixParselet>();
  private infixParselets = new Map<string, InfixParselet>();

  register(token: string, prefix?: PrefixParselet, infix?: InfixParselet) {
    if (prefix) this.prefixParselets.set(token, prefix);
    if (infix) this.infixParselets.set(token, infix);
  }

  parseExpression(precedence = 0): Parser<Expr> {
    return this.parsePrefix().chain(left => 
      this.parseInfix(left, precedence)
    );
  }

  private parsePrefix(): Parser<Expr> {
    return choice([
      // Try each registered prefix parser
      ...Array.from(this.prefixParselets.entries()).map(([token, parselet]) =>
        str(token).chain(() => parselet())
      ),
      // Default: numbers and identifiers
      number.map(n => ({ type: 'number', value: n })),
      identifier.map(name => ({ type: 'variable', name }))
    ]);
  }

  private parseInfix(left: Expr, precedence: number): Parser<Expr> {
    return choice([
      // Try each infix operator with sufficient precedence
      ...Array.from(this.infixParselets.entries())
        .filter(([token, _]) => this.getPrecedence(token) >= precedence)
        .map(([token, parselet]) =>
          str(token).chain(() => parselet(left, precedence))
        ),
      // No more operators
      succeed(left)
    ]);
  }
}

// Usage
const parser = new PrattParser();
parser.register('+', undefined, (left, prec) => 
  parser.parseExpression(prec + 1).map(right => ({ type: 'add', left, right }))
);
```

## 📋 Syntax Error Reporting

### Building Helpful Error Messages

Good error messages should:
1. **Pinpoint the exact location** of the error
2. **Explain what was expected** vs what was found
3. **Suggest possible fixes** when appropriate
4. **Provide context** about what the parser was trying to do

```typescript
interface DetailedError {
  message: string;
  location: { line: number; column: number; index: number };
  expected: string[];
  found: string;
  context: string[];
  suggestions: string[];
  snippet: string;  // Source code around the error
}

function createDetailedError(
  message: string,
  state: ParserState,
  expected: string[] = [],
  suggestions: string[] = []
): DetailedError {
  const location = getLocationInfo(state);
  const snippet = getSourceSnippet(state, 2); // 2 lines of context
  
  return {
    message,
    location,
    expected,
    found: getCurrentChar(state),
    context: getParsingContext(state),
    suggestions,
    snippet
  };
}

function formatError(error: DetailedError): string {
  const { message, location, snippet, suggestions } = error;
  
  let output = `Error at line ${location.line}, column ${location.column}:\n`;
  output += `${message}\n\n`;
  
  // Show source snippet with error highlighted
  output += snippet + '\n';
  output += ' '.repeat(location.column - 1) + '^\n';
  
  if (suggestions.length > 0) {
    output += '\nDid you mean:\n';
    suggestions.forEach(s => output += `  - ${s}\n`);
  }
  
  return output;
}
```

### Smart Error Recovery

Continue parsing after errors to find multiple issues:

```typescript
const robustParser = many(choice([
  // Try to parse a valid statement
  context(statement, 'parsing statement'),
  
  // If that fails, try to recover
  recoverFromError().chain(() => 
    // Log the error but continue
    succeed({ type: 'error', message: 'Syntax error encountered' })
  )
]));

function recoverFromError(): Parser<null> {
  return choice([
    // Skip to next statement delimiter
    regex(/[^;\n}]*[;\n}]/).map(() => null),
    
    // Skip to next line if no delimiter found
    regex(/[^\n]*\n/).map(() => null),
    
    // Give up if at end of input
    eof.map(() => null)
  ]);
}
```

## 🚨 Avoiding Parser Panics

### 1. Validate Input Early

Check for common issues before parsing:

```typescript
function safeParseCode(input: string): ParseResult<AST> {
  // Pre-validation checks
  if (!input.trim()) {
    return { success: false, error: 'Empty input' };
  }
  
  if (input.length > 1000000) {
    return { success: false, error: 'Input too large (max 1MB)' };
  }
  
  // Check for balanced parentheses/brackets
  if (!isBalanced(input)) {
    return { success: false, error: 'Unbalanced parentheses or brackets' };
  }
  
  try {
    return parser.parse(input);
  } catch (error) {
    return { 
      success: false, 
      error: `Parse error: ${error.message}` 
    };
  }
}

function isBalanced(input: string): boolean {
  const stack: string[] = [];
  const pairs = { '(': ')', '[': ']', '{': '}' };
  
  for (const char of input) {
    if (char in pairs) {
      stack.push(char);
    } else if (Object.values(pairs).includes(char)) {
      const last = stack.pop();
      if (!last || pairs[last] !== char) return false;
    }
  }
  
  return stack.length === 0;
}
```

### 2. Timeout Protection

Prevent infinite loops in complex grammars:

```typescript
function parseWithTimeout<T>(
  parser: Parser<T>, 
  input: string, 
  timeoutMs = 5000
): Promise<ParseResult<T>> {
  return Promise.race([
    Promise.resolve(parser.parse(input)),
    
    new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Parse timeout')), timeoutMs)
    )
  ]);
}
```

### 3. Memory Management

Prevent memory leaks with large inputs:

```typescript
const memoizedParser = memo(expensiveParser);

// Clear memoization cache periodically
function clearParserCache() {
  // Implementation depends on your memo implementation
  memoizedParser.clearCache();
}

// For streaming large files
function parseStream(stream: ReadableStream): AsyncGenerator<AST> {
  const buffer = '';
  const reader = stream.getReader();
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += value;
      
      // Parse complete statements as they arrive
      const results = extractCompleteStatements(buffer);
      for (const statement of results) {
        yield parser.parse(statement);
      }
    }
  } finally {
    reader.releaseLock();
  }
}
```

## 🎯 Best Practices Summary

### Error Handling Checklist

- ✅ **Use `label()` for all user-facing parsers** to provide meaningful error messages
- ✅ **Add `context()` around complex parsing operations** to build error stack traces  
- ✅ **Order `choice()` alternatives from specific to general** to avoid backtracking issues
- ✅ **Implement error recovery** for interactive applications (IDEs, REPLs)
- ✅ **Validate input early** to catch common issues before parsing
- ✅ **Use timeouts** for complex grammars that might hang
- ✅ **Provide suggestions** in error messages when possible

### Performance Considerations

- ✅ **Use `memo()` for expensive recursive parsers** to avoid redundant work
- ✅ **Minimize backtracking** by structuring grammars carefully
- ✅ **Use `lookahead()` sparingly** as it can impact performance
- ✅ **Consider streaming** for very large inputs
- ✅ **Profile your parsers** to identify bottlenecks

### Operator Precedence Tips

- ✅ **Choose the right technique** for your complexity level:
  - Simple: Layered parsing
  - Medium: Precedence climbing  
  - Complex: Pratt parsing
- ✅ **Test edge cases** like right-associative operators
- ✅ **Handle unary operators** explicitly
- ✅ **Consider operator overloading** in your language design

With these techniques, you can build parsers that gracefully handle errors, provide helpful feedback to users, and correctly parse complex language constructs. The key is to think about failure cases early and design your grammar to be both expressive and robust.

<br />

## 🔤 Type-Safe Character Classes

One of the most powerful features of Combi-Parse is its **type-safe character parsing system**. Instead of using error-prone string matching or losing type information with generic parsers, you get precise, compile-time guarantees about exactly which characters your parsers will match.

```typescript
import { charClass } from '@doeixd/combi-parse';

// ✅ Perfect type safety with named character classes
const digitParser = charClass('Digit');
// Type: Parser<'0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'>

const result = digitParser.parse('7');
// result has type '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
// TypeScript knows exactly which characters are possible!

// ✅ Custom character sets are also type-safe
const boolParser = charClass('yn');
// Type: Parser<'y' | 'n'>

// ✅ IntelliSense shows all available character classes
const hexParser = charClass('HexDigit');   // Includes 0-9, a-f, A-F
const letterParser = charClass('Alpha');   // All ASCII letters
const unicodeParser = charClass('Hiragana'); // Japanese characters
```

**Why this matters:**
- 🛡️ **Catch bugs at compile time** - TypeScript knows exactly which characters are valid
- 🧠 **Intelligent IntelliSense** - Your editor suggests valid character comparisons
- 🔗 **Perfect composition** - Character types flow through your entire parser chain
- 📚 **Comprehensive coverage** - Over 50 pre-defined character classes from ASCII to Unicode

**Character classes available include:**
- **Basic**: `Digit`, `Alpha`, `Whitespace`, `Punctuation`
- **Specific**: `HexDigit`, `CIdentifierStart`, `Base64Char`
- **Unicode**: `Hiragana`, `Cyrillic`, `Arabic`, `CjkUnifiedIdeographs`
- **Symbols**: `CurrencySymbols`, `MathematicalOperators`, `Arrows`

👉 **[Read the complete Character Classes guide →](docs/character-classes.md)**

This guide covers the type safety benefits, how the system works under the hood, migration from `anyOf`, Unicode handling, and advanced usage patterns.

<br />

## 📜 License

This project is licensed under the **MIT License**. See the LICENSE file for details.

<br />

## Contributing
Contributions are welcome! Please make a PR
