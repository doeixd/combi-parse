# Type-Safe Character Parsing with `charClass`

The `charClass` function represents a major leap forward in type-safe parsing, bridging the gap between runtime efficiency and compile-time type safety. This guide explains how it works, why it matters, and how it transforms character parsing from error-prone string manipulation into bulletproof, type-checked operations.

## 🎯 The Problem: Character Parsing Without Type Safety

Traditional character parsing approaches suffer from several issues:

### Approach 1: Raw String Methods (Brittle)
```typescript
// ❌ No type safety, error-prone
function parseDigit(input: string, index: number): string | null {
  const char = input[index];
  if ('0123456789'.includes(char)) {
    return char; // Type is just 'string' - we lost precision
  }
  return null;
}

const result = parseDigit("7abc", 0); // result: string | null
// We know it should be "0"|"1"|...|"9", but TypeScript doesn't
```

### Approach 2: Simple `anyOf` (Better, but Still Limited)
```typescript
// ❌ Runtime works, but type information is lost
const digitParser = anyOf('0123456789'); // Parser<string>
const result = digitParser.parse('7'); // Type is just 'string'

// We can't distinguish between different character classes
const letterParser = anyOf('abcdefghijklmnopqrstuvwxyz'); // Also Parser<string>
const hexParser = anyOf('0123456789abcdef'); // Also Parser<string>
```

### Approach 3: Manual Union Types (Verbose and Error-Prone)
```typescript
// ❌ Tedious to write and maintain
type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
type HexDigit = Digit | 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

// Error-prone - easy to miss characters or make typos
const digitChars = '0123456789'; // Must keep in sync with type
const digitParser = anyOf(digitChars) as Parser<Digit>; // Unsafe cast
```

## ✨ The Solution: Generated Character Classes + Type-Safe `charClass`

The `charClass` function solves these problems by combining:
1. **Auto-generated comprehensive character class types**
2. **Runtime-to-compile-time type mapping**
3. **Intelligent function overloading**

## 🏗️ The Generated Module: `master-char-classes.ts`

The character class generation script creates a comprehensive TypeScript module that serves as the foundation for type-safe character parsing.

### What Gets Generated

The script produces three key artifacts:

#### 1. **Precise Character Class Types**
```typescript
// Generated types with exact character unions
export type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
export type HexDigit = Digit | 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
export type Lower = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j' | 'k' | 'l' | 'm' | 'n' | 'o' | 'p' | 'q' | 'r' | 's' | 't' | 'u' | 'v' | 'w' | 'x' | 'y' | 'z';

// For large character sets, fallback to conceptual types
export type CjkUnifiedIdeographs = string; // Too many characters for union type
export type Emoji = string; // Use with Unicode property escapes
```

#### 2. **Type Mapping Infrastructure**
```typescript
// Union of all available character class names
export type CharClassName = 'Digit' | 'HexDigit' | 'Lower' | 'Upper' | 'Alpha' | 'Whitespace' | /* ... hundreds more */;

// Maps class names to their corresponding types
export interface CharClassTypeMap {
  Digit: Digit;
  HexDigit: HexDigit;
  Lower: Lower;
  Upper: Upper;
  // ... etc
}
```

#### 3. **Runtime Character Strings**
```typescript
// Runtime strings that correspond exactly to the compile-time types
export const CHAR_CLASS_STRINGS: { [K in CharClassName]: string } = {
  Digit: '0123456789',
  HexDigit: '0123456789abcdefABCDEF',
  Lower: 'abcdefghijklmnopqrstuvwxyz',
  Upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  // ... etc
};
```

### Why This Approach Is Powerful

This generated module creates a **perfect bridge between compile-time types and runtime values**:

- **Compile-time**: TypeScript knows exactly which characters are valid
- **Runtime**: The parser has the actual character strings to match against
- **Consistency**: The types and strings are generated from the same source, eliminating sync issues

## 🔧 How `charClass` Works: The Type Safety Magic

The `charClass` function uses TypeScript's powerful overloading and generic inference to provide two distinct modes:

### Mode 1: Named Character Classes (Recommended)

```typescript
// ✅ Perfect type safety with named classes
const digitParser = charClass('Digit');
// Type: Parser<'0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'>

const result = digitParser.parse('7');
// Type: '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
// Value: '7'

// TypeScript knows exactly what characters are possible!
if (result === '7') {
  console.log('Lucky seven!'); // Type-safe comparison
}
```

**How it works internally:**
1. `charClass('Digit')` matches the first overload: `charClass<N extends CharClassName>(name: N)`
2. TypeScript infers `N = 'Digit'`
3. Return type becomes `Parser<CharClassTypeMap['Digit']>` = `Parser<Digit>`
4. At runtime, looks up `CHAR_CLASS_STRINGS['Digit']` = `'0123456789'`
5. Calls `anyOf('0123456789')` but with the precise return type

