# Generator API Reference

This document provides comprehensive API documentation for the generator-based parsing modules.

## src/parsers/generator/index.ts - Generator Entry Point

Re-exports all generator-based parsing functionality.

| Export | Source | Description |
|--------|--------|-------------|
| **All Generator Core** | `./generator` | Core generator parser implementation |
| **All Async** | `./async` | Asynchronous generator utilities |
| **All Combinators** | `./combinators` | Generator-based combinators |
| **All Control Flow** | `./control-flow` | Control flow utilities |
| **All Patterns** | `./patterns` | Common parsing patterns |
| **All State** | `./state` | Stateful parsing utilities |
| **All Options** | `./with-options` | Enhanced debugging options |
| `genParser` | `./generator` | Main generator parser function |

---

## src/parsers/generator/generator.ts - Core Generator Implementation

The main generator-based parser implementation with natural imperative syntax.

### Types

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `GeneratorParser<T>` | `class` | `<T>` | Generator-based parser class |
| `GeneratorFunction<T>` | `type` | `<T>` | Generator function signature |
| `YieldResult<T>` | `type` | `<T>` | Result of yield expression |
| `GeneratorState` | `interface` | - | Generator parsing state |

### Core Functions

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `gen` | `function` | `<T>(genFn: GeneratorFunction<T>) => Parser<T>` | Create generator parser |
| `genParser` | `function` | `<T>(genFn: GeneratorFunction<T>) => Parser<T>` | Alias for `gen` |
| `yield*` | `keyword` | `<T>(parser: Parser<T>) => T` | Delegate to another generator |
| `return` | `keyword` | `<T>(value: T) => T` | Return value from generator |

### Generator Utilities

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `peek` | `function` | `<T>(parser: Parser<T>) => GeneratorParser<T>` | Look ahead without consuming |
| `consume` | `function` | `(chars: number) => GeneratorParser<string>` | Consume specific character count |
| `position` | `GeneratorParser<number>` | Get current parsing position |
| `remaining` | `GeneratorParser<string>` | Get remaining input |

### Error Handling

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `expect` | `function` | `<T>(parser: Parser<T>, message: string) => GeneratorParser<T>` | Parse with custom error message |
| `attempt` | `function` | `<T>(parser: Parser<T>) => GeneratorParser<T \| null>` | Try parser without consuming on failure |
| `recover` | `function` | `<T>(parser: Parser<T>, recovery: () => T) => GeneratorParser<T>` | Recover from parse failures |

### Usage Examples

```typescript
import { gen, str, regex } from '@doeixd/combi-parse';

const jsonValue = gen(function*() {
  const firstChar = yield peek(regex(/./));
  
  if (firstChar === '"') {
    return yield stringLiteral;
  } else if (firstChar === '[') {
    return yield arrayLiteral;
  } else if (firstChar === '{') {
    return yield objectLiteral;
  } else if (/\d/.test(firstChar)) {
    return yield numberLiteral;
  } else {
    throw new Error(`Unexpected character: ${firstChar}`);
  }
});

const functionDeclaration = gen(function*() {
  yield str('function');
  const name = yield identifier;
  yield str('(');
  
  const params = [];
  let param = yield attempt(identifier);
  while (param) {
    params.push(param);
    const hasComma = yield attempt(str(','));
    if (!hasComma) break;
    param = yield identifier;
  }
  
  yield str(')');
  yield str('{');
  const body = yield many(statement);
  yield str('}');
  
  return {
    type: 'FunctionDeclaration',
    name,
    params,
    body
  };
});
```

---

## src/parsers/generator/async.ts - Asynchronous Generator Utilities

Utilities for asynchronous generator-based parsing.

### Types

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `AsyncGeneratorParser<T>` | `class` | `<T>` | Async generator parser |
| `AsyncGeneratorFunction<T>` | `type` | `<T>` | Async generator function signature |
| `AwaitResult<T>` | `type` | `<T>` | Result of await expression |

