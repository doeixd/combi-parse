# Primitives API Reference

This document provides comprehensive API documentation for all primitive parsing modules that form the foundational building blocks of the parsing system.

## src/primitives/index.ts - Primitives Entry Point

Re-exports all primitive parsing utilities and advanced features.

| Export | Source | Description |
|--------|--------|-------------|
| **All Algebra** | `./algebra` | Parser algebra operations |
| **All AST** | `./ast` | Abstract syntax tree construction |
| **All Debug** | `./debug` | Debugging and visualization tools |
| **All Grammar** | `./grammar` | Grammar analysis and optimization |
| **All Parallel Choice** | `./parallel-choice` | Parallel and async parsing |
| **All Pattern** | `./pattern` | Advanced pattern matching |
| **All Recover** | `./recover` | Error recovery mechanisms |
| **All Testing** | `./testing` | Comprehensive testing utilities |
| **All Regex Combinator** | `./regex-combinator` | Type-safe regex parser with compile-time pattern analysis |

---

## src/primitives/algebra.ts - Parser Algebra Operations

Mathematical set operations and formal language theory operations for parsers.

### Types

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `LanguageSet<T>` | `interface` | `<T>` | Represents a formal language as a set of strings |
| `ParserAlgebra` | `object` | - | Container for all algebra operations |

### Core Algebra Operations

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `ParserAlgebra.intersect` | `function` | `<T>(p1: Parser<T>, p2: Parser<T>) => Parser<T>` | Language intersection - accepts strings in both languages |
| `ParserAlgebra.difference` | `function` | `<T>(p1: Parser<T>, p2: Parser<T>) => Parser<T>` | Language difference - in first but not second |
| `ParserAlgebra.union` | `function` | `<T>(p1: Parser<T>, p2: Parser<T>) => Parser<T>` | Language union - in either language |
| `ParserAlgebra.complement` | `function` | `<T>(parser: Parser<T>) => Parser<T>` | Language complement - not in language |

### Advanced Operations

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `ParserAlgebra.permutation` | `function` | `<T extends readonly Parser<any>[]>(parsers: T) => Parser<T>` | Parse items in any order |
| `ParserAlgebra.longest` | `function` | `<T>(parsers: Parser<T>[]) => Parser<T>` | Maximal munch - longest match wins |
| `ParserAlgebra.kleeneStar` | `function` | `<T>(parser: Parser<T>) => Parser<T[]>` | Kleene star operation (zero or more) |
| `ParserAlgebra.kleenePlus` | `function` | `<T>(parser: Parser<T>) => Parser<T[]>` | Kleene plus operation (one or more) |

### Usage Examples

```typescript
import { ParserAlgebra } from '@doeixd/combi-parse/primitives';

// Parse numbers that are NOT keywords
const numberNotKeyword = ParserAlgebra.difference(
  number,
  choice([str('if'), str('then'), str('else')])
);

// Parse arguments in any order: --verbose --output file.txt
const flexibleArgs = ParserAlgebra.permutation([
  optional(str('--verbose')),
  optional(sequence([str('--output'), str(' '), filename])),
  optional(sequence([str('--config'), str(' '), configFile]))
]);

// Intersection of valid identifiers and non-reserved words
const validIdentifier = ParserAlgebra.intersect(
  regex(/[a-zA-Z_][a-zA-Z0-9_]*/),
  ParserAlgebra.complement(reservedWords)
);
```

---

## src/primitives/ast.ts - AST Construction Utilities

Type-safe abstract syntax tree construction with semantic analysis support.

### Core Types

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `ASTNode<T>` | `interface` | `<T>` | Base AST node with type, value, and position |
| `Expression` | `interface` | - | Expression AST node interface |
| `Statement` | `interface` | - | Statement AST node interface |
| `ASTVisitor<T>` | `interface` | `<T>` | Visitor pattern for AST traversal |

### AST Construction

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `ast` | `function` | `<T>(type: string, fields: Record<string, Parser<any>>) => Parser<ASTNode<T>>` | Create typed AST node parser |
| `expression` | `function` | `<T>(parser: Parser<T>) => Parser<Expression>` | Wrap parser as expression |
| `statement` | `function` | `<T>(parser: Parser<T>) => Parser<Statement>` | Wrap parser as statement |
| `literal` | `function` | `<T>(parser: Parser<T>) => Parser<ASTNode<T>>` | Create literal AST node |