### Mode 2: Custom Character Sets

```typescript
// ✅ Type-safe custom character parsing
const boolParser = charClass('yn');
// Type: Parser<'y' | 'n'>

const directionParser = charClass('NSEW');
// Type: Parser<'N' | 'S' | 'E' | 'W'>

const result = boolParser.parse('y');
// Type: 'y' | 'n'
// Value: 'y'
```

**How it works internally:**
1. `charClass('yn')` matches the second overload: `charClass<S extends string>(chars: S)`
2. TypeScript infers `S = 'yn'`
3. Return type becomes `Parser<ToCharUnion<'yn'>>` = `Parser<'y' | 'n'>`
4. At runtime, `'yn'` is not in `CHAR_CLASS_STRINGS`, so it's treated as custom
5. Calls `anyOf('yn')` with the precise return type

## 🎭 The Relationship with `anyOf`

Understanding the relationship between `charClass` and `anyOf` is crucial:

### `anyOf`: The Foundation
```typescript
// Low-level, type-unsafe foundation
const anyOf = (chars: string): Parser<string> => {
  // Implementation matches any character in the string
  // Always returns Parser<string> - no type precision
};
```

### `charClass`: The Type-Safe Wrapper
```typescript
export function charClass(nameOrChars: string): Parser<string> {
  if (nameOrChars in CHAR_CLASS_STRINGS) {
    // Named character class
    const charSet = CHAR_CLASS_STRINGS[nameOrChars as CharClassName];
    return anyOf(charSet) as Parser<any>; // Safe cast due to overload contract
  }
  
  // Custom character set
  return anyOf(nameOrChars);
}
```

**Key insights:**
- `anyOf` provides the **runtime behavior** (efficient character matching)
- `charClass` overloads provide the **compile-time type safety**
- The cast `as Parser<any>` is safe because TypeScript's overload resolution guarantees type correctness
- `charClass` is essentially a "type-safe facade" over the efficient `anyOf` implementation

## 🏆 Type Safety Benefits in Practice

### 1. **Catch Errors at Compile Time**
```typescript
const digitParser = charClass('Digit');
const result = digitParser.parse('7');

// ✅ Valid - TypeScript knows '7' is a Digit
if (result === '7') { /* ... */ }

// ❌ Compile error - TypeScript knows 'a' is not a Digit
if (result === 'a') { /* This won't compile! */ }
```

### 2. **Intelligent IntelliSense**
```typescript
const hexDigitParser = charClass('HexDigit');
const hex = hexDigitParser.parse('A');

// IntelliSense shows: '0'|'1'|'2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'a'|'b'|'c'|'d'|'e'|'f'|'A'|'B'|'C'|'D'|'E'|'F'
switch (hex) {
  case 'A': // ✅ IntelliSense suggests valid cases
  case 'B':
  case 'C':
  // ...
}
```

### 3. **Composable Type Safety**
```typescript
// Build complex parsers with maintained type safety
const identifier = sequence([
  charClass('CIdentifierStart'), // Parser<'a'|'b'|...|'z'|'A'|...|'Z'|'_'>
  charClass('CIdentifierPart').many() // Parser<('a'|...|'9'|'_')[]>
] as const, ([start, rest]) => start + rest.join(''));

// Type is inferred correctly throughout the chain
```

### 4. **Prevents Character Set Bugs**
```typescript
// ❌ Traditional approach - easy to make mistakes
const digitChars = '012345678'; // Oops, missing '9'!
const digitParser = anyOf(digitChars); // Still Parser<string>

// ✅ Generated approach - impossible to have character set bugs
const digitParser = charClass('Digit'); // Always correct, always in sync
```

## 🎨 Type Ergonomics: Making Complex Types Simple

The `charClass` system dramatically improves **type ergonomics** - making complex type-safe operations feel natural and effortless.

### Before: Complex and Error-Prone
```typescript
// ❌ Manual type definitions
type Vowel = 'a' | 'e' | 'i' | 'o' | 'u' | 'A' | 'E' | 'I' | 'O' | 'U';
type Consonant = 'b' | 'c' | 'd' | 'f' | 'g' | /* ...47 more characters... */;

// ❌ Keeping strings in sync with types
const vowelChars = 'aeiouAEIOU'; // Must manually sync with Vowel type
const consonantChars = 'bcdfgh...'; // Error-prone and tedious

// ❌ Unsafe casts everywhere
const vowelParser = anyOf(vowelChars) as Parser<Vowel>;
```

