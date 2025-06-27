# Troubleshooting & Common Gotchas

This comprehensive guide covers the most common issues you'll encounter when using Combi-Parse, along with their solutions and best practices to avoid them.

## 🔄 Left Recursion Issues

### Problem: Stack Overflow with Left-Recursive Grammars

```typescript
// ❌ This will cause a stack overflow
const expression = choice([
  sequence([expression, str('+'), term]),  // expression refers to itself immediately
  term
]);
```

**Why it happens**: JavaScript evaluates `expression` immediately during definition, creating an infinite loop before any parsing begins.

**Solutions**:

1. **Use `leftRecursive` for left-associative expressions**:
```typescript
// ✅ This works correctly
import { leftRecursive } from '@doeixd/combi-parse';

const expression = leftRecursive(() => choice([
  sequence([expression, str('+'), term], ([left, , right]) => ({
    type: 'binary',
    operator: '+',
    left,
    right
  })),
  term
]));
```

2. **Use `lazy` for mutual recursion**:
```typescript
// ✅ For mutual recursion between parsers
const factor = choice([
  number,
  sequence([str('('), lazy(() => expression), str(')')])
]);

const expression = choice([
  factor,
  sequence([factor, str('+'), lazy(() => expression)])
]);
```

3. **Rewrite as right-recursive grammar**:
```typescript
// ✅ Right-recursive version (changes associativity)
const expression = choice([
  sequence([term, str('+'), expression]),
  term
]);
```

### Advanced Left-Recursion Patterns

```typescript
// Complex left-recursive expression with multiple operators
const expression = leftRecursive(() => choice([
  // Addition (lowest precedence)
  sequence([expression, lexeme(str('+')), term], 
    ([left, , right]) => ({ type: 'add', left, right })),
  
  // Multiplication (higher precedence)
  sequence([expression, lexeme(str('*')), factor],
    ([left, , right]) => ({ type: 'mul', left, right })),
    
  // Function calls
  sequence([expression, str('('), sepBy(expression, str(',')), str(')')],
    ([fn, , args]) => ({ type: 'call', function: fn, arguments: args })),
    
  // Base case
  primary
]));
```

---

## 🐌 Performance Issues

### Problem: Exponential Backtracking

```typescript
// ❌ This can be extremely slow on large inputs
const inefficientParser = choice([
  sequence([word, str(','), word, str(','), word, str(','), word]),
  sequence([word, str(','), word, str(','), word]),
  sequence([word, str(','), word]),
  word
]);
```

**Why it happens**: Each alternative tries to parse from the beginning, creating exponential time complexity.

**Solutions**:

1. **Use memoization for expensive parsers**:
```typescript
// ✅ Memoized version prevents re-computation
import { memo } from '@doeixd/combi-parse';

const memoizedWord = memo(word);
const efficientParser = sequence([
  memoizedWord,
  optional(sequence([str(','), memoizedWord])),
  optional(sequence([str(','), memoizedWord])),
  optional(sequence([str(','), memoizedWord]))
]);
```

2. **Restructure to reduce backtracking**:
```typescript
// ✅ Better: parse first item, then optional continuations
const listParser = sequence([
  word,
  many(sequence([str(','), word], ([, w]) => w))
], ([first, rest]) => [first, ...rest]);
```

3. **Use `sepBy` for separated lists**:
```typescript
// ✅ Best: built-in combinator optimized for this pattern
import { sepBy } from '@doeixd/combi-parse';

const wordList = sepBy(word, str(','));
```

### Performance Monitoring

```typescript
// Monitor parser performance
import { withTiming, profile } from '@doeixd/combi-parse';

const timedParser = withTiming(expensiveParser, 'complex-expression');
const profiledParser = profile(complexParser);

// Performance metrics
const result = profiledParser.parse(input);
console.log('Parse time:', result.metrics.time);
console.log('Memory used:', result.metrics.memory);
console.log('Backtrack count:', result.metrics.backtracks);
```

---

## 🔧 Type Safety Issues

### Problem: Losing Precise Types

**Common causes and solutions**:

1. **`regex()` always returns `string`**:
```typescript
// ❌ Returns Parser<string>, not Parser<'true' | 'false'>
const booleanRegex = regex(/true|false/);

// ✅ Better: use choice() for literal types
const booleanParser = choice([str('true'), str('false')]);
// Returns Parser<'true' | 'false'>
```

2. **Missing `as const` in sequences**:
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

### Type-Safe Patterns

