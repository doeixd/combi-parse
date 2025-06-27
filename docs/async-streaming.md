# Async & Streaming Parsing Guide

This comprehensive guide covers asynchronous and streaming parsing capabilities in Combi-Parse, from basic concepts to advanced real-world implementations.

## 📖 Overview

Combi-Parse provides multiple approaches for handling asynchronous and streaming data:

- **Stream Parsing**: Real-time processing of chunked data
- **Async Generators**: Non-blocking parsing with async operations
- **Incremental Parsing**: Editor-optimized parsing with change tracking
- **Batch Processing**: Efficient processing of large datasets
- **Transform Streams**: Pipeline-based data processing

## 🌊 Stream Parsing

Stream parsing allows you to process data as it arrives in chunks, making it ideal for large files, network streams, and real-time data feeds.

### Basic Stream Parsing

```typescript
import { createStreamParser } from '@doeixd/combi-parse/stream';
import { str, regex, sequence } from '@doeixd/combi-parse';

// Create a parser for CSV rows
const csvRow = sequence([
  regex(/[^,\n]+/),  // First column
  str(','),
  regex(/[^,\n]+/),  // Second column
  str(','),
  regex(/[^,\n]+/)   // Third column
], ([col1, , col2, , col3]) => ({ col1, col2, col3 }));

// Create stream parser
const csvStream = createStreamParser(csvRow, str('\n'));

// Process data as it arrives
csvStream.onData(row => {
  console.log('Parsed row:', row);
  processRow(row);
});

csvStream.onError(error => {
  console.error('Parse error:', error);
});

csvStream.onEnd(() => {
  console.log('Stream processing complete');
});

// Feed data in chunks
csvStream.feed('name,age,city\n');
csvStream.feed('John,25,NYC\n');
csvStream.feed('Jane,30,SF');
csvStream.end(); // Signal end of data
```

### Real-time Log Processing

```typescript
import { createStreamParser } from '@doeixd/combi-parse/stream';
import { str, regex, sequence, optional } from '@doeixd/combi-parse';

// Parser for log entries
const logLevel = choice([
  str('ERROR'),
  str('WARN'),
  str('INFO'),
  str('DEBUG')
]);

const timestamp = regex(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);

const logEntry = sequence([
  timestamp,
  str(' ['),
  logLevel,
  str('] '),
  regex(/[^\n]*/),  // Message
  optional(str('\n'))
], ([time, , level, , message]) => ({
  timestamp: new Date(time),
  level,
  message: message.trim()
}));

const logStream = createStreamParser(logEntry, optional(str('\n')));

// Real-time log monitoring
logStream.onData(entry => {
  if (entry.level === 'ERROR') {
    alertOnError(entry);
  }
  
  updateDashboard(entry);
  storeLogEntry(entry);
});

// Connect to log stream (WebSocket, file stream, etc.)
logWebSocket.onmessage = (event) => {
  logStream.feed(event.data);
};
```

### Stream Performance Monitoring

```typescript
import { createStreamParser, StreamMetrics } from '@doeixd/combi-parse/stream';

const monitoredStream = createStreamParser(complexParser, delimiter);

// Monitor performance metrics
monitoredStream.onMetrics((metrics: StreamMetrics) => {
  console.log(`Parsed ${metrics.itemsProcessed} items`);
  console.log(`Average parse time: ${metrics.averageParseTime}ms`);
  console.log(`Memory usage: ${metrics.memoryUsage}MB`);
  console.log(`Buffer size: ${metrics.bufferSize} characters`);
  
  // Alert on performance issues
  if (metrics.averageParseTime > 100) {
    console.warn('Parsing is slow, consider optimization');
  }
  
  if (metrics.bufferSize > 1024 * 1024) { // 1MB
    console.warn('Buffer is getting large, check delimiter parsing');
  }
});
```

## 🔄 Async Generator Parsing

