# Parser Combinators Explained

This document provides a deep dive into the theory and mathematics behind parser combinators, helping you understand the foundations of Combi-Parse.

## What Are Parser Combinators?

Parser combinators are a way of building parsers by combining smaller, simpler parsers using higher-order functions called "combinators." This approach comes from functional programming and provides several key advantages:

- **Composability**: Small parsers combine to create complex ones
- **Modularity**: Each parser has a single, well-defined responsibility  
- **Type Safety**: The type system helps catch parsing logic errors
- **Testability**: Individual components can be tested in isolation

## Mathematical Foundations

### Monads and Parser Structure

Parser combinators are built on monadic structure. A parser can be viewed as a function:

```
Parser<T> :: String -> Maybe<(T, String)>
```

This represents a function that takes an input string and returns either:
- `Some((value, remaining))` on success
- `None` on failure

In Combi-Parse, this is represented more explicitly:

```typescript
type Parser<T> = (state: ParserState) => ParseResult<T>

interface ParserState {
  input: string;
  index: number;
}

type ParseResult<T> = Success<T> | Failure
```

### The Functor Pattern

Parsers form a functor, meaning you can apply transformations to their results:

```typescript
// Functor law: fmap(id) = id
parser.map(x => x) === parser

// Composition law: fmap(f . g) = fmap(f) . fmap(g)  
parser.map(x => f(g(x))) === parser.map(g).map(f)
```

The `map` operation transforms successful results without changing the parsing behavior:

```typescript
const numberString = regex(/[0-9]+/);  // Parser<string>
const actualNumber = numberString.map(Number);  // Parser<number>
```

### The Monad Pattern

Parsers also form a monad, which allows sequential composition where later parsers can depend on earlier results:

```typescript
// Monad laws:
// 1. Left identity: return(a).chain(f) === f(a)
succeed(42).chain(n => succeed(n * 2)) === succeed(84)

// 2. Right identity: m.chain(return) === m  
parser.chain(succeed) === parser

// 3. Associativity: (m.chain(f)).chain(g) === m.chain(x => f(x).chain(g))
```

The `chain` operation (also called "bind" or `>>=` in Haskell) enables context-sensitive parsing:

```typescript
// Parse length-prefixed string: "3:abc"
const lengthPrefixed = number.chain(len =>
  str(":").keepRight(regex(new RegExp(`.{${len}}`)))
);
```

### Alternative and Choice

Parsers form an Alternative, providing choice operations:

```typescript
// Alternative laws:
// 1. Associativity: (a.or(b)).or(c) === a.or(b.or(c))
// 2. Left identity: fail().or(parser) === parser
// 3. Right identity: parser.or(fail()) === parser
```

## Core Combinator Patterns

### Sequence Combinators

**Sequential Composition** (`sequence`, `chain`, `keepLeft`, `keepRight`):
- Run parsers in order
- Combine their results
- Fail if any component fails

```typescript
// Mathematical notation: A → B → (A, B)
const pair = <A, B>(pa: Parser<A>, pb: Parser<B>): Parser<[A, B]> =>
  pa.chain(a => pb.map(b => [a, b]));
```

### Choice Combinators

**Alternative Composition** (`choice`, `or`):
- Try parsers in order
- Return first success
- Backtrack on failure (with constraints)

```typescript
// Mathematical notation: A | B
const either = <A, B>(pa: Parser<A>, pb: Parser<B>): Parser<A | B> =>
  pa.or(pb);
```

### Repetition Combinators

**Repetition** (`many`, `many1`, `sepBy`):
- Apply parser multiple times
- Collect results into arrays
- Handle termination conditions

```typescript
// Mathematical notation: A*  (zero or more)
// Implemented as: ε | A A*
const many = <T>(parser: Parser<T>): Parser<T[]> =>
  parser.chain(first =>
    many(parser).map(rest => [first, ...rest])
  ).or(succeed([]));
```

## Parsing Theory Concepts

### Grammar Classes and Parser Power