### Core Functions

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `asyncGen` | `function` | `<T>(genFn: AsyncGeneratorFunction<T>) => AsyncParser<T>` | Create async generator parser |
| `await` | `keyword` | `<T>(promise: Promise<T>) => T` | Await promise in generator |
| `parallel` | `function` | `<T>(parsers: Parser<T>[]) => AsyncGeneratorParser<T[]>` | Parse in parallel |

### Stream Integration

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `fromStream` | `function` | `<T>(stream: ReadableStream<T>) => AsyncGeneratorParser<T>` | Parse from stream |
| `toStream` | `function` | `<T>(parser: AsyncGeneratorParser<T>) => ReadableStream<T>` | Convert to stream |
| `pipeline` | `function` | `<T, U>(input: AsyncGeneratorParser<T>, transform: (value: T) => U)` | Transform async results |

### Usage Examples

```typescript
import { asyncGen, await, parallel } from '@doeixd/combi-parse/generator';

const fetchAndParse = asyncGen(function*() {
  const response = yield await fetch('/api/data');
  const text = yield await response.text();
  return yield jsonParser.parse(text);
});

const parallelParse = asyncGen(function*() {
  const results = yield parallel([
    parserA,
    parserB,
    parserC
  ]);
  return combineResults(results);
});
```

---

## src/parsers/generator/combinators.ts - Generator Combinators

Generator-based equivalents of traditional parser combinators.

### Sequence Combinators

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `seq` | `function` | `<T extends readonly unknown[]>(...parsers: T) => GeneratorParser<T>` | Parse sequence using generators |
| `all` | `function` | `<T>(parsers: Parser<T>[]) => GeneratorParser<T[]>` | Parse all parsers in sequence |
| `pipe` | `function` | `<T, U>(parser: Parser<T>, transform: (value: T) => U)` | Transform with generator |

### Choice Combinators

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `oneOf` | `function` | `<T>(...parsers: Parser<T>[]) => GeneratorParser<T>` | Try parsers in order |
| `anyOf` | `function` | `<T>(parsers: Parser<T>[]) => GeneratorParser<T>` | Try any parser |
| `firstOf` | `function` | `<T>(...parsers: Parser<T>[]) => GeneratorParser<T>` | Return first successful result |

### Repetition Combinators

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `repeat` | `function` | `<T>(parser: Parser<T>, count: number) => GeneratorParser<T[]>` | Parse exact count |
| `repeatUntil` | `function` | `<T>(parser: Parser<T>, condition: Parser<any>)` | Parse until condition |
| `repeatWhile` | `function` | `<T>(parser: Parser<T>, condition: Parser<any>)` | Parse while condition |
| `collect` | `function` | `<T>(parser: Parser<T>) => GeneratorParser<T[]>` | Collect all results |

### Conditional Combinators

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `when` | `function` | `<T>(condition: boolean, parser: Parser<T>)` | Conditional parsing |
| `unless` | `function` | `<T>(condition: boolean, parser: Parser<T>)` | Negative conditional |
| `ifThen` | `function` | `<T, U>(condition: Parser<T>, then: Parser<U>)` | If-then parsing |
| `ifThenElse` | `function` | `<T, U, V>(condition: Parser<T>, then: Parser<U>, else_: Parser<V>)` | If-then-else parsing |

### Usage Examples

```typescript
import { seq, oneOf, repeat, when } from '@doeixd/combi-parse/generator';

// Using generator combinators
const declaration = gen(function*() {
  const [keyword, name, eq, value] = yield seq(
    str('let'),
    identifier,
    str('='),
    expression
  );
  
  return { keyword, name, value };
});

const statement = gen(function*() {
  return yield oneOf(
    declaration,
    assignment,
    expressionStatement
  );
});
```

---

## src/parsers/generator/control-flow.ts - Control Flow Utilities