Async generators enable parsing that involves asynchronous operations like API calls, database queries, or file system operations.

### Basic Async Generator

```typescript
import { asyncGenParser } from '@doeixd/combi-parse/async';
import { str, regex, sequence } from '@doeixd/combi-parse';

// Parser that validates data against an API
const validatedUserParser = asyncGenParser(async function* () {
  const username = yield regex(/[a-zA-Z0-9_]+/);
  
  // Async validation
  const isValid = await fetch(`/api/validate-user/${username}`)
    .then(r => r.json())
    .then(data => data.isValid);
  
  if (!isValid) {
    throw new Error(`Invalid username: ${username}`);
  }
  
  const email = yield sequence([str('@'), regex(/[^@\s]+/)]);
  
  return {
    username,
    email: email.join(''),
    validated: true,
    validatedAt: new Date()
  };
});

// Usage
const result = await validatedUserParser.parse('john@example.com');
console.log(result); // { username: 'john', email: '@example.com', validated: true, ... }
```

### Database-Integrated Parsing

```typescript
// Parser that enriches data with database lookups
const enrichedOrderParser = asyncGenParser(async function* () {
  const orderId = yield sequence([str('ORDER-'), regex(/\d+/)]);
  const customerId = yield sequence([str(' CUSTOMER-'), regex(/\d+/)]);
  
  // Parallel database queries
  const [orderDetails, customerInfo] = await Promise.all([
    db.orders.findById(orderId),
    db.customers.findById(customerId)
  ]);
  
  if (!orderDetails) {
    throw new Error(`Order ${orderId} not found`);
  }
  
  if (!customerInfo) {
    throw new Error(`Customer ${customerId} not found`);
  }
  
  return {
    order: orderDetails,
    customer: customerInfo,
    parsedAt: new Date()
  };
});

// Process order notifications
const orderText = 'ORDER-12345 CUSTOMER-67890';
const enrichedOrder = await enrichedOrderParser.parse(orderText);
```

### Async Stream Processing

```typescript
// Combine async generators with stream processing
const asyncStreamParser = asyncGenParser(async function* () {
  while (true) {
    const chunk = yield takeFromStream();
    
    if (!chunk) break; // End of stream
    
    // Process chunk asynchronously
    const processed = await processChunkAsync(chunk);
    
    yield* processed; // Yield all items from processed chunk
  }
});

// Usage with ReadableStream
const stream = new ReadableStream({
  start(controller) {
    // Stream data...
  }
});

for await (const item of asyncStreamParser.parseStream(stream)) {
  console.log('Processed item:', item);
}
```

## ⚡ Transform Streams

Transform streams provide a pipeline-based approach to data processing.

### Basic Transform Stream

```typescript
import { transformStream } from '@doeixd/combi-parse/async';
import { regex } from '@doeixd/combi-parse';

// Parse numbers and double them
const numberStream = new ReadableStream({
  start(controller) {
    controller.enqueue(new TextEncoder().encode('123\n456\n789\n'));
    controller.close();
  }
});

const numberParser = regex(/\d+/).map(s => parseInt(s, 10));

const doubled = transformStream(
  numberStream,
  numberParser,
  (num: number) => num * 2
);

for await (const doubledNumber of doubled) {
  console.log(doubledNumber); // 246, 912, 1578
}
```

### Complex Pipeline Processing

```typescript
// Multi-stage processing pipeline
const processingPipeline = async function* (inputStream: ReadableStream) {
  // Stage 1: Parse raw data
  const parsed = transformStream(
    inputStream,
    rawDataParser,
    (data) => data
  );
  
  // Stage 2: Validate and filter
  const validated = transformStream(
    parsed,
    identity(), // Pass through
    async (data) => {
      const isValid = await validateData(data);
      return isValid ? data : null;
    }
  );
  
  // Stage 3: Enrich with external data
  const enriched = transformStream(
    validated,
    identity(),
    async (data) => {
      if (!data) return null;
      const enrichment = await fetchEnrichmentData(data.id);
      return { ...data, ...enrichment };
    }
  );
  
  // Stage 4: Format output
  yield* transformStream(
    enriched,
    identity(),
    (data) => data ? formatOutput(data) : null
  );
};

// Use the pipeline
for await (const result of processingPipeline(inputStream)) {
  if (result) {
    console.log('Processed:', result);
  }
}
```

