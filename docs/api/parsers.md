# Parsers API Reference

This document provides comprehensive API documentation for all specialized parser modules.

## src/parsers/index.ts - Parsers Entry Point

Re-exports all specialized parser implementations.

| Export | Source | Description |
|--------|--------|-------------|
| **All Async** | `./async` | Asynchronous parsing utilities |
| **All Binary** | `./binary` | Binary data parsing |
| **All Contextual** | `./contextual` | Context-aware parsing |
| **All Incremental** | `./incremental` | Editor-optimized parsing |
| **All Secure** | `./secure` | Security-hardened parsing |
| **All Stream** | `./stream` | Real-time stream processing |
| **All Generator** | `./generator` | Generator-based parsing |

---

## src/parsers/async.ts - Asynchronous Parsing

Legacy async parser support with compatibility layer.

### Types

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `AsyncParseResult<T>` | `type` | `<T>` | Promise-wrapped parse result |
| `AsyncParser<T>` | `interface` | `<T>` | Async parser interface |
| `AsyncParserOptions` | `interface` | - | Configuration for async parsing |

### Functions

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `asyncParser` | `function` | `<T>(parser: Parser<T>, options?: AsyncParserOptions)` | Convert sync parser to async |
| `parseAsync` | `function` | `<T>(parser: AsyncParser<T>, input: string)` | Parse asynchronously |
| `withTimeout` | `function` | `<T>(parser: AsyncParser<T>, ms: number)` | Add timeout to async parser |
| `parallel` | `function` | `<T>(parsers: AsyncParser<T>[])` | Parse with multiple parsers in parallel |

### Usage Examples

```typescript
import { asyncParser, parseAsync, withTimeout } from '@doeixd/combi-parse/async';

const slowParser = withTimeout(asyncParser(complexParser), 5000);
const result = await parseAsync(slowParser, input);
```

---

## src/parsers/binary.ts - Binary Data Parsing

Specialized parsers for structured binary data formats.

### Core Types

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `BinaryParser<T>` | `class` | `<T>` | Binary data parser |
| `Endianness` | `type` | - | `'big' \| 'little'` byte order |
| `BinaryResult<T>` | `interface` | `<T>` | Binary parse result with remaining buffer |

### Primitive Parsers

| Export | Type | Description |
|--------|------|-------------|
| `uint8` | `BinaryParser<number>` | Parse unsigned 8-bit integer |
| `uint16` | `BinaryParser<number>` | Parse unsigned 16-bit integer |
| `uint32` | `BinaryParser<number>` | Parse unsigned 32-bit integer |
| `int8` | `BinaryParser<number>` | Parse signed 8-bit integer |
| `int16` | `BinaryParser<number>` | Parse signed 16-bit integer |
| `int32` | `BinaryParser<number>` | Parse signed 32-bit integer |
| `float32` | `BinaryParser<number>` | Parse 32-bit float |
| `float64` | `BinaryParser<number>` | Parse 64-bit float |

### String and Buffer Parsers

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `bytes` | `function` | `(length: number) => BinaryParser<Uint8Array>` | Parse fixed-length byte array |
| `string` | `function` | `(length: number, encoding?: string) => BinaryParser<string>` | Parse fixed-length string |
| `cString` | `function` | `(encoding?: string) => BinaryParser<string>` | Parse null-terminated string |
| `lengthPrefixed` | `function` | `<T>(lengthParser: BinaryParser<number>, dataParser: BinaryParser<T>)` | Parse length-prefixed data |

### Combinators

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `sequence` | `function` | `<T extends readonly BinaryParser<any>[]>` | Parse sequence of binary data |
| `choice` | `function` | `<T extends readonly BinaryParser<any>[]>` | Try binary parsers in order |
| `count` | `function` | `<T>(parser: BinaryParser<T>, n: number)` | Parse exact count of items |
| `many` | `function` | `<T>(parser: BinaryParser<T>) => BinaryParser<T[]>` | Parse until end of buffer |