```typescript
// Pattern 1: Use choice() for union types
const httpMethod = choice([
  str('GET'),
  str('POST'),
  str('PUT'),
  str('DELETE')
]); // Parser<'GET' | 'POST' | 'PUT' | 'DELETE'>

// Pattern 2: Use charClass for character unions
const digit = charClass('Digit'); 
// Parser<'0'|'1'|'2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'>

// Pattern 3: Explicit transformation types
const assignment = sequence(
  [str('let'), identifier, str('='), number] as const,
  ([_let, name, _eq, value]: ['let', string, '=', number]) => ({
    type: 'assignment' as const,
    name,
    value
  })
);
// Parser<{ type: 'assignment', name: string, value: number }>
```

---

## 🧹 Whitespace Handling Issues

### Problem: Brittle Parsers That Break With Extra Spaces

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

**Solutions**:

1. **Use `lexeme()` consistently**:
```typescript
// ✅ Handles whitespace gracefully
import { lexeme } from '@doeixd/combi-parse';

const assignment = sequence([
  lexeme(str('let')),
  lexeme(identifier),
  lexeme(str('=')),
  number  // Last item doesn't need lexeme
]);
```

2. **Define a custom whitespace-aware token parser**:
```typescript
// ✅ Custom token wrapper
const token = <T>(parser: Parser<T>) => lexeme(parser);

const assignment = sequence([
  token(str('let')),
  token(identifier),
  token(str('=')),
  number
]);
```

3. **For languages with significant whitespace**:
```typescript
// ✅ Explicit whitespace handling
import { whitespace } from '@doeixd/combi-parse';

const pythonAssignment = sequence([
  str('let'),
  whitespace.many1(),  // Require at least one space
  identifier,
  whitespace.many(),   // Optional spaces
  str('='),
  whitespace.many(),
  number
]);
```

---

## 🔍 Error Handling & Debugging

### Problem: Confusing Error Messages

```typescript
// ❌ Error: "Expected 'function' at line 1, column 5"
const fn = str('function');
```

**Solutions**:

1. **Use `label()` for better error messages**:
```typescript
// ✅ Better error reporting
import { label, context } from '@doeixd/combi-parse';

const fn = label(str('function'), 'function keyword');
// Error: "Expected function keyword at line 1, column 5"
```

2. **Use `context()` for error context**:
```typescript
// ✅ Contextual error messages
const declaration = context(
  sequence([fn, identifier, str('(')]),
  'parsing function declaration'
);
// Error: "Expected function keyword at line 1, column 5 while parsing function declaration"
```

3. **Create a debug version of your parser**:
```typescript
// ✅ Debug parser with tracing
import { withDebug, trace } from '@doeixd/combi-parse';

const debugParser = withDebug(
  sequence([
    trace(str('let'), 'keyword'),
    trace(identifier, 'name'),
    trace(str('='), 'equals'),
    trace(number, 'value')
  ]),
  { traceLevel: 'detailed', showPositions: true }
);
```

### Debugging Strategies

```typescript
// Strategy 1: Isolate components
const testKeyword = str('let').parse('let x = 42');
const testIdentifier = identifier.parse('x = 42');
const testEquals = str('=').parse('= 42');

// Strategy 2: Use breakpoints in generator parsers
import { gen, breakpoint, log } from '@doeixd/combi-parse';

const debugDeclaration = gen(function*() {
  yield log('Starting declaration parse');
  yield breakpoint(); // Pauses execution in debugger
  
  const keyword = yield str('let');
  yield log(`Parsed keyword: ${keyword}`);
  
  const name = yield identifier;
  yield log(`Parsed name: ${name}`);
  
  return { keyword, name };
});

// Strategy 3: Parser visualization
import { visualize } from '@doeixd/combi-parse';

const flowChart = visualize(complexParser);
console.log(flowChart); // ASCII art of parser flow
```

---

## 🎪 Choice Order Issues

### Problem: Parser Order Affects Results

```typescript
// ❌ 'catch' will never be matched because 'cat' succeeds first
const keyword = choice([
  str('cat'),
  str('catch'),
  str('car')
]);

keyword.parse('catch'); // Returns 'cat', not 'catch'!
```

**Solutions**:

1. **Order from most specific to least specific**:
```typescript
// ✅ Correct order
const keyword = choice([
  str('catch'),  // More specific first
  str('cat'),
  str('car')
]);
```