Advanced control flow constructs for generator parsers.

### Looping Constructs

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `while` | `function` | `<T>(condition: () => boolean, parser: Parser<T>)` | While loop construct |
| `for` | `function` | `<T>(init: () => void, condition: () => boolean, increment: () => void, parser: Parser<T>)` | For loop construct |
| `forEach` | `function` | `<T, U>(items: T[], parser: (item: T) => Parser<U>)` | For-each construct |
| `until` | `function` | `<T>(condition: () => boolean, parser: Parser<T>)` | Until loop construct |

### Branching Constructs

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `match` | `function` | `<T, U>(value: T, cases: Record<string, Parser<U>>)` | Pattern matching |
| `switch` | `function` | `<T, U>(value: T, cases: Array<[T, Parser<U>]>)` | Switch statement |
| `cond` | `function` | `<T>(conditions: Array<[() => boolean, Parser<T>]>)` | Conditional branching |

### Exception Handling

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `try` | `function` | `<T>(parser: Parser<T>) => GeneratorParser<T \| Error>` | Try-catch construct |
| `catch` | `function` | `<T>(parser: Parser<T>, handler: (error: Error) => T)` | Catch exceptions |
| `finally` | `function` | `<T>(parser: Parser<T>, cleanup: () => void)` | Finally block |
| `throw` | `function` | `(error: Error) => GeneratorParser<never>` | Throw exception |

### Usage Examples

```typescript
import { while, match, try, catch } from '@doeixd/combi-parse/generator';

const parseBlock = gen(function*() {
  const statements = [];
  
  yield while(
    () => !yield peek(str('}')),
    gen(function*() {
      const stmt = yield statement;
      statements.push(stmt);
    })
  );
  
  return statements;
});

const parseValue = gen(function*() {
  const type = yield identifier;
  
  return yield match(type, {
    'number': numberLiteral,
    'string': stringLiteral,
    'boolean': booleanLiteral,
    'null': nullLiteral
  });
});
```

---

## src/parsers/generator/patterns.ts - Common Parsing Patterns

Reusable parsing patterns implemented as generators.

### Token Patterns

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `token` | `function` | `<T>(parser: Parser<T>) => GeneratorParser<T>` | Parse token with whitespace |
| `keyword` | `function` | `(word: string) => GeneratorParser<string>` | Parse keyword token |
| `operator` | `function` | `(op: string) => GeneratorParser<string>` | Parse operator token |
| `punctuation` | `function` | `(punct: string) => GeneratorParser<string>` | Parse punctuation token |

### Literal Patterns

| Export | Type | Description |
|--------|------|-------------|
| `stringLiteral` | `GeneratorParser<string>` | Parse string literals |
| `numberLiteral` | `GeneratorParser<number>` | Parse number literals |
| `booleanLiteral` | `GeneratorParser<boolean>` | Parse boolean literals |
| `nullLiteral` | `GeneratorParser<null>` | Parse null literal |

### Structure Patterns

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `list` | `function` | `<T>(parser: Parser<T>, separator: string) => GeneratorParser<T[]>` | Parse separated list |
| `pair` | `function` | `<K, V>(keyParser: Parser<K>, valueParser: Parser<V>) => GeneratorParser<[K, V]>` | Parse key-value pair |
| `object` | `function` | `<T>(parser: Parser<T>) => GeneratorParser<Record<string, T>>` | Parse object structure |
| `array` | `function` | `<T>(parser: Parser<T>) => GeneratorParser<T[]>` | Parse array structure |

### Expression Patterns

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `binaryExpression` | `function` | `<T>(left: Parser<T>, operator: Parser<string>, right: Parser<T>)` | Parse binary expression |
| `unaryExpression` | `function` | `<T>(operator: Parser<string>, operand: Parser<T>)` | Parse unary expression |
| `callExpression` | `function` | `<T>(callee: Parser<T>, args: Parser<T[]>)` | Parse function call |
| `memberExpression` | `function` | `<T>(object: Parser<T>, property: Parser<string>)` | Parse member access |