## 📦 Batch Processing

Batch processing allows efficient handling of large datasets by processing items in groups.

### Basic Batch Processing

```typescript
import { batchParser } from '@doeixd/combi-parse/async';
import { str, regex } from '@doeixd/combi-parse';

// Parse comma-separated numbers in batches
const numberListParser = batchParser(
  regex(/\d+/).map(s => parseInt(s, 10)),
  str(','),
  100 // Batch size
);

const input = '1,2,3,4,5,6,7,8,9,10';
const result = numberListParser.parse(input);
console.log(result); // [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
```

### Advanced Batch Processing with Callbacks

```typescript
// Process large datasets efficiently
const createBatchProcessor = <T>(
  itemParser: Parser<T>,
  batchSize: number,
  onBatch: (batch: T[]) => void
) => {
  let currentBatch: T[] = [];
  
  return createStreamParser(itemParser, str('\n'))
    .onData(item => {
      currentBatch.push(item);
      
      if (currentBatch.length >= batchSize) {
        onBatch([...currentBatch]);
        currentBatch = []; // Clear batch
      }
    })
    .onEnd(() => {
      if (currentBatch.length > 0) {
        onBatch(currentBatch); // Process final partial batch
      }
    });
};

// Usage for processing large CSV files
const csvProcessor = createBatchProcessor(
  csvRowParser,
  1000, // Process 1000 rows at a time
  async (batch) => {
    console.log(`Processing batch of ${batch.length} rows`);
    await database.insertMany(batch);
    console.log('Batch inserted into database');
  }
);

// Process large file
const largeFileStream = fs.createReadStream('large-file.csv');
largeFileStream.on('data', chunk => {
  csvProcessor.feed(chunk.toString());
});
```

## 🔄 Incremental Parsing

Incremental parsing is optimized for editors and IDEs, reusing previous parse results when only small changes are made.

### Basic Incremental Parsing

```typescript
import { IncrementalParser, TextChange } from '@doeixd/combi-parse/incremental';

const parser = new IncrementalParser(documentParser);

// Initial parse
const initialText = '{"name": "John", "age": 30}';
const result1 = parser.parse(initialText);
console.log('Initial parse time:', result1.parseTime);

// Incremental update
const changes: TextChange[] = [{
  start: 26,    // Position of "30"
  deleteCount: 2,
  insertText: '25'
}];

const updatedText = '{"name": "John", "age": 25}';
const result2 = parser.parse(updatedText, changes);
console.log('Incremental parse time:', result2.parseTime);
console.log('Nodes reused:', result2.reusePercentage);
```

### Editor Integration

```typescript
// Code editor with incremental parsing
class CodeEditor {
  private incrementalParser = new IncrementalParser(languageParser);
  private lastParseResult: ParseResult | null = null;
  
  onTextChange(changes: TextChange[]) {
    const startTime = performance.now();
    
    const result = this.incrementalParser.parse(this.getText(), changes);
    
    const parseTime = performance.now() - startTime;
    console.log(`Parse completed in ${parseTime.toFixed(2)}ms`);
    console.log(`Reused ${result.reusePercentage.toFixed(1)}% of previous parse`);
    
    this.updateSyntaxHighlighting(result.ast);
    this.updateErrorMarkers(result.errors);
    this.updateOutline(result.symbols);
    
    this.lastParseResult = result;
  }
  
  private updateSyntaxHighlighting(ast: ASTNode) {
    // Apply syntax highlighting based on AST
    ast.visit(node => {
      if (node.type === 'keyword') {
        this.highlightRange(node.range, 'keyword');
      } else if (node.type === 'string') {
        this.highlightRange(node.range, 'string');
      }
      // ... more highlighting rules
    });
  }
  
  private updateErrorMarkers(errors: ParseError[]) {
    this.clearErrorMarkers();
    errors.forEach(error => {
      this.addErrorMarker(error.position, error.message);
    });
  }
}
```