### AST Traversal

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `visit` | `function` | `<T>(node: ASTNode<any>, visitor: ASTVisitor<T>) => T` | Visit AST nodes with visitor pattern |
| `transform` | `function` | `<T, U>(node: ASTNode<T>, transformer: (node: ASTNode<T>) => ASTNode<U>)` | Transform AST nodes |
| `find` | `function` | `<T>(node: ASTNode<any>, predicate: (node: ASTNode<any>) => boolean)` | Find nodes matching predicate |
| `collect` | `function` | `<T>(node: ASTNode<any>, type: string) => ASTNode<T>[]` | Collect all nodes of specific type |

### Usage Examples

```typescript
import { ast, expression, visit } from '@doeixd/combi-parse/primitives';

// Define AST node types
const binaryExpression = ast('BinaryExpression', {
  left: expression(term),
  operator: choice([str('+'), str('-'), str('*'), str('/')]),
  right: expression(term)
});

const functionCall = ast('FunctionCall', {
  name: identifier,
  arguments: between(str('('), sepBy(expression(value), str(',')), str(')'))
});

// Use AST visitor for semantic analysis
const symbolCollector = {
  visitIdentifier(node: ASTNode<string>) {
    this.symbols.add(node.value);
  },
  
  visitFunctionCall(node: ASTNode<any>) {
    this.functions.add(node.fields.name.value);
  }
};

const ast = program.parse(sourceCode);
visit(ast, symbolCollector);
```

---

## src/primitives/debug.ts - Debugging and Visualization Tools

Comprehensive debugging, profiling, and visualization utilities for parser development.

### Debug Types

| Export | Type | Description |
|--------|------|-------------|
| `DebugStep` | `interface` | Single step in parser execution trace |
| `ParserFrame` | `interface` | Parser call frame for stack traces |
| `DebugInfo` | `interface` | Complete debugging information |
| `TraceLevel` | `type` | `'none' \| 'basic' \| 'detailed' \| 'verbose'` |

### Debugging Functions

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `debug` | `function` | `<T>(parser: Parser<T>, options?: DebugOptions) => Parser<T>` | Add debugging to parser |
| `trace` | `function` | `<T>(parser: Parser<T>, label: string) => Parser<T>` | Trace parser execution |
| `profile` | `function` | `<T>(parser: Parser<T>) => Parser<T>` | Profile parser performance |
| `benchmark` | `function` | `<T>(parser: Parser<T>, iterations: number) => BenchmarkResult` | Benchmark parser |

### Visualization Classes

| Export | Type | Description |
|--------|------|-------------|
| `SVGBuilder` | `class` | Build SVG railroad diagrams |
| `ParserDebugger` | `class` | Interactive parser debugger |
| `DebugSession` | `class` | Debug session management |

#### SVGBuilder Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `createElement` | `(tag: string, attrs: Record<string, string>) => SVGElement` | Create SVG element |
| `addPath` | `(d: string, style?: string) => this` | Add path to diagram |
| `addText` | `(x: number, y: number, text: string) => this` | Add text label |
| `addRect` | `(x: number, y: number, width: number, height: number) => this` | Add rectangle |
| `generateDiagram` | `(parser: Parser<any>) => string` | Generate complete diagram |

#### ParserDebugger Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `startSession` | `(parser: Parser<any>, input: string) => DebugSession` | Start debugging session |
| `step` | `() => DebugStep` | Execute single parser step |
| `continue` | `() => void` | Continue execution |
| `setBreakpoint` | `(condition: (state: ParserState) => boolean) => void` | Set conditional breakpoint |
| `getCallStack` | `() => ParserFrame[]` | Get current call stack |

### Usage Examples

```typescript
import { debug, trace, profile, SVGBuilder, ParserDebugger } from '@doeixd/combi-parse/primitives';

// Basic debugging
const debuggedParser = debug(complexParser, {
  traceLevel: 'detailed',
  showPositions: true,
  logToConsole: true
});

// Performance profiling
const profiledParser = profile(expensiveParser);
const result = profiledParser.parse(input);
console.log('Parse time:', result.metrics.parseTime);
console.log('Memory used:', result.metrics.memoryUsage);

// Generate railroad diagram
const diagram = new SVGBuilder()
  .generateDiagram(grammarParser);
console.log(diagram); // SVG string

// Interactive debugging
const debugger = new ParserDebugger();
const session = debugger.startSession(parser, input);

session.setBreakpoint(state => state.index > 100);
while (!session.isComplete) {
  const step = session.step();
  console.log('Current step:', step);
}
```

---

## src/primitives/grammar.ts - Grammar Analysis and Optimization

Advanced grammar analysis, optimization, and formal language theory utilities.

### Analysis Types