2. **Use word boundaries for keywords**:
```typescript
// ✅ Better: ensure complete word matching
const wordBoundary = regex(/\b/);
const keyword = choice([
  sequence([str('cat'), wordBoundary]),
  sequence([str('catch'), wordBoundary]),
  sequence([str('car'), wordBoundary])
]);
```

3. **Use a keyword parser helper**:
```typescript
// ✅ Best: dedicated keyword parser
const keyword = (word: string) => 
  sequence([str(word), not(charClass('Alphanumeric'))], ([w]) => w);

const keywords = choice([
  keyword('catch'),
  keyword('cat'),
  keyword('car')
]);
```

---

## 💾 Memory Issues

### Problem: Memory Usage with Large Inputs

**Common causes and solutions**:

1. **String slicing creates new strings**:
```typescript
// ❌ Can cause memory issues with large files
const manyLines = many(sequence([regex(/[^\n]*/), str('\n')]));

// ✅ Better: use streaming for large files
import { createStreamParser } from '@doeixd/combi-parse/stream';

const lineStream = createStreamParser(
  sequence([regex(/[^\n]*/), str('\n')]),
  str('\n')
);
```

2. **Excessive memoization**:
```typescript
// ❌ Memoizing everything uses lots of memory
const overMemoized = memo(memo(memo(simpleParser)));

// ✅ Only memoize expensive operations
const selectivelyMemoized = memo(expensiveParser);
```

3. **Large parse trees**:
```typescript
// ❌ Keeping entire parse tree in memory
const hugeTree = many(complexStructure);

// ✅ Process and discard as you go
import { transform } from '@doeixd/combi-parse/stream';

const processAsYouGo = transform(
  stream,
  complexStructure,
  (item) => {
    processItem(item);
    return null; // Don't keep in memory
  }
);
```

---

## 🛡️ Security Issues

### Problem: DoS Attacks Through Malicious Input

```typescript
// ❌ Vulnerable to catastrophic backtracking
const vulnerableParser = regex(/(a+)+b/);

// ❌ Vulnerable to stack overflow
const deepNesting = many(str('{')); // No depth limit
```

**Solutions**:

1. **Use secure parser wrappers**:
```typescript
// ✅ Protected against DoS attacks
import { secureParser } from '@doeixd/combi-parse/secure';

const safeParser = secureParser(vulnerableParser, {
  maxDepth: 100,
  maxParseTime: 1000,
  maxMemory: 10 * 1024 * 1024, // 10MB
  maxBacktracks: 10000
});
```

2. **Validate input size**:
```typescript
// ✅ Pre-validate input
const validateInput = (input: string) => {
  if (input.length > 1024 * 1024) { // 1MB limit
    throw new Error('Input too large');
  }
  if (!/^[\x20-\x7E\s]*$/.test(input)) {
    throw new Error('Invalid characters in input');
  }
  return input;
};

const safeResult = parser.parse(validateInput(untrustedInput));
```

3. **Use non-backtracking patterns**:
```typescript
// ❌ Backtracking regex
const dangerous = regex(/(a|a)*b/);

// ✅ Non-backtracking alternative
const safe = sequence([
  many(str('a')),
  str('b')
]);
```

---

## ⚡ Generator-Specific Issues

### Problem: Incorrect Generator Usage

```typescript
// ❌ Common generator mistakes
import { gen } from '@doeixd/combi-parse';

// Mistake 1: Forgetting to yield
const badGenerator = gen(function*() {
  str('hello'); // ❌ Missing yield
  return 'result';
});

// Mistake 2: Yielding non-parsers
const anotherBad = gen(function*() {
  yield 'hello'; // ❌ Should yield a parser
  return 'result';
});

// Mistake 3: Not handling yield results
const yetAnotherBad = gen(function*() {
  yield str('hello'); // ❌ Result is ignored
  return 'result';
});
```

**Solutions**:

```typescript
// ✅ Correct generator usage
const goodGenerator = gen(function*() {
  const greeting = yield str('hello'); // ✅ Yield parser, capture result
  const name = yield regex(/\w+/);     // ✅ Use the result
  return `${greeting} ${name}`;        // ✅ Transform as needed
});

// ✅ Error handling in generators
const robustGenerator = gen(function*() {
  try {
    const result = yield riskyParser;
    return result;
  } catch (error) {
    // ✅ Handle parse errors gracefully
    return { error: error.message };
  }
});

// ✅ Conditional parsing
const conditionalGenerator = gen(function*() {
  const type = yield identifier;
  
  if (type === 'number') {
    const value = yield number;
    return { type, value };
  } else if (type === 'string') {
    const value = yield stringLiteral;
    return { type, value };
  } else {
    throw new Error(`Unknown type: ${type}`);
  }
});
```