### Usage Examples

```typescript
import { token, list, binaryExpression, object } from '@doeixd/combi-parse/generator';

const parseArray = gen(function*() {
  yield token(str('['));
  const elements = yield list(expression, ',');
  yield token(str(']'));
  return elements;
});

const parseObject = gen(function*() {
  yield token(str('{'));
  const pairs = yield list(
    gen(function*() {
      const key = yield stringLiteral;
      yield token(str(':'));
      const value = yield expression;
      return [key, value];
    }),
    ','
  );
  yield token(str('}'));
  return Object.fromEntries(pairs);
});
```

---

## src/parsers/generator/state.ts - Stateful Parsing Utilities

Utilities for maintaining and manipulating state during generator parsing.

### State Management

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `withState` | `function` | `<S, T>(initialState: S, parser: (state: S) => GeneratorParser<T>)` | Parse with state |
| `getState` | `function` | `<S>() => GeneratorParser<S>` | Get current state |
| `setState` | `function` | `<S>(state: S) => GeneratorParser<void>` | Set current state |
| `updateState` | `function` | `<S>(updater: (state: S) => S) => GeneratorParser<void>` | Update current state |

### State Scoping

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `pushState` | `function` | `<S>(state: S) => GeneratorParser<void>` | Push state onto stack |
| `popState` | `function` | `<S>() => GeneratorParser<S>` | Pop state from stack |
| `withScope` | `function` | `<S, T>(state: S, parser: GeneratorParser<T>)` | Parse with scoped state |
| `isolateState` | `function` | `<T>(parser: GeneratorParser<T>) => GeneratorParser<T>` | Isolate state changes |

### Context Variables

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `setVar` | `function` | `<T>(name: string, value: T) => GeneratorParser<void>` | Set context variable |
| `getVar` | `function` | `<T>(name: string) => GeneratorParser<T>` | Get context variable |
| `hasVar` | `function` | `(name: string) => GeneratorParser<boolean>` | Check if variable exists |
| `deleteVar` | `function` | `(name: string) => GeneratorParser<void>` | Delete context variable |

### State Queries

| Export | Type | Description |
|--------|------|-------------|
| `getPosition` | `GeneratorParser<number>` | Get current parse position |
| `getLine` | `GeneratorParser<number>` | Get current line number |
| `getColumn` | `GeneratorParser<number>` | Get current column number |
| `getInput` | `GeneratorParser<string>` | Get original input string |

### Usage Examples

```typescript
import { withState, getState, updateState, setVar, getVar } from '@doeixd/combi-parse/generator';

const parseWithIndentation = withState(0, gen(function*() {
  const indentLevel = yield getState();
  
  // Parse current line indentation
  const spaces = yield regex(/^ */);
  const currentIndent = spaces.length;
  
  if (currentIndent > indentLevel) {
    yield updateState(level => currentIndent);
    const block = yield many(statement);
    yield updateState(level => indentLevel); // Restore
    return block;
  } else {
    return yield statement;
  }
}));

const parseWithSymbolTable = gen(function*() {
  yield setVar('symbols', new Map());
  
  const declarations = yield many(gen(function*() {
    const name = yield identifier;
    const type = yield typeAnnotation;
    
    const symbols = yield getVar('symbols');
    symbols.set(name, type);
    yield setVar('symbols', symbols);
    
    return { name, type };
  }));
  
  return declarations;
});
```

---

## src/parsers/generator/with-options.ts - Enhanced Debugging Options

Enhanced parser debugging and development tools for generator parsers.

### Debugging Options

| Export | Type | Description |
|--------|------|-------------|
| `DebugOptions` | `interface` | Configuration for debug output |
| `TraceLevel` | `type` | `'none' \| 'basic' \| 'detailed' \| 'verbose'` |
| `LogFormat` | `type` | `'text' \| 'json' \| 'structured'` |