| Export | Type | Description |
|--------|------|-------------|
| `GrammarAnalysis` | `interface` | Complete grammar analysis results |
| `FirstSets` | `type` | FIRST sets for grammar rules |
| `FollowSets` | `type` | FOLLOW sets for grammar rules |
| `ConflictReport` | `interface` | Grammar conflict analysis |

### Analysis Functions

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `analyzeGrammar` | `function` | `<T>(parser: Parser<T>) => GrammarAnalysis` | Comprehensive grammar analysis |
| `computeFirstSets` | `function` | `<T>(parser: Parser<T>) => FirstSets` | Compute FIRST sets |
| `computeFollowSets` | `function` | `<T>(parser: Parser<T>) => FollowSets` | Compute FOLLOW sets |
| `detectConflicts` | `function` | `<T>(parser: Parser<T>) => ConflictReport` | Detect grammar conflicts |

### Optimization Functions

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `optimizeGrammar` | `function` | `<T>(parser: Parser<T>) => Parser<T>` | Apply grammar optimizations |
| `eliminateLeftRecursion` | `function` | `<T>(parser: Parser<T>) => Parser<T>` | Remove left recursion |
| `factorCommonPrefixes` | `function` | `<T>(parser: Parser<T>) => Parser<T>` | Factor out common prefixes |
| `memoizeRecursive` | `function` | `<T>(parser: Parser<T>) => Parser<T>` | Intelligent memoization |

### Grammar Properties

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `isLL1` | `function` | `<T>(parser: Parser<T>) => boolean` | Check if grammar is LL(1) |
| `isLR1` | `function` | `<T>(parser: Parser<T>) => boolean` | Check if grammar is LR(1) |
| `isAmbiguous` | `function` | `<T>(parser: Parser<T>) => boolean` | Check for ambiguity |
| `computeComplexity` | `function` | `<T>(parser: Parser<T>) => ComplexityAnalysis` | Analyze parsing complexity |

### Usage Examples

```typescript
import { analyzeGrammar, optimizeGrammar, isLL1 } from '@doeixd/combi-parse/primitives';

// Analyze grammar properties
const analysis = analyzeGrammar(expressionParser);
console.log('LL(1):', analysis.isLL1);
console.log('Conflicts:', analysis.conflicts);
console.log('First sets:', analysis.firstSets);

// Optimize grammar automatically
const optimizedParser = optimizeGrammar(inefficientParser);
const speedup = benchmark(optimizedParser) / benchmark(inefficientParser);
console.log(`${speedup}x speedup after optimization`);

// Check grammar properties
if (!isLL1(myGrammar)) {
  console.warn('Grammar is not LL(1), consider refactoring');
}
```

---

## src/primitives/parallel-choice.ts - Parallel and Async Parsing

Parallel parsing strategies and asynchronous choice operations.

### Core Types

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `ParallelResult<T>` | `interface` | `<T>` | Result from parallel parsing |
| `WorkerParser<T>` | `class` | `<T>` | Web Worker-based parser |
| `ParallelStrategy` | `type` | - | `'race' \| 'all' \| 'fastest'` |

### Parallel Functions

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `parallelChoice` | `function` | `<T>(parsers: Parser<T>[], strategy?: ParallelStrategy) => Parser<T>` | Parse with multiple parsers in parallel |
| `raceParser` | `function` | `<T>(parsers: Parser<T>[]) => Parser<T>` | Return first successful result |
| `fastestParser` | `function` | `<T>(parsers: Parser<T>[]) => Parser<T>` | Return fastest result |
| `allParsers` | `function` | `<T>(parsers: Parser<T>[]) => Parser<T[]>` | Wait for all parsers to complete |

### Worker Support

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `WorkerParser.create` | `static function` | `<T>(parser: Parser<T>) => WorkerParser<T>` | Create worker-based parser |
| `WorkerParser.prototype.parse` | `method` | `(input: string) => Promise<T>` | Parse in worker thread |
| `WorkerParser.prototype.terminate` | `method` | `() => void` | Terminate worker |

### Usage Examples

```typescript
import { parallelChoice, WorkerParser, raceParser } from '@doeixd/combi-parse/primitives';

// Try multiple parsing strategies in parallel
const flexibleParser = parallelChoice([
  strictJsonParser,
  relaxedJsonParser,
  fallbackParser
], 'race'); // Use first successful result

// CPU-intensive parsing in worker
const workerParser = WorkerParser.create(complexLanguageParser);
const result = await workerParser.parse(largeCodeFile);

// Racing different algorithms
const fastParser = raceParser([
  recursiveDescentParser,
  lrParser,
  packratParser
]);
```

---

## src/primitives/pattern.ts - Advanced Pattern Matching

