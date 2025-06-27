# Performance Optimization

This guide covers techniques for optimizing parser performance in Combi-Parse, from basic optimizations to advanced performance engineering.

## Understanding Parser Performance

### Performance Characteristics

Parser combinators have different performance characteristics than hand-written parsers:

- **Overhead**: Function call overhead for each combinator
- **Backtracking**: Can lead to exponential time complexity
- **Memory**: Stack usage and intermediate result allocation
- **Composition**: Deep combinator chains can be expensive

### Measuring Performance

Before optimizing, establish baselines:

```typescript
const benchmark = <T>(
  parser: Parser<T>, 
  input: string, 
  iterations = 1000
): { time: number; avgTime: number; memory?: number } => {
  const startMemory = process.memoryUsage().heapUsed;
  const start = performance.now();
  
  for (let i = 0; i < iterations; i++) {
    parser.parse(input);
  }
  
  const end = performance.now();
  const endMemory = process.memoryUsage().heapUsed;
  
  return {
    time: end - start,
    avgTime: (end - start) / iterations,
    memory: endMemory - startMemory
  };
};

// Usage
const stats = benchmark(jsonParser, '{"name": "John", "age": 30}');
console.log(`Total: ${stats.time.toFixed(2)}ms, Avg: ${stats.avgTime.toFixed(4)}ms per parse`);
```

### Profiling Parser Execution

Create profiling tools to identify bottlenecks:

```typescript
interface ProfileInfo {
  parserName: string;
  calls: number;
  totalTime: number;
  ownTime: number;
  children: Map<string, ProfileInfo>;
}

const createProfiler = () => {
  const profiles = new Map<string, ProfileInfo>();
  const callStack: string[] = [];
  
  const profile = <T>(parser: Parser<T>, name: string): Parser<T> =>
    new Parser(state => {
      const start = performance.now();
      callStack.push(name);
      
      if (!profiles.has(name)) {
        profiles.set(name, {
          parserName: name,
          calls: 0,
          totalTime: 0,
          ownTime: 0,
          children: new Map()
        });
      }
      
      const info = profiles.get(name)!;
      info.calls++;
      
      const result = parser.run(state);
      
      const end = performance.now();
      const elapsed = end - start;
      
      info.totalTime += elapsed;
      callStack.pop();
      
      // Add to parent's children if there's a parent
      if (callStack.length > 0) {
        const parentName = callStack[callStack.length - 1];
        const parent = profiles.get(parentName)!;
        if (!parent.children.has(name)) {
          parent.children.set(name, { ...info });
        }
      }
      
      return result;
    });
  
  const getReport = () => {
    const report: string[] = [];
    
    profiles.forEach(info => {
      report.push(`${info.parserName}: ${info.calls} calls, ${info.totalTime.toFixed(2)}ms total, ${(info.totalTime / info.calls).toFixed(4)}ms avg`);
    });
    
    return report.join('\n');
  };
  
  return { profile, getReport, profiles };
};
```

## Basic Optimizations

### Avoid Unnecessary Allocations

Minimize object creation in hot paths:

```typescript
// Inefficient: creates new arrays
const inefficientMany = <T>(parser: Parser<T>): Parser<T[]> =>
  parser.chain(first =>
    inefficientMany(parser).map(rest => [first, ...rest])
  ).or(succeed([]));

// Better: reuse arrays
const efficientMany = <T>(parser: Parser<T>): Parser<T[]> =>
  new Parser(state => {
    const results: T[] = [];
    let currentState = state;
    
    while (true) {
      const result = parser.run(currentState);
      if (result.type === 'failure') {
        return success(results, currentState);
      }
      
      if (result.state.index === currentState.index) {
        return failure('Infinite loop detected', state);
      }
      
      results.push(result.value);
      currentState = result.state;
    }
  });
```

### Optimize Common Patterns

Cache frequently used parsers:

```typescript
// Create singletons for common parsers
const Tokens = {
  whitespace: regex(/\s+/),
  optionalWhitespace: regex(/\s*/).optional(),
  identifier: regex(/[a-zA-Z_][a-zA-Z0-9_]*/),
  number: regex(/[0-9]+/).map(Number),
  
  // Memoized token variants
  lexeme: (() => {
    const cache = new Map<Parser<any>, Parser<any>>();
    return <T>(parser: Parser<T>) => {
      if (!cache.has(parser)) {
        cache.set(parser, parser.keepLeft(Tokens.optionalWhitespace));
      }
      return cache.get(parser)!;
    };
  })()
};

// Use cached tokens
const assignment = sequence([
  Tokens.lexeme(Tokens.identifier),
  Tokens.lexeme(str('=')),
  Tokens.lexeme(Tokens.number)
] as const);
```