### After: Simple and Reliable
```typescript
// ✅ Simple, reliable, auto-completed
const vowelParser = charClass('Vowel');
const consonantParser = charClass('Consonant');
const digitParser = charClass('Digit');

// ✅ Perfect type inference
const letter = vowelParser.parse('a'); // Type: Vowel
const num = digitParser.parse('5');   // Type: Digit
```

### Advanced Ergonomic Benefits

**Discoverability**: IntelliSense shows all available character classes:
```typescript
const parser = charClass(''); // IntelliSense shows: 'Digit', 'Alpha', 'Whitespace', etc.
```

**Composability**: Named classes work seamlessly with other combinators:
```typescript
const phoneNumber = sequence([
  charClass('Digit').many1(), // Area code
  charClass('Dash'),          // Separator
  charClass('Digit').many1(), // Number
] as const);
```

**Consistency**: All character classes follow the same naming and behavior patterns:
```typescript
// All of these work the same way
const ascii = charClass('Alpha');
const unicode = charClass('Hiragana');
const symbols = charClass('CurrencySymbols');
```

## 🌍 Unicode and Conceptual Types

For very large character sets (like Unicode blocks), the system provides **conceptual types**:

```typescript
// Generated as conceptual types (aliases for 'string')
export type CjkUnifiedIdeographs = string;
export type Emoji = string;
export type UnicodeLetter = string;
```

**Usage with Unicode-aware parsers:**
```typescript
// For Unicode blocks, you'd typically use with regex
const cjkParser = regex(/\p{Script=Han}/u); // Unicode property escape
const emojiParser = regex(/\p{Emoji}/u);

// But the types are still available for documentation and interfaces
function processCjkText(char: CjkUnifiedIdeographs) {
  // char is typed as 'string' but the intent is clear
}
```

## 🔄 Migration Path: From `anyOf` to `charClass`

Here's how to migrate existing code for better type safety:

### Step 1: Replace Simple `anyOf` Calls
```typescript
// Before
const digitParser = anyOf('0123456789');
const letterParser = anyOf('abcdefghijklmnopqrstuvwxyz');

// After
const digitParser = charClass('Digit');
const letterParser = charClass('Lower');
```

### Step 2: Replace Custom Character Sets
```typescript
// Before
const boolParser = anyOf('tf'); // true/false
const dirParser = anyOf('NSEW'); // directions

// After
const boolParser = charClass('tf'); // Now Parser<'t' | 'f'>
const dirParser = charClass('NSEW'); // Now Parser<'N' | 'S' | 'E' | 'W'>
```

### Step 3: Benefit from Enhanced Type Safety
```typescript
// Now your parsers provide precise type information
const result = boolParser.parse('t');
// result has type 't' | 'f', not just 'string'

// Type-safe conditionals
if (result === 't') {
  console.log('True value detected');
} else {
  console.log('False value detected'); // TypeScript knows this is 'f'
}
```

## 🎯 Best Practices

### ✅ Do: Use Named Classes When Available
```typescript
// ✅ Preferred - leverages the full type system
const parser = charClass('HexDigit');
```

### ✅ Do: Use Custom Sets for Domain-Specific Characters
```typescript
// ✅ Good for domain-specific parsing
const chessPieceParser = charClass('KQRBNPkqrbnp');
const dnaBaseParser = charClass('ATCG');
```

### ❌ Don't: Use `anyOf` Directly Unless Necessary
```typescript
// ❌ Prefer charClass for better type safety
const badParser = anyOf('0123456789');

// ✅ Better
const goodParser = charClass('Digit');
```

### ✅ Do: Combine with Other Combinators
```typescript
// ✅ Excellent composability
const floatParser = sequence([
  charClass('Digit').many1(),
  charClass('.'),
  charClass('Digit').many1()
] as const, ([whole, dot, fraction]) => 
  parseFloat(whole.join('') + dot + fraction.join(''))
);
```

## 🏁 Summary: The Type Safety Revolution

The `charClass` system represents a **fundamental advancement** in parser combinator type safety:

1. **Generated Precision**: Character classes are generated programmatically, eliminating human error
2. **Perfect Sync**: Compile-time types and runtime strings are always in sync
3. **Zero Overhead**: The type safety is compile-time only - runtime performance is identical to `anyOf`
4. **Progressive Enhancement**: Works alongside existing `anyOf` code while providing better alternatives
5. **Ergonomic Excellence**: Complex character parsing becomes simple and discoverable

By bridging the gap between TypeScript's powerful type system and efficient runtime parsing, `charClass` enables developers to build parsers that are both lightning-fast and bulletproof. It's not just about preventing bugs - it's about making the entire development experience more pleasant, productive, and reliable.

The result is parser combinators that truly deserve the "type-safe" label, where your IDE knows exactly what characters your parsers will produce, and TypeScript catches character-related bugs before they ever reach production.