Type-safe pattern matching with literal type preservation and advanced regex features.

### Core Functions

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `pattern` | `function` | `<T extends string>(literal: T) => Parser<T>` | Type-safe literal pattern |
| `literalRegex` | `function` | `<T extends string>(pattern: T) => Parser<MatchResult<T>>` | Type-safe regex patterns |
| `enumPattern` | `function` | `<T extends readonly string[]>(values: T) => Parser<T[number]>` | Parse enum values |
| `unionPattern` | `function` | `<T extends string>(patterns: T[]) => Parser<T>` | Union of literal patterns |

### Pattern Utilities

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `caseInsensitive` | `function` | `<T extends string>(pattern: T) => Parser<T>` | Case-insensitive matching |
| `wordBoundary` | `function` | `<T>(parser: Parser<T>) => Parser<T>` | Ensure word boundaries |
| `exactly` | `function` | `<T>(parser: Parser<T>, count: number) => Parser<T[]>` | Parse exact count |
| `between` | `function` | `<T>(parser: Parser<T>, min: number, max: number) => Parser<T[]>` | Parse between min and max |

### Type-Safe Enums

```typescript
import { pattern, enumPattern, literalRegex } from '@doeixd/combi-parse/primitives';

// HTTP methods with full type safety
const httpMethod = enumPattern(['GET', 'POST', 'PUT', 'DELETE'] as const);
// Type: Parser<'GET' | 'POST' | 'PUT' | 'DELETE'>

// Boolean literals
const boolean = enumPattern(['true', 'false'] as const);
// Type: Parser<'true' | 'false'>

// Type-safe regex patterns
const ipOctet = literalRegex('[0-9]{1,3}');
const ipAddress = sequence([ipOctet, str('.'), ipOctet, str('.'), ipOctet, str('.'), ipOctet]);

// Case-insensitive keywords
const keyword = caseInsensitive(enumPattern(['IF', 'THEN', 'ELSE'] as const));
```

---

## src/primitives/recover.ts - Error Recovery Mechanisms

Sophisticated error recovery strategies for robust parsing in the presence of syntax errors.

### Recovery Types

| Export | Type | Description |
|--------|------|-------------|
| `RecoveryStrategy` | `interface` | Error recovery strategy configuration |
| `SyncPoint` | `interface` | Synchronization point for recovery |
| `ErrorContext` | `interface` | Context information for error recovery |

### Recovery Functions

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `recover` | `function` | `<T, U>(parser: Parser<T>, recovery: RecoveryStrategy<U>) => Parser<T \| U>` | Add error recovery to parser |
| `panic` | `function` | `<T>(syncTokens: Parser<any>[]) => Parser<T>` | Panic mode recovery |
| `synchronize` | `function` | `<T>(parser: Parser<T>, syncPoints: SyncPoint[]) => Parser<T>` | Synchronization recovery |
| `substitute` | `function` | `<T>(parser: Parser<T>, fallback: T) => Parser<T>` | Substitution recovery |

### Recovery Strategies

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `skipTo` | `function` | `(tokens: Parser<any>[]) => RecoveryStrategy<null>` | Skip to synchronization token |
| `insertMissing` | `function` | `<T>(value: T) => RecoveryStrategy<T>` | Insert missing token |
| `deleteBad` | `function` | `() => RecoveryStrategy<null>` | Delete bad token |
| `replaceWith` | `function` | `<T>(value: T) => RecoveryStrategy<T>` | Replace with correct value |

### Usage Examples

```typescript
import { recover, panic, synchronize, skipTo } from '@doeixd/combi-parse/primitives';

// Statement with error recovery
const statement = recover(
  statementParser,
  skipTo([str(';'), str('}'), str('\n')])
);

// Expression with panic mode recovery
const expression = panic([
  str(';'),
  str(')'),
  str('}')
]);

// Function declaration with multiple recovery points
const functionDecl = synchronize(
  functionParser,
  [
    { token: str('{'), action: 'continue' },
    { token: str('}'), action: 'complete' },
    { token: str(';'), action: 'abort' }
  ]
);

// Robust program parser
const program = many(
  recover(
    statement,
    {
      on: ['SyntaxError'],
      with: () => ({ type: 'error', message: 'Syntax error' }),
      skipTo: [str(';'), str('\n')]
    }
  )
);
```

---

## src/primitives/testing.ts - Comprehensive Testing Utilities

Advanced testing utilities including property-based testing, fuzzing, and coverage analysis.

### Testing Types

