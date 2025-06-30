Of course. By integrating the information about the generator-based parsing style, I can create a much more comprehensive and powerful guide. This version will not only explain *what* tools to use for streaming but also *how* to build the parsers themselves in a modern, readable way, and then show how these two concepts compose beautifully.

Here is the rewritten, definitive guide.

***

# The Complete Guide to Async, Streaming, and Generator Parsing

Combi-Parse offers a sophisticated suite of tools for handling asynchronous data, real-time streams, and complex grammars. This guide covers everything from the two primary styles of parser construction to the powerful execution engines for streaming and async logic, showing how they all fit together.

## 📖 Core Concepts: A Two-Part System

Think of the library as having two distinct but complementary parts:

1.  **Parser Construction (The "How"):** How do you write the logic for your parser?
    *   **Combinator Style:** The classic approach using functions like `sequence` and methods like `.chain()` to build a parser tree.
    *   **Generator Style (`genParser`):** A modern, imperative style using JavaScript generators (`function*`) for more readable and maintainable sequential logic.

2.  **Parser Execution (The "Where"):** Where and how is your parser being run?
    *   **On a String:** The standard `.parse(string)` method.
    *   **On a Data Stream (`StreamSession`):** For parsing items from a continuous stream (files, network).
    *   **With Async I/O (`asyncGenParser`):** For when the parser's logic needs to `await` external operations (API calls, DB queries).

**The key takeaway is that you can build your parser using *either* style and then run it using the appropriate execution engine.**

---

## 🏗️ Part 1: How to Build Your Parser

Before streaming, you need a parser. Here are your two options.

### Style 1: The Combinator Approach

This is the traditional method, great for concise definitions of simple structures.

```typescript
import { sequence, str, regex, choice, number } from '@doeixd/combi-parse';

const assignmentParser = sequence([
  regex(/[a-z]+/),   // key
  str(' = '),
  choice([
    number,
    str('true').map(() => true)
  ])
]).map(([key, , value]) => ({ [key]: value }));

assignmentParser.parse('x = 123'); // { x: 123 }
```

### Style 2: The Generator Approach (`genParser`)

For complex, multi-step logic, the generator style is often far more readable. It looks like standard, imperative code.

-   **`genParser(function* () { ... })`**: The main wrapper.
-   **`yield parser`**: Runs a parser and gets its result.
-   **`return value`**: Defines the final result of the `genParser`.

```typescript
import { genParser, gen } from '@doeixd/combi-parse/generator';
import { str, regex, number } from '@doeixd/combi-parse';

const assignmentParser = genParser(function* () {
  const key = yield regex(/[a-z]+/);
  yield str(' = ');
  
  // The gen object provides helper functions for common patterns
  const value = yield* gen.tryParsers(
    number,
    str('true').map(() => true),
    str('false').map(() => false)
  );

  if (value === null) {
    throw new Error("Expected a value for assignment");
  }

  return { [key]: value };
});

assignmentParser.parse('y = true'); // { y: true }
```

**Recommendation:** Use the generator style for any parser with more than a few sequential steps. It is easier to read, debug, and maintain.

---

## 🌊 Part 2: How to Execute Your Parser on Streams & Async Data

Now that you have an `itemParser`, you can plug it into an execution engine.

### `StreamSession`: The Workhorse for Data Streams

The `StreamSession` is the most robust and feature-rich solution for parsing delimited items from a continuous data stream (e.g., NDJSON, log files). It is event-driven and handles buffering, backpressure, and error recovery automatically.

#### Example: Parsing a Log Stream with a `genParser`

Let's build a parser for log lines like `[2023-10-27T10:00:00Z] ERROR: Database connection failed.` and use it in a stream.

```typescript
import { createStreamSession, lift } from '@doeixd/combi-parse/stream';
import { genParser, gen } from '@doeixd/combi-parse/generator';
import { str, regex, choice, whitespace } from '@doeixd/combi-parse';

// 1. Define the item parser using the generator style.
const logEntryParser = genParser(function* () {
  yield str('[');
  const timestamp = yield regex(/[^\]]+/);
  yield str('] ');

  const level = yield choice([str('ERROR'), str('WARN'), str('INFO')]);
  yield str(': ');

  const message = yield regex(/.*/); // Take the rest of the line

  return { timestamp, level, message };
});

// 2. Create the stream session.
// We `lift` our `genParser`-built parser into the stream's context.
const session = createStreamSession(
  lift(logEntryParser),
  lift(whitespace)       // Newlines are handled by `whitespace`
);

// 3. Set up event handlers.
session.on('item', ({ value: log }) => {
  if (log.level === 'ERROR') {
    console.error(`ALERT! ${log.message}`);
  } else {
    console.log(`[${log.level}] ${log.message}`);
  }
});

session.on('end', (results) => console.log(`Processed ${results.length} logs.`));

// 4. Feed data chunks.
session.feed('[2023-10-27T10:00:00Z] INFO: User logged in\n');
session.feed('[2023-10-27T10:00:01Z] ERROR: Database co'); // Incomplete chunk
session.feed('nnection failed\n');

session.end();

// Output:
// [INFO] User logged in
// ALERT! Database connection failed
// Processed 2 logs.
```

