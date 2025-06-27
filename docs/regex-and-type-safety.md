# Regex and Type Safety

This comprehensive guide covers Combi-Parse's advanced regex functionality and type safety features, including the revolutionary type-level regex engine and various regex parsing functions.

## Overview of Regex Functions

Combi-Parse provides several regex-related functions for different use cases:

- **`regex()`** - Basic runtime regex parsing
- **`typedRegex()`** - Type-safe regex with basic type inference
- **`advancedTypedRegex()`** - Full type-level regex analysis (performance-sensitive)
- **`literalRegex()`** - Regex with literal type validation
- **Type-level regex engine** - Compile-time regex pattern analysis

## Basic Regex Parsing

### `regex(pattern: RegExp): Parser<string>`

The fundamental regex parser that uses JavaScript RegExp for pattern matching:

```typescript
import { regex } from 'combi-parse';

// Basic usage
const identifier = regex(/[a-zA-Z_][a-zA-Z0-9_]*/);
identifier.parse("myVariable"); // → "myVariable"

const number = regex(/[0-9]+(\.[0-9]+)?/);
number.parse("42.5"); // → "42.5"

// Email pattern
const email = regex(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
email.parse("user@example.com"); // → "user@example.com"
```

**When to use `regex()`:**
- Standard regex parsing needs
- Complex patterns that don't need compile-time analysis
- Performance-critical code where type safety is less important
- Working with existing RegExp objects

## Type-Safe Regex Parsing

### `typedRegex(pattern: string): Parser<string>`

A type-safe regex parser that validates patterns at compile time while providing basic type safety:

```typescript
import { typedRegex } from 'combi-parse';

// Type-safe pattern compilation
const hello = typedRegex('hello');
hello.parse('hello'); // Type: string (matches 'hello')

// Character classes with type safety
const digit = typedRegex('[0-9]');
digit.parse('5'); // Type: string (but validated at compile time)

// Alternation patterns
const greeting = typedRegex('hi|hello|hey');
greeting.parse('hi'); // Type: string (matches 'hi'|'hello'|'hey')

// Optional patterns
const color = typedRegex('colou?r');
color.parse('color'); // Type: string (matches 'color'|'colour')
```

**Advantages:**
- Compile-time pattern validation
- Better error messages for invalid patterns
- Type safety without performance overhead
- Compatible with all TypeScript environments

**When to use `typedRegex()`:**
- When you want compile-time pattern validation
- For patterns that should be type-safe but performance is critical
- In environments where advanced type analysis might be too slow

### `advancedTypedRegex(pattern: string): Parser<PreciseType>`

The most advanced regex parser that provides exact union types of all possible matching strings:

```typescript
import { advancedTypedRegex } from 'combi-parse';

// ✅ Simple patterns work well
const hello = advancedTypedRegex('hello');
hello.parse('hello'); // Type: 'hello'

const animal = advancedTypedRegex('cat|dog');
animal.parse('cat'); // Type: 'cat' | 'dog'

const digit = advancedTypedRegex('[0-9]');
digit.parse('5'); // Type: '0'|'1'|'2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'

const optional = advancedTypedRegex('colou?r');
optional.parse('color'); // Type: 'color' | 'colour'

// Escape sequences
const wordChar = advancedTypedRegex('\\w');
wordChar.parse('a'); // Type: 'a'|'b'|...|'z'|'A'|...|'Z'|'0'|...|'9'|'_'

// Infinite patterns use template literals
const oneOrMore = advancedTypedRegex('a+');
oneOrMore.parse('aaa'); // Type: `a${string}`

const zeroOrMore = advancedTypedRegex('a*b');
zeroOrMore.parse('aaab'); // Type: 'b' | `a${string}`
```

**⚠️ Performance Warning:**

Complex patterns can slow down or crash the TypeScript server:

```typescript
// ⚠️ These patterns may cause TypeScript server issues
const complex = advancedTypedRegex('(hello|hi)+ (world|earth)*');
const identifier = advancedTypedRegex('[a-zA-Z_][a-zA-Z0-9_]*');
const email = advancedTypedRegex('[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}');

// ✅ Use simple version for complex patterns
const complexSafe = typedRegex('(hello|hi)+ (world|earth)*');
const identifierSafe = typedRegex('[a-zA-Z_][a-zA-Z0-9_]*');
```

**Safe patterns for `advancedTypedRegex()`:**
- Simple literals: `'hello'`, `'abc'`
- Simple alternations: `'cat|dog'`, `'red|green|blue'`
- Single character classes: `'[0-9]'`, `'[abc]'`
- Simple quantifiers: `'a?'`, `'b+'` (on single characters)

**When to use `advancedTypedRegex()`:**
- When you need precise union types
- For simple, finite patterns
- In development environments where TypeScript performance is acceptable
- For domain-specific languages with limited vocabularies

## Literal Regex with Type Validation

### `literalRegex(regex: RegExp, literals: readonly T[]): Parser<T>`

Combines regex efficiency with literal type validation:

```typescript
import { literalRegex } from 'combi-parse';

// Boolean parsing with validation
const boolean = literalRegex(/true|false/, ['true', 'false'] as const);
boolean.parse('true'); // Type: 'true' | 'false'

// HTTP methods
const httpMethod = literalRegex(
  /GET|POST|PUT|DELETE|PATCH/,
  ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const
);
httpMethod.parse('GET'); // Type: 'GET'|'POST'|'PUT'|'DELETE'|'PATCH'

// CSS colors
const cssColor = literalRegex(
  /red|blue|green|yellow|black|white/,
  ['red', 'blue', 'green', 'yellow', 'black', 'white'] as const
);

// Programming language operators
const operator = literalRegex(
  /\+\+|--|[+\-*\/=<>!]=?|&&|\|\|/,
  ['++', '--', '+', '-', '*', '/', '=', '==', '!=', '<', '>', '<=', '>=', '&&', '||'] as const
);
```

**Advantages:**
- Regex performance for initial matching
- Type safety through literal validation
- Runtime validation that the match is in the expected set
- Works with complex regex patterns

**When to use `literalRegex()`:**
- When you have a finite set of valid values
- For parsing enums or keyword sets
- When regex performance is important but type safety is required
- For domain-specific languages with known vocabularies

## Type-Level Regex Engine

Combi-Parse includes a complete regex engine that operates entirely at the TypeScript type level:

### Supported Features

The type-level regex engine supports:

- **Literals**: `'abc'`, `'hello'`
- **Character Classes**: `'[abc]'`, `'[0-9]'`, `'[a-z]'`
- **Escape Sequences**: `'\\d'` (digits), `'\\w'` (word chars), `'\\s'` (whitespace)
- **Quantifiers**: `'*'` (zero or more), `'+'` (one or more), `'?'` (optional)
- **Alternation**: `'cat|dog'`
- **Grouping**: `'(ab)+c'`
- **Wildcards**: `'.'` (any printable character)

### Using the Type-Level Engine Directly

```typescript
import type { CompileRegex, Enumerate } from 'combi-parse';

// Compile patterns to NFAs (Non-deterministic Finite Automata)
type HelloRegex = CompileRegex<'hello'>;
type DigitRegex = CompileRegex<'[0-9]'>;
type ChoiceRegex = CompileRegex<'cat|dog'>;

// Enumerate all possible matching strings
type HelloStrings = Enumerate<HelloRegex>; // 'hello'
type DigitStrings = Enumerate<DigitRegex>; // '0'|'1'|'2'|...|'9'
type ChoiceStrings = Enumerate<ChoiceRegex>; // 'cat'|'dog'

// Complex patterns
type OptionalRegex = CompileRegex<'ab?c'>;
type OptionalStrings = Enumerate<OptionalRegex>; // 'ac'|'abc'

type RepeatingRegex = CompileRegex<'a+'>;
type RepeatingStrings = Enumerate<RepeatingRegex>; // `a${string}`

// Character classes with ranges
type HexRegex = CompileRegex<'[0-9a-fA-F]'>;
type HexStrings = Enumerate<HexRegex>; // '0'|'1'|...|'9'|'a'|...|'f'|'A'|...|'F'

// Grouping with quantifiers
type GroupRegex = CompileRegex<'(ab)+c'>;
type GroupStrings = Enumerate<GroupRegex>; // `ab${string}c`
```