Parser combinators can handle different grammar classes:

1. **Regular Languages** (Type 3): Simple patterns, repetition
2. **Context-Free Languages** (Type 2): Nested structures, recursion
3. **Context-Sensitive** (Type 1): Some forms with careful design
4. **Unrestricted** (Type 0): With embedded computation

```typescript
// Regular: a*b+
const regular = many(str("a")).keepRight(many1(str("b")));

// Context-Free: balanced parentheses
const balanced: Parser<string> = lazy(() => choice([
  str(""),
  str("(").keepRight(balanced).keepLeft(str(")")).keepRight(balanced)
]));

// Context-Sensitive: a^n b^n c^n (with generator tricks)
const contextSensitive = genParser(function* () {
  const as = yield many1(str("a"));
  const bs = yield many1(str("b"));  
  const cs = yield many1(str("c"));
  
  if (as.length !== bs.length || bs.length !== cs.length) {
    throw new Error("Counts must match");
  }
  
  return { as, bs, cs };
});
```

### Left Recursion Problem

Traditional parser combinators struggle with left-recursive grammars:

```typescript
// This causes infinite recursion:
// expr = expr '+' term | term

// Solution 1: Right-recursive transformation
// expr = term ('+' term)*
const expr = term.chain(first =>
  many(str("+").keepRight(term)).map(rest =>
    rest.reduce((acc, next) => ({ op: '+', left: acc, right: next }), first)
  )
);

// Solution 2: Precedence climbing
const buildExpressionParser = (operators: OpInfo[], atom: Parser<any>) => {
  // Implementation using precedence climbing algorithm
};
```

### Backtracking and Cut

Parser combinators use backtracking for choice, but this can be expensive:

```typescript
// Problematic: lots of backtracking
const inefficient = choice([
  str("function").keepRight(whitespace).keepRight(identifier),
  str("function").keepRight(str("*")).keepRight(identifier),
  str("func").keepRight(whitespace).keepRight(identifier)
]);

// Better: factor out common prefix
const efficient = str("func").chain(prefix =>
  choice([
    str("tion").keepRight(whitespace),
    str("tion*"),
    whitespace
  ]).keepRight(identifier)
);
```

**Cut Operation** (not in basic Combi-Parse, but conceptually important):
- Prevents backtracking past a certain point
- Commits to a parsing path
- Improves performance and error messages

### Lookahead and Prediction

Lookahead helps make parsing decisions without consuming input:

```typescript
// Lookahead for better choice decisions
const statement = choice([
  // If we see "if", parse if-statement
  lookahead(str("if")).keepRight(ifStatement),
  // If we see "while", parse while-loop  
  lookahead(str("while")).keepRight(whileStatement),
  // Otherwise, try expression statement
  expressionStatement
]);
```

## Advanced Theoretical Concepts

### Parser Derivatives

**Brzozowski Derivatives** provide an alternative foundation for parsing:
- The derivative of a language L with respect to character c is the set of strings that, when prefixed with c, belong to L
- This leads to a different way of constructing parsers

```typescript
// Conceptual representation (not actual Combi-Parse code)
const derivative = (parser: Parser<any>, char: string): Parser<any> => {
  // Returns a new parser representing the derivative
  // This is more theoretical than practical for most use cases
};
```

### Parsing Expression Grammars (PEGs)

Parser combinators are closely related to PEGs:
- Ordered choice (first match wins)
- Unlimited lookahead
- No ambiguity (deterministic)

```typescript
// PEG-style ordered choice
const pegChoice = <T>(...parsers: Parser<T>[]): Parser<T> =>
  parsers.reduce((acc, parser) => acc.or(parser));
```

### Error Recovery and Panic Mode

Advanced error handling strategies:

```typescript
// Panic mode recovery
const recoverUntil = <T>(sync: Parser<any>): Parser<null> =>
  genParser(function* () {
    while (!(yield lookahead(sync.or(eof)).optional())) {
      yield regex(/./); // Consume any character
    }
    return null;
  });

// Error productions
const robustStatement = choice([
  normalStatement,
  recoverUntil(str(";")).map(() => ({ type: 'error', recovered: true }))
]);
```