### `asyncGenParser`: The Specialist for Async Logic

Use this **only when the grammar itself requires `await`ing a promise**. It's for enriching or validating data mid-parse using an external source.

#### Example: Enriching a Stream of Product IDs from a Database

Imagine a stream of product IDs. For each ID, we need to fetch its details from a database asynchronously.

```typescript
import { asyncGenParser } from '@doeixd/combi-parse/async';
import { gen } from '@doeixd/combi-parse/generator';
import { createAsyncStreamParser } from '@doeixd/combi-parse/async';
import { regex, whitespace, lookahead, eof } from '@doeixd/combi-parse';

// Mock DB function
async function fetchProductDetails(id: string) {
  console.log(`(DB) Fetching details for ${id}...`);
  // In a real app, this would be a network call.
  return new Promise(resolve => 
    setTimeout(() => resolve({ id, name: `Product ${id}`, price: Math.random() * 100 }), 50)
  );
}

// 1. Define the async parser. It parses one ID and fetches its data.
const enrichedProductParser = asyncGenParser(async function* () {
  const id = yield regex(/[a-z0-9-]+/);
  yield whitespace.optional();

  // The key feature: await a promise inside the parser.
  const details = await fetchProductDetails(id);

  return details;
});

// 2. Use a low-level stream processor to apply our async parser to a stream.
const streamParser = createAsyncStreamParser(enrichedProductParser);

// 3. Create a stream of product IDs.
const idStream = new ReadableStream({
  start(controller) {
    controller.enqueue(new TextEncoder().encode('prod-123 prod-456 prod-789'));
    controller.close();
  }
});

// 4. Process the stream, getting fully enriched objects.
async function processProducts() {
  for await (const product of streamParser.parse(idStream)) {
    console.log('Processed:', product);
  }
  console.log('All products processed.');
}

processProducts();
```

---

## 🧩 Putting It All Together: Advanced Composition

The true power of Combi-Parse comes from composing these features.

### Example: A Multi-Format WebSocket Log Analyzer

This example combines a `StreamSession` with a `genParser` that itself uses `gen.tryParsers` to handle multiple log formats arriving on the same stream.

```typescript
// Define parsers for different log formats
const nginxLogParser = genParser(function* () { /* ... */ }).map(data => ({ format: 'nginx', ...data }));
const appLogParser = genParser(function* () { /* ... */ }).map(data => ({ format: 'application', ...data }));

// A single item parser that can handle either format
const multiFormatLogParser = genParser(function* () {
  const log = yield* gen.tryParsers(nginxLogParser, appLogParser);
  if (!log) {
    throw new Error("Unknown log format");
  }
  return log;
});

// Use it in a stream session
const session = createStreamSession(lift(multiFormatLogParser), lift(whitespace));

// Connect to a WebSocket
const ws = new WebSocket('ws://localhost:8080/logs');
ws.onmessage = event => {
  session.feed(event.data);
};
```

---

## ⚡ Quick API Reference

| Name                    | Module          | Style / Purpose                                                                          |
| :---------------------- | :-------------- | :--------------------------------------------------------------------------------------- |
| `genParser`             | `generator`     | **(Construction)** Build a synchronous parser using a readable, imperative generator style.    |
| `gen`                   | `generator`     | **(Construction)** A helper object with utilities (`tryParsers`, `while`) for `genParser`. |
| `createStreamSession`   | `stream`        | **(Execution)** Event-driven engine for parsing delimited items from a data stream.      |
| `lift`                  | `stream`        | A utility to make a standard `Parser` compatible with `createStreamSession`.             |
| `asyncGenParser`        | `async`         | **(Execution)** Specialized engine for parsers whose logic contains `await` calls.       |
| `createAsyncStreamParser` | `async`         | **(Execution)** Low-level "pull" style engine to run a parser over a `ReadableStream`.   |
| `transformStream`       | `async`         | High-level utility for simple `parse -> transform` pipelines on a stream.                |
| `batchParser`           | `async`         | A **synchronous** performance tool for parsing many items from an in-memory string chunk. |

---

## ⚠️ Gotchas & Best Practices

1.  **`genParser` vs. `asyncGenParser`**: This is the most critical distinction.
    *   `genParser` is **synchronous**. It's for improving the *style* of your parser logic.
    *   `asyncGenParser` is **asynchronous**. It's for when your logic must `await` a Promise.
    *   Using one where you need the other will not work.

2.  **Consuming Parsers are Essential for Streams**: Any parser used to define a stream item or delimiter **must consume input on success**. A parser like `optional(str(','))` can succeed on empty input, which will cause an infinite loop in a streaming context as the buffer will never shrink.

3.  **Lift Your Parsers for `StreamSession`**: `StreamSession` operates in a special context. You **must** wrap your item and delimiter parsers with `lift()` to make them compatible: `createStreamSession(lift(itemParser), lift(delimiterParser))`.

4.  **Manage Memory in Event Handlers**: Streaming avoids loading the *source* into memory, but you can still run out of memory if you collect all the *results* in an array. For large streams, process items as they arrive in the `on('item', ...)` event handler or `for await` loop, and then discard them.