### Type-Level Validation

Use the type system to validate patterns at compile time:

```typescript
// Valid patterns compile successfully
type ValidPattern = CompileRegex<'hello|world'>; // ✅

// Invalid patterns cause compile errors
type InvalidPattern = CompileRegex<'[unclosed'>; // ❌ Compile error

// Use in conditional types
type IsValidPattern<P extends string> = 
  CompileRegex<P> extends never ? false : true;

type Test1 = IsValidPattern<'hello'>; // true
type Test2 = IsValidPattern<'[invalid'>; // false
```

## Practical Type Safety Examples

### Building a Type-Safe Language Parser

```typescript
// Define language tokens with type safety
const keywords = advancedTypedRegex('if|else|while|for|return|function');
// Type: Parser<'if'|'else'|'while'|'for'|'return'|'function'>

const operators = literalRegex(
  /\+\+|--|[+\-*\/=<>!]=?|&&|\|\|/,
  ['++', '--', '+', '-', '*', '/', '=', '==', '!=', '<', '>', '<=', '>=', '&&', '||'] as const
);
// Type: Parser<'++' | '--' | '+' | '-' | ...>

const booleanLiteral = advancedTypedRegex('true|false');
// Type: Parser<'true'|'false'>

// Combine in a language parser
const token = choice([
  keywords.map(kw => ({ type: 'keyword', value: kw })),
  operators.map(op => ({ type: 'operator', value: op })),
  booleanLiteral.map(bool => ({ type: 'boolean', value: bool === 'true' })),
  regex(/[a-zA-Z_][a-zA-Z0-9_]*/).map(id => ({ type: 'identifier', value: id }))
]);
```

### Configuration File Parsing

```typescript
// Type-safe configuration parsing
const logLevel = advancedTypedRegex('debug|info|warn|error');
const environment = advancedTypedRegex('development|staging|production');
const protocol = advancedTypedRegex('http|https');

const configParser = genParser(function* () {
  yield str('log_level=');
  const logLevel = yield logLevel;
  yield str('\n');
  
  yield str('environment=');
  const env = yield environment;
  yield str('\n');
  
  yield str('protocol=');
  const protocol = yield protocol;
  
  return {
    logLevel, // Type: 'debug'|'info'|'warn'|'error'
    environment: env, // Type: 'development'|'staging'|'production'
    protocol // Type: 'http'|'https'
  };
});
```

### API Response Parsing

```typescript
// Type-safe HTTP response parsing
const httpStatus = advancedTypedRegex('200|201|400|401|403|404|500|502|503');
const contentType = literalRegex(
  /application\/json|text\/html|text\/plain|application\/xml/,
  ['application/json', 'text/html', 'text/plain', 'application/xml'] as const
);

const httpResponse = genParser(function* () {
  yield str('HTTP/1.1 ');
  const status = yield httpStatus;
  yield str('\r\n');
  
  yield str('Content-Type: ');
  const contentType = yield contentType;
  yield str('\r\n\r\n');
  
  const body = yield regex(/.*/);
  
  return {
    status, // Type: '200'|'201'|'400'|'401'|'403'|'404'|'500'|'502'|'503'
    contentType, // Type: 'application/json'|'text/html'|'text/plain'|'application/xml'
    body
  };
});
```

## Performance Guidelines

### Choosing the Right Regex Function

1. **Use `regex()`** when:
   - Working with complex patterns
   - Performance is critical
   - Type safety is not essential
   - Pattern is dynamic or not known at compile time