### Debug Functions

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `withDebug` | `function` | `<T>(parser: GeneratorParser<T>, options: DebugOptions)` | Add debugging to parser |
| `trace` | `function` | `<T>(parser: GeneratorParser<T>, label: string)` | Trace parser execution |
| `log` | `function` | `(message: string, level?: TraceLevel) => GeneratorParser<void>` | Log message during parsing |
| `breakpoint` | `function` | `() => GeneratorParser<void>` | Add debugging breakpoint |

### Performance Monitoring

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `withTiming` | `function` | `<T>(parser: GeneratorParser<T>, label: string)` | Measure parsing time |
| `profile` | `function` | `<T>(parser: GeneratorParser<T>) => GeneratorParser<T>` | Profile parser performance |
| `benchmark` | `function` | `<T>(parser: GeneratorParser<T>, iterations: number)` | Benchmark parser |

### Visualization

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `visualize` | `function` | `<T>(parser: GeneratorParser<T>) => string` | Generate parse tree visualization |
| `flowChart` | `function` | `<T>(parser: GeneratorParser<T>) => string` | Generate flow chart |
| `callGraph` | `function` | `<T>(parser: GeneratorParser<T>) => string` | Generate call graph |

### Usage Examples

```typescript
import { withDebug, trace, log, withTiming } from '@doeixd/combi-parse/generator';

const debugParser = withDebug(
  gen(function*() {
    yield log('Starting expression parsing');
    
    const left = yield trace(term, 'left-term');
    yield log(`Parsed left term: ${left}`);
    
    const operator = yield trace(str('+'), 'operator');
    const right = yield trace(term, 'right-term');
    
    yield log(`Parsed binary expression: ${left} ${operator} ${right}`);
    return { type: 'binary', left, operator, right };
  }),
  {
    traceLevel: 'detailed',
    logFormat: 'structured',
    showPositions: true,
    showTiming: true
  }
);

const timedParser = withTiming(
  gen(function*() {
    const result = yield complexExpression;
    yield log(`Parsed complex expression in ${performance.now()}ms`);
    return result;
  }),
  'complex-expression'
);
```

## Usage Patterns

### Basic Generator Usage

```typescript
import { gen, str, regex } from '@doeixd/combi-parse';

const simpleParser = gen(function*() {
  yield str('hello');
  const name = yield regex(/\w+/);
  return `Hello, ${name}!`;
});
```

### Advanced Generator Patterns

```typescript
import { gen, attempt, oneOf, repeat } from '@doeixd/combi-parse/generator';

const complexParser = gen(function*() {
  const results = [];
  
  // Conditional parsing
  const hasHeader = yield attempt(str('header:'));
  if (hasHeader) {
    results.push(yield headerParser);
  }
  
  // Loop with exit condition
  while (true) {
    const item = yield attempt(itemParser);
    if (!item) break;
    results.push(item);
    
    const separator = yield attempt(str(','));
    if (!separator) break;
  }
  
  return results;
});
```

### Error Handling

```typescript
import { gen, expect, recover } from '@doeixd/combi-parse/generator';

const robustParser = gen(function*() {
  try {
    const result = yield expect(fragileParser, 'Expected valid input');
    return result;
  } catch (error) {
    return yield recover(
      fallbackParser,
      () => ({ type: 'error', message: error.message })
    );
  }
});
```

### State Management

```typescript
import { gen, withState, getState, updateState } from '@doeixd/combi-parse/generator';

const statefulParser = withState({ depth: 0 }, gen(function*() {
  yield updateState(state => ({ ...state, depth: state.depth + 1 }));
  
  const result = yield complexParser;
  
  const currentState = yield getState();
  if (currentState.depth > 10) {
    throw new Error('Maximum depth exceeded');
  }
  
  return result;
}));
```