### String Operations Optimization

Optimize string handling for better performance:

```typescript
// Efficient string matching for common cases
const fastStr = (target: string): Parser<string> => {
  const length = target.length;
  
  return new Parser(state => {
    // Fast path: direct string comparison
    if (state.input.length - state.index >= length &&
        state.input.substr(state.index, length) === target) {
      return success(target, { ...state, index: state.index + length });
    }
    
    return failure(`Expected "${target}"`, state);
  });
};

// Character class optimization
const createCharClass = (chars: string): Parser<string> => {
  const charSet = new Set(chars);
  
  return new Parser(state => {
    if (state.index >= state.input.length) {
      return failure('Unexpected end of input', state);
    }
    
    const char = state.input[state.index];
    if (charSet.has(char)) {
      return success(char, { ...state, index: state.index + 1 });
    }
    
    return failure(`Expected one of [${chars}]`, state);
  });
};
```

## Advanced Optimizations

### Memoization (Packrat Parsing)

Cache parser results to avoid redundant computation:

```typescript
interface MemoEntry<T> {
  result: ParseResult<T>;
  lastUsed: number;
}

const createMemoCache = <T>(maxSize = 10000) => {
  const cache = new Map<string, MemoEntry<T>>();
  let accessCounter = 0;
  
  const memoize = (parser: Parser<T>, keyPrefix = ''): Parser<T> =>
    new Parser(state => {
      const key = `${keyPrefix}:${state.index}:${state.input.length}`;
      accessCounter++;
      
      // Check cache
      if (cache.has(key)) {
        const entry = cache.get(key)!;
        entry.lastUsed = accessCounter;
        return entry.result;
      }
      
      // Execute parser
      const result = parser.run(state);
      
      // Cache result (with LRU eviction)
      if (cache.size >= maxSize) {
        const lruKey = [...cache.entries()]
          .sort(([, a], [, b]) => a.lastUsed - b.lastUsed)[0][0];
        cache.delete(lruKey);
      }
      
      cache.set(key, { result, lastUsed: accessCounter });
      return result;
    });
  
  return { memoize, cache };
};

// Usage for recursive parsers
const { memoize } = createMemoCache();

const expression: Parser<any> = memoize(lazy(() => choice([
  memoize(number, 'number'),
  memoize(sequence([
    str('('),
    expression, 
    str(')')
  ]), 'parens')
])), 'expression');
```

### Lookahead Optimization

Use strategic lookahead to reduce backtracking:

```typescript
// Poor: lots of backtracking
const inefficientKeywords = choice([
  str('function'),
  str('functionDeclaration'),
  str('func')
]);

// Better: use longest match first
const efficientKeywords = choice([
  str('functionDeclaration'),
  str('function'),
  str('func')
]);

// Best: use lookahead for early disambiguation
const smartKeywords = genParser(function* () {
  const ahead = yield lookahead(regex(/[a-z]+/));
  
  if (ahead.startsWith('functionDeclaration')) {
    return yield str('functionDeclaration');
  } else if (ahead.startsWith('function')) {
    return yield str('function');
  } else if (ahead.startsWith('func')) {
    return yield str('func');
  } else {
    throw new Error(`Unknown keyword: ${ahead}`);
  }
});
```

### Stream Processing Optimization

Handle large inputs efficiently:

```typescript
// Chunked processing for large files
const createChunkedParser = <T>(
  parser: Parser<T>,
  chunkSize = 8192
) => {
  return async (input: AsyncIterable<string>): Promise<T[]> => {
    const results: T[] = [];
    let buffer = '';
    let position = 0;
    
    for await (const chunk of input) {
      buffer += chunk;
      
      // Process complete items from buffer
      while (buffer.length > 0) {
        try {
          const result = parser.run({ input: buffer, index: 0 });
          
          if (result.type === 'success') {
            results.push(result.value);
            buffer = buffer.slice(result.state.index);
            position += result.state.index;
          } else {
            // Can't parse, need more input
            break;
          }
        } catch (error) {
          throw new Error(`Parse error at position ${position}: ${error.message}`);
        }
      }
    }
    
    // Process remaining buffer
    if (buffer.trim()) {
      const result = parser.run({ input: buffer, index: 0 });
      if (result.type === 'success') {
        results.push(result.value);
      }
    }
    
    return results;
  };
};
```

### Lazy Evaluation Optimization

Defer expensive computations:

```typescript
// Lazy choice evaluation
const lazyChoice = <T>(...parserFunctions: (() => Parser<T>)[]): Parser<T> =>
  new Parser(state => {
    let furthestFailure: Failure | null = null;
    
    for (const getParser of parserFunctions) {
      const parser = getParser(); // Lazy evaluation
      const result = parser.run(state);
      
      if (result.type === 'success') {
        return result;
      }
      
      if (!furthestFailure || result.state.index > furthestFailure.state.index) {
        furthestFailure = result;
      }
    }
    
    return furthestFailure!;
  });

// Usage
const expression = lazyChoice(
  () => number,
  () => stringLiteral,
  () => complexExpression // Only created if needed
);
```

## Memory Optimization

### Reduce Parser Chain Depth

Flatten deep parser chains to reduce stack usage:

```typescript
// Deep chain (stack risk)
const deepChain = many(str('a'))
  .chain(as => many(str('b'))
  .chain(bs => many(str('c'))
  .chain(cs => succeed({ as, bs, cs }))));

// Flattened (better memory usage)
const flattenedChain = genParser(function* () {
  const as = yield many(str('a'));
  const bs = yield many(str('b'));
  const cs = yield many(str('c'));
  return { as, bs, cs };
});
```

### Object Pool for Frequent Allocations

Reuse objects in high-frequency parsing:

```typescript
class StatePool {
  private pool: ParserState[] = [];
  
  acquire(input: string, index: number): ParserState {
    const state = this.pool.pop();
    if (state) {
      return { ...state, input, index };
    }
    return { input, index };
  }
  
  release(state: ParserState): void {
    if (this.pool.length < 100) { // Max pool size
      this.pool.push(state);
    }
  }
}

const statePool = new StatePool();

const pooledParser = <T>(parser: Parser<T>): Parser<T> =>
  new Parser(inputState => {
    const state = statePool.acquire(inputState.input, inputState.index);
    const result = parser.run(state);
    statePool.release(state);
    return result;
  });
```

### Streaming Result Processing

Process results as they arrive instead of accumulating:

```typescript
// Memory-intensive: accumulates all results
const accumulatingParser = many(complexItem);

// Memory-efficient: processes incrementally
const streamingParser = createStreamProcessor(
  complexItem,
  (item, index) => {
    // Process item immediately
    processItem(item);
    
    // Don't accumulate unless necessary
    if (index % 1000 === 0) {
      // Periodic cleanup
      runGC();
    }
  }
);
```

## Platform-Specific Optimizations

### V8 Engine Optimizations

Optimize for JavaScript engines:

```typescript
// Monomorphic function shapes for V8 optimization
interface OptimizedState {
  readonly input: string;
  readonly index: number;
  readonly _unused?: never; // Keeps shape stable
}

// Use typed arrays for character lookup
const createFastCharClass = (chars: string): Parser<string> => {
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)] = 1;
  }
  
  return new Parser(state => {
    if (state.index >= state.input.length) {
      return failure('End of input', state);
    }
    
    const charCode = state.input.charCodeAt(state.index);
    if (charCode < 256 && lookup[charCode]) {
      return success(
        state.input[state.index],
        { input: state.input, index: state.index + 1 }
      );
    }
    
    return failure(`Unexpected character`, state);
  });
};
```

### WebAssembly Integration

For ultimate performance, integrate WebAssembly:

```typescript
// Hypothetical WASM integration
declare const wasmParser: {
  parseJson(input: string): any;
  parseNumbers(input: string): number[];
};

const hybridJsonParser = genParser(function* () {
  // Use WASM for hot paths
  const fastResult = wasmParser.parseJson(getCurrentInput());
  
  if (fastResult.success) {
    return fastResult.value;
  }
  
  // Fall back to combinator parsing for complex cases
  return yield traditionalJsonParser;
});
```

## Benchmarking and Testing

### Performance Testing Suite

Create comprehensive performance tests:

```typescript
interface BenchmarkResult {
  name: string;
  inputSize: number;
  iterations: number;
  totalTime: number;
  avgTime: number;
  throughput: number; // items/second
  memoryUsage: number;
}

const createPerformanceTest = () => {
  const results: BenchmarkResult[] = [];
  
  const benchmark = <T>(
    name: string,
    parser: Parser<T>,
    generateInput: (size: number) => string,
    sizes: number[] = [100, 1000, 10000],
    iterations = 100
  ) => {
    sizes.forEach(size => {
      const input = generateInput(size);
      const startMemory = process.memoryUsage().heapUsed;
      
      const start = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        parser.parse(input);
      }
      
      const end = performance.now();
      const endMemory = process.memoryUsage().heapUsed;
      
      const result: BenchmarkResult = {
        name: `${name} (size: ${size})`,
        inputSize: size,
        iterations,
        totalTime: end - start,
        avgTime: (end - start) / iterations,
        throughput: (iterations * size) / ((end - start) / 1000),
        memoryUsage: endMemory - startMemory
      };
      
      results.push(result);
    });
  };
  
  const report = () => {
    console.log('Performance Results:');
    console.log('===================');
    
    results.forEach(result => {
      console.log(`${result.name}:`);
      console.log(`  Average time: ${result.avgTime.toFixed(4)}ms`);
      console.log(`  Throughput: ${result.throughput.toFixed(0)} chars/sec`);
      console.log(`  Memory: ${(result.memoryUsage / 1024).toFixed(1)}KB`);
      console.log('');
    });
  };
  
  return { benchmark, report, results };
};

// Usage
const perfTest = createPerformanceTest();

perfTest.benchmark(
  'JSON Parser',
  jsonParser,
  size => JSON.stringify({ items: Array(size).fill({ name: 'test', value: 42 }) })
);

perfTest.benchmark(
  'CSV Parser', 
  csvParser,
  size => Array(size).fill('name,age,email').join('\n')
);

perfTest.report();
```

### Regression Testing

Monitor performance over time:

```typescript
interface PerformanceBaseline {
  testName: string;
  avgTime: number;
  maxTime: number;
  memoryUsage: number;
  date: string;
}

const performanceMonitor = {
  baselines: new Map<string, PerformanceBaseline>(),
  
  setBaseline(testName: string, result: BenchmarkResult) {
    this.baselines.set(testName, {
      testName,
      avgTime: result.avgTime,
      maxTime: result.avgTime * 1.5, // 50% tolerance
      memoryUsage: result.memoryUsage,
      date: new Date().toISOString()
    });
  },
  
  checkRegression(testName: string, result: BenchmarkResult): boolean {
    const baseline = this.baselines.get(testName);
    if (!baseline) return true; // No baseline, assume OK
    
    const timeRegression = result.avgTime > baseline.maxTime;
    const memoryRegression = result.memoryUsage > baseline.memoryUsage * 1.5;
    
    if (timeRegression || memoryRegression) {
      console.warn(`Performance regression detected in ${testName}:`);
      if (timeRegression) {
        console.warn(`  Time: ${result.avgTime.toFixed(4)}ms > ${baseline.maxTime.toFixed(4)}ms`);
      }
      if (memoryRegression) {
        console.warn(`  Memory: ${result.memoryUsage} > ${baseline.memoryUsage * 1.5}`);
      }
      return false;
    }
    
    return true;
  }
};
```

## Production Deployment

### Bundle Size Optimization

Optimize for deployment:

```typescript
// Tree-shakeable exports
export { str, regex, number } from './core';
export { genParser } from './generator';

// Conditional imports for development vs production
const debugging = process.env.NODE_ENV === 'development';

export const debugParser = debugging 
  ? <T>(parser: Parser<T>, label?: string) => parser.debug(label)
  : <T>(parser: Parser<T>) => parser;

// Lazy load heavy features
export const advancedParsers = () => import('./advanced').then(m => m.default);
```

### Runtime Performance Monitoring

Monitor performance in production:

```typescript
const createPerformanceMonitor = () => {
  const metrics = {
    totalParseCalls: 0,
    totalParseTime: 0,
    slowParseCalls: 0,
    errorRate: 0
  };
  
  const monitoredParser = <T>(parser: Parser<T>, name: string): Parser<T> =>
    new Parser(state => {
      const start = performance.now();
      metrics.totalParseCalls++;
      
      try {
        const result = parser.run(state);
        
        const elapsed = performance.now() - start;
        metrics.totalParseTime += elapsed;
        
        if (elapsed > 100) { // Slow parse threshold
          metrics.slowParseCalls++;
          console.warn(`Slow parse detected: ${name} took ${elapsed.toFixed(2)}ms`);
        }
        
        return result;
      } catch (error) {
        metrics.errorRate++;
        throw error;
      }
    });
  
  const getMetrics = () => ({
    ...metrics,
    avgParseTime: metrics.totalParseTime / metrics.totalParseCalls,
    errorPercentage: (metrics.errorRate / metrics.totalParseCalls) * 100,
    slowParsePercentage: (metrics.slowParseCalls / metrics.totalParseCalls) * 100
  });
  
  return { monitoredParser, getMetrics };
};
```

By applying these optimization techniques systematically, you can achieve parser performance that meets production requirements while maintaining the composability and correctness benefits of parser combinators.