| Export | Type | Description |
|--------|------|-------------|
| `TestResult` | `interface` | Single test result |
| `PropertyTestResult` | `interface` | Property-based test result |
| `FuzzTestResult` | `interface` | Fuzz testing result |
| `CoverageReport` | `interface` | Code coverage analysis |

### Core Testing Class

| Export | Type | Description |
|--------|------|-------------|
| `ParserTester<T>` | `class` | Comprehensive parser testing framework |

#### ParserTester Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `test` | `(name: string, input: string, expected: T) => TestResult` | Single test case |
| `property` | `(name: string, prop: (input: any) => boolean) => PropertyTestResult` | Property-based test |
| `fuzz` | `(name: string, options: FuzzOptions) => FuzzTestResult` | Fuzz testing |
| `coverage` | `(testCases: TestCase[]) => CoverageReport` | Coverage analysis |
| `benchmark` | `(input: string, iterations: number) => BenchmarkResult` | Performance testing |

### Test Generators

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `generateTestCases` | `function` | `<T>(parser: Parser<T>, options: GenerationOptions) => TestCase<T>[]` | Generate test cases |
| `generateInputs` | `function` | `(grammar: Parser<any>, count: number) => string[]` | Generate valid inputs |
| `mutateInput` | `function` | `(input: string, mutations: MutationType[]) => string[]` | Generate mutations |
| `equivalenceTest` | `function` | `<T>(parser1: Parser<T>, parser2: Parser<T>) => EquivalenceResult` | Test parser equivalence |

### Fuzz Testing

| Export | Type | Description |
|--------|------|-------------|
| `FuzzOptions` | `interface` | Fuzz testing configuration |
| `MutationType` | `type` | `'insert' \| 'delete' \| 'replace' \| 'swap'` |
| `MutationStrategy` | `interface` | Mutation strategy configuration |

### Usage Examples

```typescript
import { ParserTester, generateTestCases, equivalenceTest } from '@doeixd/combi-parse/primitives';

// Comprehensive parser testing
const tester = new ParserTester(jsonParser);

// Unit tests
tester.test('simple object', '{"key": "value"}', { key: 'value' });
tester.test('array', '[1, 2, 3]', [1, 2, 3]);

// Property-based testing
tester.property('parse-stringify round trip', (obj: any) => {
  const json = JSON.stringify(obj);
  const parsed = jsonParser.parse(json);
  return JSON.stringify(parsed) === json;
});

// Fuzz testing
tester.fuzz('handles malformed input gracefully', {
  baseInputs: ['{"valid": "json"}', '[1, 2, 3]'],
  mutationRate: 0.1,
  maxLength: 1000,
  iterations: 10000
});

// Coverage analysis
const coverage = tester.coverage([
  { input: '{}', expected: {} },
  { input: '[]', expected: [] },
  { input: 'null', expected: null }
]);

console.log(`Parser coverage: ${coverage.percentage}%`);

// Test parser equivalence
const equivalence = equivalenceTest(optimizedParser, originalParser);
if (equivalence.isEquivalent) {
  console.log('Optimization preserves semantics');
} else {
  console.log('Differences found:', equivalence.differences);
}

// Automated test generation
const testCases = generateTestCases(emailParser, {
  validExamples: ['user@domain.com', 'test@example.org'],
  invalidExamples: ['invalid', '@domain.com'],
  count: 1000,
  mutationStrategies: ['typos', 'truncation', 'injection']
});

testCases.forEach(testCase => {
  const result = tester.test(testCase.name, testCase.input, testCase.expected);
  console.log(`${testCase.name}: ${result.passed ? 'PASS' : 'FAIL'}`);
});
```

## Usage Patterns

### Combining Primitives

```typescript
// Advanced parser using multiple primitives
import { 
  ast, recover, pattern, ParserAlgebra, analyzeGrammar 
} from '@doeixd/combi-parse/primitives';

const robustLanguageParser = recover(
  ast('Program', {
    statements: many(
      ParserAlgebra.intersect(
        statementParser,
        ParserAlgebra.complement(reservedWords)
      )
    )
  }),
  skipTo([str(';'), str('\n')])
);

// Analyze and optimize
const analysis = analyzeGrammar(robustLanguageParser);
if (!analysis.isLL1) {
  console.warn('Consider grammar refactoring for better performance');
}
```

### Testing Complex Parsers