---

## 🔄 Async/Stream Issues

### Problem: Memory Buildup in Streams

```typescript
// ❌ Accumulates all results in memory
import { createStreamParser } from '@doeixd/combi-parse/stream';

const memoryHog = createStreamParser(itemParser);
// Results accumulate without being processed
```

**Solutions**:

```typescript
// ✅ Process results immediately
const processAsYouGo = createStreamParser(itemParser);

processAsYouGo.onData(item => {
  processItem(item);
  // Don't accumulate items
});

// ✅ Use batch processing
import { batchParser } from '@doeixd/combi-parse/async';

const batchProcessor = batchParser(itemParser, {
  batchSize: 100,
  onBatch: (batch) => {
    processBatch(batch);
    // Batch is automatically discarded
  }
});
```

---

## 🛠️ Development & Testing Issues

### Problem: Hard to Test Complex Parsers

```typescript
// ❌ Monolithic parser is hard to test
const monolithicParser = sequence([
  /* 50 lines of complex parsing logic */
]);
```

**Solutions**:

1. **Break into smaller, testable components**:
```typescript
// ✅ Testable components
const keyword = str('function');
const params = between(str('('), sepBy(identifier, str(',')), str(')'));
const body = between(str('{'), many(statement), str('}'));

const functionDeclaration = sequence([keyword, identifier, params, body]);

// Test each component individually
describe('function parser components', () => {
  test('keyword parser', () => {
    expect(keyword.parse('function')).toBe('function');
  });
  
  test('params parser', () => {
    expect(params.parse('(a, b, c)')).toEqual(['a', 'b', 'c']);
  });
});
```

2. **Use property-based testing**:
```typescript
// ✅ Property-based testing
import { ParserTester } from '@doeixd/combi-parse/testing';

const tester = new ParserTester(numberParser);

tester.property('parsing and formatting round-trip', (num: number) => {
  const formatted = num.toString();
  const parsed = numberParser.parse(formatted);
  return parsed === num;
});

tester.fuzz('handles random inputs gracefully', {
  maxLength: 100,
  mutationRate: 0.1
});
```

3. **Generate test cases automatically**:
```typescript
// ✅ Automatic test generation
import { generateTestCases } from '@doeixd/combi-parse/testing';

const testCases = generateTestCases(emailParser, {
  validExamples: ['user@domain.com', 'test@example.org'],
  invalidExamples: ['invalid', '@domain.com', 'user@'],
  count: 1000
});

testCases.forEach(({ input, shouldPass }) => {
  test(`email parser: ${input}`, () => {
    const result = () => emailParser.parse(input);
    if (shouldPass) {
      expect(result).not.toThrow();
    } else {
      expect(result).toThrow();
    }
  });
});
```

---

## 🎯 Best Practices Summary

### DO ✅

- Use `as const` with `sequence()` for type safety
- Order `choice()` alternatives from specific to general
- Use `lexeme()` for whitespace handling
- Use `leftRecursive()` for left-associative expressions
- Use `memo()` for expensive parsers
- Use `label()` and `context()` for better errors
- Break complex parsers into smaller, testable pieces
- Use streaming for large inputs
- Use secure parsers for untrusted input
- Test parser components individually

### DON'T ❌

- Define left-recursive parsers without `leftRecursive()`
- Forget `yield` in generator parsers
- Use `regex()` when you need literal types
- Put general patterns before specific ones in `choice()`
- Memoize everything (memory overhead)
- Parse untrusted input without security limits
- Create monolithic parsers
- Ignore parser performance for large inputs
- Skip error handling in production parsers
- Forget to handle edge cases (empty input, malformed data)

---

## 🆘 Getting Help

When you encounter issues:

1. **Check this troubleshooting guide** for common problems
2. **Use the debugging tools** to trace parser execution
3. **Test components in isolation** to identify the problem
4. **Check the [examples](examples/)** for similar use cases
5. **Review the [API documentation](api/)** for detailed function descriptions
6. **Use property-based testing** to find edge cases
7. **Profile your parser** to identify performance bottlenecks

### Reporting Issues

When reporting issues, include:

- Minimal reproducible example
- Expected vs. actual behavior
- Parser performance metrics (if relevant)
- Input data that causes the problem
- Stack trace (for errors)
- Your environment details

This helps maintainers quickly identify and fix problems.