### Utility Functions

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `withEndianness` | `function` | `<T>(parser: BinaryParser<T>, endian: Endianness)` | Set byte order for parser |
| `align` | `function` | `(boundary: number) => BinaryParser<void>` | Align to byte boundary |
| `skip` | `function` | `(bytes: number) => BinaryParser<void>` | Skip bytes |
| `peek` | `function` | `<T>(parser: BinaryParser<T>) => BinaryParser<T>` | Parse without consuming |

### File Format Parsers

| Export | Type | Description |
|--------|------|-------------|
| `pngHeader` | `BinaryParser<PNGHeader>` | Parse PNG file header |
| `jpegHeader` | `BinaryParser<JPEGHeader>` | Parse JPEG file header |
| `elfHeader` | `BinaryParser<ELFHeader>` | Parse ELF executable header |

### Usage Examples

```typescript
import { BinaryParser, uint32, string, sequence } from '@doeixd/combi-parse/binary';

const headerParser = sequence([
  uint32,           // File size
  string(4),        // Magic bytes
  uint32            // Version
]);

const buffer = new Uint8Array([0x00, 0x00, 0x10, 0x00, 0x50, 0x4B, 0x03, 0x04]);
const result = headerParser.parse(buffer);
```

---

## src/parsers/contextual.ts - Context-Aware Parsing

Parsers that maintain and use parsing context for indentation-sensitive languages.

### Types

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `ParseContext` | `interface` | - | Current parsing context state |
| `IndentationLevel` | `type` | - | Current indentation depth |
| `ContextualParser<T>` | `class` | `<T>` | Context-aware parser |

### Context Management

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `withContext` | `function` | `<T>(parser: Parser<T>, context: ParseContext)` | Add context to parser |
| `pushContext` | `function` | `<T>(parser: Parser<T>, key: string, value: any)` | Push context value |
| `popContext` | `function` | `<T>(parser: Parser<T>, key: string)` | Pop context value |
| `getContext` | `function` | `(key: string) => Parser<any>` | Get current context value |

### Indentation-Sensitive Parsing

| Export | Type | Description |
|--------|------|-------------|
| `indented` | `Parser<string>` | Parse current indentation |
| `dedented` | `Parser<void>` | Ensure dedentation occurred |
| `sameLine` | `Parser<void>` | Ensure same line continuation |
| `newLine` | `Parser<void>` | Parse line break with indentation tracking |

### Block Structure

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `block` | `function` | `<T>(content: Parser<T>) => Parser<T>` | Parse indented block |
| `blockOf` | `function` | `<T>(parser: Parser<T>) => Parser<T[]>` | Parse multiple items in block |
| `suite` | `function` | `<T>(parser: Parser<T>) => Parser<T[]>` | Parse Python-style suite |

### Language Constructs

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `ifThenElse` | `function` | `<T, U>(condition: Parser<T>, thenParser: Parser<U>, elseParser?: Parser<U>)` | Parse conditional blocks |
| `whileLoop` | `function` | `<T, U>(condition: Parser<T>, body: Parser<U>)` | Parse while loop structure |
| `forLoop` | `function` | `<T, U, V>(init: Parser<T>, condition: Parser<U>, body: Parser<V>)` | Parse for loop structure |

### Usage Examples

```typescript
import { block, indented, withContext } from '@doeixd/combi-parse/contextual';

const pythonFunction = sequence([
  str('def'),
  identifier,
  str(':'),
  block(many(statement))
]);

const yamlMapping = withContext(
  many(sequence([indented, key, str(':'), value])),
  { indentLevel: 0 }
);
```

---

## src/parsers/incremental.ts - Incremental Parsing

Editor-optimized parsing with efficient change tracking and recomputation.

### Types

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `IncrementalParser<T>` | `class` | `<T>` | Incremental parser with change tracking |
| `TextChange` | `interface` | - | Represents a text edit operation |
| `ParseTree<T>` | `interface` | `<T>` | Incremental parse tree node |
| `ReparseRegion` | `interface` | - | Region requiring reparsing |