```typescript
// Comprehensive testing setup
const tester = new ParserTester(complexParser);

// Property-based testing
tester.property('idempotent parsing', (input: string) => {
  const result1 = complexParser.parse(input);
  const serialized = serialize(result1);
  const result2 = complexParser.parse(serialized);
  return deepEqual(result1, result2);
});

// Fuzz testing with mutations
tester.fuzz('robustness testing', {
  mutationStrategies: ['typos', 'truncation', 'insertion', 'deletion'],
  iterations: 50000,
  maxLength: 10000
});

// Coverage-driven test generation
const coverage = tester.coverage(existingTests);
if (coverage.percentage < 90) {
  const additionalTests = generateTestCases(complexParser, {
    targetCoverage: 95,
    focusOnUncovered: true
  });
}
```

### Performance Optimization

```typescript
// Performance analysis and optimization
import { profile, optimizeGrammar, memoizeRecursive } from '@doeixd/combi-parse/primitives';

const profiledParser = profile(originalParser);
const result = profiledParser.parse(largeInput);

console.log('Hotspots:', result.metrics.hotspots);
console.log('Memory usage:', result.metrics.memoryUsage);

// Apply optimizations based on analysis
const optimizedParser = memoizeRecursive(
  optimizeGrammar(originalParser)
);

const speedup = benchmark(optimizedParser) / benchmark(originalParser);
console.log(`${speedup}x performance improvement`);
```

---

## src/primitives/regex-combinator.ts - Type-Safe Regex Combinator

Type-safe regex combinator parser that leverages the compile-time regex engine for full type safety and precise pattern matching.

### Core Functions

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `typedRegex` | `function` | `<Pattern extends string>(pattern: Pattern) => Parser<string>` | Type-safe regex parser (performance optimized) |
| `advancedTypedRegex` | `function` | `<Pattern extends string>(pattern: Pattern) => Parser<Enumerate<CompileRegex<Pattern>>>` | ⚠️ Full type-safe regex with compile-time analysis (may slow TypeScript) |
| `typedChar` | `function` | `<Pattern extends string>(pattern: Pattern) => Parser<string>` | Optimized single character pattern parser |
| `compilePattern` | `function` | `<Pattern extends string>(pattern: Pattern) => Parser<string>` | Compile and validate regex pattern (performance optimized) |
| `advancedCompilePattern` | `function` | `<Pattern extends string>(pattern: Pattern) => Parser<Enumerate<CompileRegex<Pattern>>>` | ⚠️ Full compile-time pattern validation (may slow TypeScript) |
| `testPattern` | `function` | `<Pattern extends string>(pattern: Pattern) => (input: string) => boolean` | Type-safe pattern testing function |
| `anyOf` | `function` | `<const Strings extends readonly string[]>(strings: Strings) => Parser<Strings[number]>` | Type-safe string alternation parser |

### Key Features

- **Dual Implementation**: Choose between performance (`typedRegex`) and full type safety (`advancedTypedRegex`)
- **Compile-time Pattern Analysis**: Advanced functions analyze patterns at TypeScript compile time
- **Performance Optimized**: Standard functions provide regex validation without TypeScript server impact
- **Precise Return Types**: Advanced functions return exact union types of all possible matching strings
- **Template Literal Support**: Infinite patterns use template literal types for type safety
- **Runtime Performance**: Efficient JavaScript RegExp execution with optional compile-time type benefits
- **TypeScript Server Friendly**: Clear warnings about performance impact of advanced features

### Performance Guidelines

| Function | Performance | Type Safety | When to Use |
|----------|-------------|-------------|-------------|
| `typedRegex()` | ✅ Fast | Basic | Production code, complex patterns, performance-critical |
| `advancedTypedRegex()` | ⚠️ May slow TS | Full | Simple patterns, development, when precise types needed |
| `typedChar()` | ✅ Very Fast | Basic | Single characters, high-frequency parsing |
| `compilePattern()` | ✅ Fast | Basic | When compile-time validation name is preferred |
| `advancedCompilePattern()` | ⚠️ May slow TS | Full | Simple patterns needing full type analysis |

### Supported Pattern Features

| Feature | Syntax | Example | Type Result |
|---------|--------|---------|-------------|
| **Literals** | `'abc'` | `typedRegex('hello')` | `'hello'` |
| **Character Classes** | `'[abc]'`, `'[0-9]'`, `'[a-z]'` | `typedRegex('[0-9]')` | `'0'\|'1'\|'2'\|...\|'9'` |
| **Escape Sequences** | `'\\d'`, `'\\w'`, `'\\s'`, `'\\D'`, `'\\W'`, `'\\S'` | `typedRegex('\\d')` | `Digit` union type |
| **Quantifiers** | `'*'`, `'+'`, `'?'` | `typedRegex('a+')` | `\`a${string}\`` |
| **Alternation** | `'cat\|dog'` | `typedRegex('cat\|dog')` | `'cat'\|'dog'` |
| **Grouping** | `'(ab)+c'` | `typedRegex('(ab)+c')` | `\`a${string}\`` |
| **Wildcards** | `'.'` | `typedRegex('.')` | `Printable` union type |