## 🛡️ Security in Async/Stream Parsing

When parsing untrusted data in async/streaming contexts, security is crucial.

### Secure Stream Parsing

```typescript
import { secureParser } from '@doeixd/combi-parse/secure';
import { createStreamParser } from '@doeixd/combi-parse/stream';

// Secure stream parser with limits
const secureStreamParser = createStreamParser(
  secureParser(dataParser, {
    maxParseTime: 1000,    // 1 second per item
    maxMemory: 10 * 1024 * 1024, // 10MB
    maxDepth: 50           // Prevent deep nesting attacks
  }),
  delimiter
);

// Rate limiting for stream input
let itemCount = 0;
const startTime = Date.now();

secureStreamParser.onData(item => {
  itemCount++;
  
  // Rate limiting: max 1000 items per minute
  const elapsed = Date.now() - startTime;
  const rate = itemCount / (elapsed / 60000); // items per minute
  
  if (rate > 1000) {
    throw new Error('Rate limit exceeded');
  }
  
  processItem(item);
});

// Input size limiting
let totalBytes = 0;
const MAX_STREAM_SIZE = 100 * 1024 * 1024; // 100MB

secureStreamParser.onFeed = (chunk: string) => {
  totalBytes += chunk.length;
  
  if (totalBytes > MAX_STREAM_SIZE) {
    throw new Error('Stream size limit exceeded');
  }
};
```

### Async Timeout Handling

```typescript
// Timeout wrapper for async parsers
const withTimeout = <T>(
  asyncParser: (input: string) => Promise<T>,
  timeoutMs: number
): ((input: string) => Promise<T>) => {
  return async (input: string) => {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Parse timeout')), timeoutMs);
    });
    
    return Promise.race([
      asyncParser(input),
      timeoutPromise
    ]);
  };
};

// Usage
const timeoutParser = withTimeout(validatedUserParser.parse, 5000);

try {
  const result = await timeoutParser('user@example.com');
  console.log(result);
} catch (error) {
  if (error.message === 'Parse timeout') {
    console.error('Parser timed out');
  } else {
    console.error('Parse error:', error);
  }
}
```

## 📊 Performance Optimization

### Stream Buffer Management

```typescript
// Optimized stream parser with buffer management
class OptimizedStreamParser<T> {
  private buffer = '';
  private parser: Parser<T>;
  private delimiter: Parser<any>;
  private maxBufferSize: number;
  
  constructor(parser: Parser<T>, delimiter: Parser<any>, maxBufferSize = 1024 * 1024) {
    this.parser = parser;
    this.delimiter = delimiter;
    this.maxBufferSize = maxBufferSize;
  }
  
  feed(chunk: string) {
    this.buffer += chunk;
    
    // Prevent buffer from growing too large
    if (this.buffer.length > this.maxBufferSize) {
      this.processBuffer();
    }
    
    this.processBuffer();
  }
  
  private processBuffer() {
    let position = 0;
    const results: T[] = [];
    
    while (position < this.buffer.length) {
      const remainingBuffer = this.buffer.slice(position);
      
      // Try to find delimiter
      const delimiterResult = this.delimiter.run({
        input: remainingBuffer,
        index: 0
      });
      
      if (delimiterResult.type === 'success') {
        // Found delimiter, try to parse the chunk before it
        const chunkToParse = remainingBuffer.slice(0, delimiterResult.state.index);
        
        const parseResult = this.parser.run({
          input: chunkToParse,
          index: 0
        });
        
        if (parseResult.type === 'success') {
          results.push(parseResult.value);
        }
        
        position += delimiterResult.state.index + 1;
      } else {
        // No delimiter found, keep buffer for next chunk
        break;
      }
    }
    
    // Update buffer
    this.buffer = this.buffer.slice(position);
    
    // Emit results
    results.forEach(result => this.onData(result));
  }
  
  onData(result: T) {
    // Override in subclass or set as callback
  }
}
```