### Core Functions

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `createIncremental` | `function` | `<T>(parser: Parser<T>) => IncrementalParser<T>` | Create incremental parser |
| `applyChange` | `function` | `<T>(parser: IncrementalParser<T>, change: TextChange)` | Apply text change |
| `invalidateRegion` | `function` | `<T>(parser: IncrementalParser<T>, start: number, end: number)` | Mark region for reparsing |
| `getParseTree` | `function` | `<T>(parser: IncrementalParser<T>) => ParseTree<T>` | Get current parse tree |

### Change Tracking

| Export | Type | Description |
|--------|------|-------------|
| `trackInsertions` | `Parser<void>` | Track text insertions |
| `trackDeletions` | `Parser<void>` | Track text deletions |
| `trackReplacements` | `Parser<void>` | Track text replacements |

### Tree Operations

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `findNode` | `function` | `<T>(tree: ParseTree<T>, position: number)` | Find node at position |
| `updateNode` | `function` | `<T>(tree: ParseTree<T>, node: ParseTree<T>, newValue: T)` | Update tree node |
| `insertNode` | `function` | `<T>(tree: ParseTree<T>, position: number, node: ParseTree<T>)` | Insert tree node |
| `deleteNode` | `function` | `<T>(tree: ParseTree<T>, node: ParseTree<T>)` | Delete tree node |

### Performance Monitoring

| Export | Type | Description |
|--------|------|-------------|
| `reparseMetrics` | `ParseMetrics` | Reparse performance metrics |
| `cacheHitRate` | `number` | Parse cache effectiveness |
| `memoryUsage` | `MemoryStats` | Parser memory consumption |

### Usage Examples

```typescript
import { createIncremental, applyChange } from '@doeixd/combi-parse/incremental';

const parser = createIncremental(documentParser);
const tree = parser.parse(initialText);

// Later, apply an edit
applyChange(parser, {
  start: 100,
  deleteCount: 5,
  insertText: 'new content'
});

const updatedTree = getParseTree(parser);
```

---

## src/parsers/secure.ts - Security-Hardened Parsing

Parsers with built-in DoS protection and resource limits.

### Types

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `SecureParser<T>` | `class` | `<T>` | Security-hardened parser |
| `SecurityLimits` | `interface` | - | Resource limits configuration |
| `ThreatAssessment` | `interface` | - | Security threat analysis |

### Security Configuration

| Export | Type | Description |
|--------|------|-------------|
| `defaultLimits` | `SecurityLimits` | Default security limits |
| `strictLimits` | `SecurityLimits` | Strict security limits |
| `productionLimits` | `SecurityLimits` | Production-ready limits |

### Core Functions

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `secure` | `function` | `<T>(parser: Parser<T>, limits?: SecurityLimits)` | Add security to parser |
| `withLimits` | `function` | `<T>(parser: Parser<T>, limits: SecurityLimits)` | Apply specific limits |
| `assess` | `function` | `(input: string) => ThreatAssessment` | Analyze input for threats |

### DoS Protection

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `limitDepth` | `function` | `<T>(parser: Parser<T>, maxDepth: number)` | Limit recursion depth |
| `limitNodes` | `function` | `<T>(parser: Parser<T>, maxNodes: number)` | Limit parse tree nodes |
| `limitTime` | `function` | `<T>(parser: Parser<T>, timeoutMs: number)` | Add parsing timeout |
| `limitMemory` | `function` | `<T>(parser: Parser<T>, maxBytes: number)` | Limit memory usage |

### Input Validation

| Export | Type | Description |
|--------|------|-------------|
| `sanitizeInput` | `function` | Clean potentially dangerous input |
| `validateEncoding` | `function` | Ensure proper text encoding |
| `checkBombs` | `function` | Detect zip/XML bombs |
| `rateLimitCheck` | `function` | Apply rate limiting |

### Monitoring

| Export | Type | Description |
|--------|------|-------------|
| `securityMetrics` | `SecurityMetrics` | Security monitoring data |
| `threatLog` | `ThreatLog[]` | Log of detected threats |
| `performanceImpact` | `PerformanceStats` | Security overhead metrics |