## Performance Considerations

### Time Complexity

Parser combinator performance depends on grammar structure:

- **Linear**: Simple sequential parsing
- **Polynomial**: Backtracking with bounded choice depth
- **Exponential**: Pathological backtracking cases

```typescript
// Linear time
const linearParser = many(regex(/[a-z]/));

// Potentially exponential due to backtracking
const exponentialParser = choice([
  regex(/a*/).keepRight(str("b")),
  regex(/a*/).keepRight(str("c"))
]);
```

### Space Complexity

Stack usage and memory considerations:

```typescript
// Left-recursive: stack overflow risk
const leftRecursive = lazy(() => 
  leftRecursive.keepRight(str("+")).keepRight(atom)
    .or(atom)
);

// Right-recursive: better stack usage
const rightRecursive = lazy(() =>
  atom.chain(first =>
    str("+").keepRight(rightRecursive).map(rest => [first, rest])
      .or(succeed(first))
  )
);
```

### Memoization (Packrat Parsing)

Cache results to avoid re-parsing:

```typescript
const memoize = <T>(parser: Parser<T>): Parser<T> => {
  const cache = new Map<string, ParseResult<T>>();
  
  return new Parser(state => {
    const key = `${state.index}:${parser.toString()}`;
    
    if (cache.has(key)) {
      return cache.get(key)!;
    }
    
    const result = parser.run(state);
    cache.set(key, result);
    return result;
  });
};
```

## Comparison with Other Parsing Techniques

### vs. Recursive Descent

**Parser Combinators**:
- ✅ Composable, modular
- ✅ Type-safe
- ✅ Easy to test
- ❌ Can have performance overhead
- ❌ May struggle with left recursion

**Hand-written Recursive Descent**:
- ✅ Full control over performance
- ✅ Natural handling of left recursion
- ❌ More boilerplate code
- ❌ Harder to maintain and modify

### vs. Parser Generators (YACC, ANTLR)

**Parser Combinators**:
- ✅ Embedded in host language
- ✅ No separate compilation step
- ✅ Dynamic parser construction
- ❌ Runtime parsing overhead

**Parser Generators**:
- ✅ Optimized generated code
- ✅ Powerful error recovery
- ✅ Handle broader grammar classes
- ❌ Tool dependency
- ❌ Less flexibility

### vs. Parser Combinators in Other Languages

**Haskell Parsec**:
- More mathematical purity
- Powerful error message combinators
- Strong type inference

**JavaScript/TypeScript Libraries**:
- More pragmatic approach
- Integration with existing ecosystems
- Performance optimizations for JS engines

## Theoretical Extensions

### Monadic Parser Combinators

Advanced monadic operations:

```typescript
// Parser transformer monad
type ParserT<M, T> = (state: ParserState) => M<ParseResult<T>>;

// Reader monad for context
type ContextualParser<Ctx, T> = (ctx: Ctx) => Parser<T>;

// State monad for stateful parsing
type StatefulParser<S, T> = Parser<(state: S) => [T, S]>;
```

### Arrows and Applicative Functors

Alternative composition patterns:

```typescript
// Applicative style (more parallel)
const applicativeSequence = <A, B, C>(
  pa: Parser<A>, 
  pb: Parser<B>,
  f: (a: A, b: B) => C
): Parser<C> =>
  pa.chain(a => pb.map(b => f(a, b)));

// Arrow style (for more advanced composition)
interface ParserArrow<A, B> {
  arr<C, D>(f: (c: C) => D): ParserArrow<C, D>;
  compose<C>(other: ParserArrow<B, C>): ParserArrow<A, C>;
  first<C>(): ParserArrow<[A, C], [B, C]>;
}
```

This theoretical foundation helps you understand why parser combinators work, their limitations, and how to use them effectively. The mathematical properties ensure that your parsers behave predictably and can be reasoned about formally.