### Memory-Efficient Processing

```typescript
// Generator that processes large files without loading into memory
async function* processLargeFile(
  filePath: string,
  lineParser: Parser<any>
): AsyncGenerator<any, void, unknown> {
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const streamParser = createAsyncStreamParser(lineParser);
  
  try {
    for await (const item of streamParser.parse(fileStream)) {
      yield item;
      
      // Optional: yield control to event loop
      if (Math.random() < 0.01) { // 1% of the time
        await new Promise(resolve => setImmediate(resolve));
      }
    }
  } finally {
    fileStream.destroy();
  }
}

// Usage
for await (const item of processLargeFile('huge-data.txt', dataParser)) {
  await processItem(item);
  
  // Memory usage stays constant regardless of file size
}
```

## 🎯 Real-World Examples

### WebSocket Real-time Data Processing

```typescript
// Real-time trading data parser
const tradeDataParser = sequence([
  str('TRADE:'),
  regex(/[A-Z]+/),  // Symbol
  str(':'),
  regex(/\d+\.\d+/), // Price
  str(':'),
  regex(/\d+/)       // Volume
], ([, symbol, , price, , volume]) => ({
  type: 'trade',
  symbol,
  price: parseFloat(price),
  volume: parseInt(volume),
  timestamp: Date.now()
}));

const wsParser = createStreamParser(tradeDataParser, str('\n'));

wsParser.onData(trade => {
  updatePriceChart(trade);
  checkTradingAlerts(trade);
  logTrade(trade);
});

websocket.onmessage = (event) => {
  wsParser.feed(event.data);
};
```

### Log File Analysis

```typescript
// Multi-format log parser
const logParsers = {
  nginx: sequence([
    regex(/\d+\.\d+\.\d+\.\d+/), // IP
    str(' - - ['),
    regex(/[^\]]+/),             // Timestamp
    str('] "'),
    regex(/[^"]+/),              // Request
    str('" '),
    regex(/\d+/),                // Status
    str(' '),
    regex(/\d+/)                 // Size
  ]),
  
  apache: sequence([
    regex(/[^\s]+/),             // Host
    str(' '),
    regex(/[^\s]+/),             // Identity
    str(' '),
    regex(/[^\s]+/),             // User
    str(' ['),
    regex(/[^\]]+/),             // Timestamp
    str('] "'),
    regex(/[^"]+/),              // Request
    str('" '),
    regex(/\d+/),                // Status
    str(' '),
    regex(/\d+/)                 // Size
  ])
};

const adaptiveLogParser = asyncGenParser(async function* () {
  const firstLine = yield peekLine();
  
  // Detect log format
  const format = detectLogFormat(firstLine);
  const parser = logParsers[format];
  
  if (!parser) {
    throw new Error(`Unknown log format: ${format}`);
  }
  
  // Parse using detected format
  return yield parser;
});

// Process log files
for await (const logEntry of adaptiveLogParser.parseStream(logFileStream)) {
  await indexLogEntry(logEntry);
}
```

### API Response Processing