### Usage Examples

```typescript
import { 
  typedRegex, 
  advancedTypedRegex, 
  typedChar, 
  anyOf, 
  testPattern 
} from '@doeixd/combi-parse/primitives';

// ============================================================================
// PERFORMANCE-OPTIMIZED VERSIONS (Recommended for most use cases)
// ============================================================================

// Basic literal patterns - fast compilation, basic typing
const hello = typedRegex('hello');
hello.parse('hello'); // ✓ Type: string (validates 'hello' at runtime)

// Complex patterns - use these for production
const email = typedRegex('[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}');
const identifier = typedRegex('[a-zA-Z_][a-zA-Z0-9_]*');
const whitespace = typedRegex('\\s+');

// ============================================================================  
// ADVANCED TYPE-SAFE VERSIONS (Use carefully - may slow TypeScript)
// ============================================================================

// ✅ Safe patterns - these work well with full type analysis
const animal = advancedTypedRegex('cat|dog');
animal.parse('cat'); // ✓ Type: 'cat'|'dog'

const digit = advancedTypedRegex('[0-9]');
digit.parse('5'); // ✓ Type: '0'|'1'|'2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'

const boolean = advancedTypedRegex('true|false');
boolean.parse('true'); // ✓ Type: 'true'|'false'

const httpStatus = advancedTypedRegex('200|404|500');
httpStatus.parse('200'); // ✓ Type: '200'|'404'|'500'

const optional = advancedTypedRegex('colou?r');
optional.parse('color'); // ✓ Type: 'color'|'colour'

// ⚠️ These patterns may slow down TypeScript server - avoid in large projects
// const complexPattern = advancedTypedRegex('(a|b)+c*'); // May cause issues
// const largeClass = advancedTypedRegex('[a-zA-Z0-9_]+'); // May cause issues

// ============================================================================
// PRACTICAL USAGE PATTERNS
// ============================================================================

// Optimized single character parsing
const a = typedChar('a');
a.parse('a'); // ✓ Type: string

// Type-safe string alternation (always safe)
const httpMethod = anyOf(['GET', 'POST', 'PUT', 'DELETE'] as const);
httpMethod.parse('GET'); // ✓ Type: 'GET'|'POST'|'PUT'|'DELETE'

// Pattern testing for conditional logic
const isDigit = testPattern('[0-9]');
if (isDigit(input)) {
  console.log('Found digit:', input);
}

// Best practice: Use simple version for complex patterns
const jsonString = typedRegex('"[^"]*"');
const phoneNumber = typedRegex('\\+?[0-9-() ]+');
const cssColor = typedRegex('#[0-9a-fA-F]{3,6}');
```

### Integration with Parser Combinators

```typescript
// Use with sequence for complex parsing
const identifier = typedRegex('[a-zA-Z_][a-zA-Z0-9_]*');
const assignment = sequence([
  identifier,
  typedRegex('\\s*=\\s*'),
  typedRegex('[0-9]+')
] as const);

assignment.parse('myVar = 42');
// Result is typed as tuple with precise string literal types

// Use with choice for flexible parsing
const value = choice([
  typedRegex('[0-9]+').map(Number),
  typedRegex('"[^"]*"'),
  anyOf(['true', 'false'] as const).map(s => s === 'true')
]);

// Type-safe parsing with precise error messages
const email = typedRegex('[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}');
try {
  const result = email.parse(input);
  // result has precise type information
} catch (error) {
  // TypeScript knows exactly what pattern failed
}
```

### Advanced Usage Patterns

```typescript
// Conditional parsing based on pattern matching
const parseValue = (input: string) => {
  if (testPattern('[0-9]+', input)) {
    return typedRegex('[0-9]+').map(Number).parse(input);
  } else if (testPattern('"[^"]*"', input)) {
    return typedRegex('"[^"]*"').map(s => s.slice(1, -1)).parse(input);
  } else {
    return typedRegex('[a-zA-Z_][a-zA-Z0-9_]*').parse(input);
  }
};

// Building domain-specific languages with type safety
const cssColor = choice([
  typedRegex('#[0-9a-fA-F]{6}'),      // Hex colors
  typedRegex('#[0-9a-fA-F]{3}'),      // Short hex  
  anyOf(['red', 'green', 'blue', 'black', 'white'] as const), // Named colors
  typedRegex('rgb\\([0-9]{1,3},[0-9]{1,3},[0-9]{1,3}\\)')   // RGB function
]);

// Type-safe configuration parsing
const configValue = choice([
  typedRegex('[0-9]+').map(Number),
  anyOf(['true', 'false'] as const).map(s => s === 'true'),
  typedRegex('"[^"]*"').map(s => s.slice(1, -1)),
  typedRegex('[a-zA-Z0-9_-]+')  // Bare identifiers
]);

const configLine = sequence([
  typedRegex('[a-zA-Z_][a-zA-Z0-9_]*'),  // Key
  typedRegex('\\s*=\\s*'),               // Equals
  configValue                            // Value
] as const, ([key, , value]) => ({ [key]: value }));
```