2. **Use `typedRegex()`** when:
   - You want compile-time pattern validation
   - Performance is important
   - Basic type safety is sufficient
   - Working in constrained TypeScript environments

3. **Use `advancedTypedRegex()`** when:
   - You need precise union types
   - Pattern is simple and finite
   - Development environment performance is acceptable
   - Type safety is critical

4. **Use `literalRegex()`** when:
   - You have a finite set of valid results
   - Need regex performance with type safety
   - Parsing enums or fixed vocabularies
   - Want runtime validation of expected values

### Pattern Complexity Guidelines

**Simple patterns** (safe for `advancedTypedRegex()`):
```typescript
// ✅ These compile quickly
'hello'
'cat|dog|bird'
'[0-9]'
'[abc]'
'a?'
'hello|world'
```

**Medium patterns** (use `typedRegex()`):
```typescript
// ⚠️ These may slow compilation
'[a-zA-Z]+'
'\\d{2,4}'
'(hello|hi) (world|earth)'
'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+'
```

**Complex patterns** (use `regex()`):
```typescript
// ❌ These can crash TypeScript server with advancedTypedRegex
'([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})'
'\\b(?:[0-9]{1,3}\\.){3}[0-9]{1,3}\\b'
'(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)'
```

## Advanced Type Techniques

### Pattern Validation at Compile Time

```typescript
// Create a type that validates regex patterns
type ValidatedRegex<P extends string> = 
  CompileRegex<P> extends never 
    ? { error: 'Invalid regex pattern' }
    : { pattern: P; compiled: CompileRegex<P> };

// Usage
type Valid = ValidatedRegex<'hello|world'>; // ✅ { pattern: ..., compiled: ... }
type Invalid = ValidatedRegex<'[unclosed'>; // ❌ { error: 'Invalid regex pattern' }
```

### Constrained String Types

```typescript
// Create types that only accept valid regex strings
type RegexPattern = string & { __brand: 'regex' };

const createTypedRegex = <P extends string>(
  pattern: P extends ValidatedRegex<P>['pattern'] ? P : never
): Parser<Enumerate<CompileRegex<P>>> => {
  return advancedTypedRegex(pattern);
};

// Usage - only valid patterns are accepted
const validParser = createTypedRegex('hello|world'); // ✅
// const invalidParser = createTypedRegex('[unclosed'); // ❌ Compile error
```

### Pattern Composition

```typescript
// Compose patterns at the type level
type Digit = '[0-9]';
type Letter = '[a-zA-Z]';
type Identifier = `${Letter}(${Letter}|${Digit})*`;

// Use composed patterns
const identifierParser = typedRegex('' as Identifier);
```

## Error Handling and Debugging

### Type-Level Error Messages

```typescript
// The type system provides helpful error messages
const invalidParser = advancedTypedRegex('['); 
// Error: Type '[' is not a valid regex pattern

// Use type assertions for debugging
type DebugPattern = CompileRegex<'[0-9]+'>;
// Hover in IDE to see the compiled NFA structure
```

### Runtime Error Handling

```typescript
const safeRegexParser = <P extends string>(pattern: P) => {
  try {
    return typedRegex(pattern);
  } catch (error) {
    console.error(`Invalid regex pattern: ${pattern}`, error);
    return fail(`Invalid regex: ${pattern}`);
  }
};
```

### Debugging Type Issues

```typescript
// Use helper types to debug complex patterns
type DebugEnumeration<P extends string> = {
  pattern: P;
  compiled: CompileRegex<P>;
  enumerated: Enumerate<CompileRegex<P>>;
};

// Example
type Debug = DebugEnumeration<'[0-9]+'>;
// Hover in IDE to see: { pattern: '[0-9]+', compiled: ..., enumerated: `0${string}` | `1${string}` | ... }
```

This comprehensive regex and type safety system makes Combi-Parse uniquely powerful for building type-safe parsers while providing flexibility for different performance and complexity requirements.