```typescript
// Streaming JSON API response parser
const apiResponseParser = asyncGenParser(async function* () {
  yield str('{"data": [');
  
  const items = [];
  let hasMore = true;
  
  while (hasMore) {
    const item = yield jsonObjectParser;
    items.push(item);
    
    // Check if there's more data
    const nextChar = yield peek(choice([str(','), str(']')]));
    
    if (nextChar === ',') {
      yield str(',');
      // Optional: yield control and process batch
      if (items.length >= 100) {
        await processBatch(items);
        items.length = 0; // Clear array
      }
    } else {
      hasMore = false;
    }
  }
  
  yield str(']}');
  
  if (items.length > 0) {
    await processBatch(items);
  }
  
  return { processed: true };
});

// Handle large API responses without memory issues
const response = await fetch('/api/large-dataset');
const result = await apiResponseParser.parseStream(response.body);
```

## 📈 Monitoring & Debugging

### Performance Monitoring

```typescript
// Comprehensive performance monitoring
class PerformanceMonitor {
  private metrics = {
    parseCount: 0,
    totalParseTime: 0,
    maxParseTime: 0,
    errorCount: 0,
    memoryUsage: [],
    throughput: []
  };
  
  wrapParser<T>(parser: Parser<T>, name: string): Parser<T> {
    return new Parser((state) => {
      const startTime = performance.now();
      const startMemory = process.memoryUsage();
      
      try {
        const result = parser.run(state);
        
        const endTime = performance.now();
        const parseTime = endTime - startTime;
        
        this.updateMetrics(name, parseTime, startMemory);
        
        return result;
      } catch (error) {
        this.metrics.errorCount++;
        throw error;
      }
    });
  }
  
  private updateMetrics(name: string, parseTime: number, startMemory: any) {
    this.metrics.parseCount++;
    this.metrics.totalParseTime += parseTime;
    this.metrics.maxParseTime = Math.max(this.metrics.maxParseTime, parseTime);
    
    const endMemory = process.memoryUsage();
    const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;
    this.metrics.memoryUsage.push(memoryDelta);
    
    console.log(`Parser ${name}: ${parseTime.toFixed(2)}ms, ${memoryDelta} bytes`);
  }
  
  getReport() {
    return {
      ...this.metrics,
      averageParseTime: this.metrics.totalParseTime / this.metrics.parseCount,
      averageMemoryUsage: this.metrics.memoryUsage.reduce((a, b) => a + b, 0) / this.metrics.memoryUsage.length
    };
  }
}

// Usage
const monitor = new PerformanceMonitor();
const monitoredParser = monitor.wrapParser(complexParser, 'complex-parser');

// Generate performance report
setInterval(() => {
  console.log('Performance Report:', monitor.getReport());
}, 10000);
```

### Debug Streaming

```typescript
// Debug wrapper for stream parsers
const debugStream = <T>(
  parser: Parser<T>,
  delimiter: Parser<any>,
  debugOptions: {
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    logInterval: number;
    maxLogEntries: number;
  }
) => {
  let itemCount = 0;
  let errorCount = 0;
  let lastLogTime = Date.now();
  
  const stream = createStreamParser(parser, delimiter);
  
  const originalOnData = stream.onData;
  stream.onData = (item) => {
    itemCount++;
    
    if (Date.now() - lastLogTime > debugOptions.logInterval) {
      console.log(`Processed ${itemCount} items, ${errorCount} errors`);
      lastLogTime = Date.now();
    }
    
    originalOnData?.(item);
  };
  
  const originalOnError = stream.onError;
  stream.onError = (error) => {
    errorCount++;
    console.error(`Parse error #${errorCount}:`, error);
    originalOnError?.(error);
  };
  
  return stream;
};

// Usage
const debuggedStream = debugStream(
  complexParser,
  str('\n'),
  {
    logLevel: 'debug',
    logInterval: 5000, // Log every 5 seconds
    maxLogEntries: 1000
  }
);
```

This comprehensive guide covers all aspects of async and streaming parsing in Combi-Parse, from basic concepts to advanced real-world implementations. Use these patterns and examples as a foundation for building robust, performant parsing systems that can handle real-time data processing at scale.