### Performance Considerations

- **Compile-time Analysis**: Pattern validation happens at compile time with no runtime cost
- **Efficient Execution**: Uses optimized JavaScript RegExp for runtime parsing
- **Type-only Operations**: Type computations don't affect bundle size or runtime performance
- **Optimized Single Characters**: `typedChar` provides faster path for simple character matches
- **Memory Efficient**: Template literal types represent infinite patterns without memory overhead

### Comparison with Runtime Regex

| Feature | `regex()` (Runtime) | `typedRegex()` (Compile-time) |
|---------|-------------------|------------------------------|
| **Type Safety** | `string` | Precise union/template types |
| **Pattern Validation** | Runtime errors | Compile-time errors |
| **IntelliSense** | Generic string | Exact completions |
| **Performance** | Fast | Fast + compile-time analysis |
| **Flexibility** | Dynamic patterns | Static patterns only |
| **Error Messages** | Generic | Pattern-specific |

### Choosing the Right Function

#### Decision Matrix

| Scenario | Recommended Function | Reason |
|----------|---------------------|---------|
| **Production Applications** | `typedRegex()` | Fast compilation, reliable performance |
| **Complex Regex Patterns** | `typedRegex()` | Avoids TypeScript server issues |
| **Large Codebases** | `typedRegex()` | Maintains build performance |
| **Simple String Literals** | `advancedTypedRegex()` | Full type safety without performance cost |
| **Enum-like Patterns** | `anyOf()` or `advancedTypedRegex()` | Perfect type safety for small sets |
| **Development/Prototyping** | `advancedTypedRegex()` | Maximum type information for debugging |
| **Single Characters** | `typedChar()` | Optimized performance |
| **String Alternations** | `anyOf()` | Best ergonomics and type safety |

#### Performance Impact Examples

```typescript
// ✅ These patterns are safe with advancedTypedRegex
const simplePatterns = [
  advancedTypedRegex('hello'),           // Literal
  advancedTypedRegex('cat|dog'),         // Simple alternation  
  advancedTypedRegex('[0-9]'),           // Single char class
  advancedTypedRegex('a?'),              // Simple optional
  advancedTypedRegex('true|false'),      // Boolean enum
  anyOf(['red', 'green', 'blue'] as const) // String enum
];

// ⚠️ Use typedRegex for these to avoid TypeScript server issues
const complexPatterns = [
  typedRegex('[a-zA-Z_][a-zA-Z0-9_]*'),     // Identifier pattern
  typedRegex('\\d{4}-\\d{2}-\\d{2}'),       // Date pattern
  typedRegex('(\\w+\\.)+\\w+'),             // Domain pattern
  typedRegex('[^"]*'),                      // String content
  typedRegex('\\s+'),                       // Whitespace
  typedRegex('.+')                          // Any content
];
```

#### Migration Strategy

```typescript
// Start with simple version for reliability
const parser = typedRegex('[a-zA-Z]+');

// If you need precise types and pattern is simple, upgrade
const preciseParser = advancedTypedRegex('GET|POST|PUT|DELETE');

// For enums, use anyOf for best experience  
const method = anyOf(['GET', 'POST', 'PUT', 'DELETE'] as const);
```

### When to Use vs Runtime Regex

- **Use `typedRegex`** for compile-time pattern validation with good performance
- **Use `advancedTypedRegex`** for maximum type safety on simple patterns
- **Use `regex()`** when you need dynamic pattern construction or runtime flexibility
- **Use `typedChar`** for simple single character or character class patterns
- **Use `anyOf`** for string literal alternations with better ergonomics than manual patterns

The typed regex combinator bridges the gap between runtime flexibility and compile-time type safety, providing options for every performance and type safety requirement.

---

The primitives provide the foundational building blocks for advanced parsing scenarios, offering mathematical rigor, comprehensive testing, debugging capabilities, performance optimization tools, and now type-safe regex parsing that enables building production-ready parsing systems with full compile-time guarantees.