### Usage Examples

```typescript
import { secure, limitDepth, assess } from '@doeixd/combi-parse/secure';

const safeParser = secure(jsonParser, {
  maxDepth: 10,
  maxNodes: 1000,
  timeoutMs: 5000,
  maxMemoryMB: 50
});

const threat = assess(untrustedInput);
if (threat.riskLevel === 'high') {
  throw new Error('Input rejected');
}

const result = safeParser.parse(untrustedInput);
```

---

## src/parsers/stream.ts - Stream Processing

Real-time parsing of data streams with backpressure handling.

### Types

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `StreamParser<T>` | `class` | `<T>` | Stream-based parser |
| `StreamResult<T>` | `interface` | `<T>` | Streaming parse result |
| `BackpressureStrategy` | `type` | - | How to handle slow consumers |

### Core Functions

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `createStream` | `function` | `<T>(parser: Parser<T>) => StreamParser<T>` | Create stream parser |
| `pipe` | `function` | `<T>(stream: ReadableStream, parser: StreamParser<T>)` | Pipe stream to parser |
| `transform` | `function` | `<T, U>(parser: StreamParser<T>, fn: (value: T) => U)` | Transform stream results |

### Stream Combinators

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `chunk` | `function` | `<T>(parser: Parser<T>, size: number)` | Parse fixed-size chunks |
| `delimited` | `function` | `<T>(parser: Parser<T>, delimiter: string)` | Parse delimited records |
| `lines` | `function` | `<T>(parser: Parser<T>) => StreamParser<T>` | Parse line-by-line |
| `csv` | `function` | `<T>(rowParser: Parser<T>) => StreamParser<T[]>` | Parse CSV streams |

### Flow Control

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `buffer` | `function` | `<T>(parser: StreamParser<T>, size: number)` | Add buffering |
| `throttle` | `function` | `<T>(parser: StreamParser<T>, rate: number)` | Throttle processing rate |
| `batch` | `function` | `<T>(parser: StreamParser<T>, size: number)` | Batch results |
| `debounce` | `function` | `<T>(parser: StreamParser<T>, delayMs: number)` | Debounce results |

### Event Handlers

| Export | Type | Generics | Description |
|--------|------|----------|-------------|
| `onResult` | `function` | `<T>(parser: StreamParser<T>, handler: (result: T) => void)` | Handle successful results |
| `onError` | `function` | `<T>(parser: StreamParser<T>, handler: (error: Error) => void)` | Handle parse errors |
| `onEnd` | `function` | `<T>(parser: StreamParser<T>, handler: () => void)` | Handle stream end |
| `onDrain` | `function` | `<T>(parser: StreamParser<T>, handler: () => void)` | Handle backpressure relief |

### Usage Examples

```typescript
import { createStream, pipe, onResult, lines } from '@doeixd/combi-parse/stream';

const logParser = createStream(logLineParser);
const lineByLine = lines(logParser);

onResult(lineByLine, (logEntry) => {
  console.log('Parsed log:', logEntry);
});

pipe(fileStream, lineByLine);
```

## Usage Patterns

### Choosing the Right Parser

```typescript
// For async operations
import { asyncParser } from '@doeixd/combi-parse/async';

// For binary data
import { BinaryParser } from '@doeixd/combi-parse/binary';

// For indentation-sensitive languages
import { block, indented } from '@doeixd/combi-parse/contextual';

// For editors and IDEs
import { createIncremental } from '@doeixd/combi-parse/incremental';

// For untrusted input
import { secure } from '@doeixd/combi-parse/secure';

// For real-time data
import { createStream } from '@doeixd/combi-parse/stream';
```

### Performance Considerations

```typescript
// Use appropriate limits
const safeParser = secure(parser, {
  maxDepth: 100,
  maxNodes: 10000,
  timeoutMs: 30000
});

// Buffer streams appropriately
const bufferedStream = buffer(streamParser, 1024);

// Use incremental parsing for large documents
const incrementalParser = createIncremental(documentParser);
```
