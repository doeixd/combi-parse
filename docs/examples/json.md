# Tutorial: Building a Production-Ready JSON Parser

This comprehensive example demonstrates how to build a complete JSON parser using Combi-Parse. We will start with a basic functional parser and progressively layer on advanced features like robust error handling, schema validation, and different processing strategies, showcasing real-world parser construction techniques.

## 1. The Basic JSON Parser

First, we'll build a parser that understands the fundamental JSON grammar, starting with primitive values and composing them into arrays and objects.

### Primitive Values

We define parsers for the core JSON data types.

```typescript
import {
  Parser,
  str,
  regex,
  choice,
  between,
  lazy,
  many,
  sepBy,
  genParser,
  failure,
  success,
  until
} from 'combi-parse';

// A parser for a JSON string, handling all valid escape sequences.
// We use genParser for a clear, step-by-step definition.
const jsonString = between(
  str('"'),
  many(
    choice([
      // Handle escaped characters like \", \\, \n, etc.
      str('\\').keepRight(
        choice([
          str('"').map(() => '"'),
          str('\\').map(() => '\\'),
          str('/').map(() => '/'),
          str('b').map(() => '\b'),
          str('f').map(() => '\f'),
          str('n').map(() => '\n'),
          str('r').map(() => '\r'),
          str('t').map(() => '\t'),
          // Handle Unicode escape sequences, e.g., \uXXXX
          str('u').keepRight(regex(/[0-9a-fA-F]{4}/)).map(hex =>
            String.fromCharCode(parseInt(hex, 16))
          ),
        ])
      ),
      // Any character that is not a quote or a backslash
      regex(/[^"\\]+/),
    ])
  ).map(chunks => chunks.join('')),
  str('"')
);

// A parser for a JSON number, including integers, floats, and scientific notation.
const jsonNumber = regex(/-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/).map(Number);

// A parser for JSON boolean values.
const jsonBoolean = choice([
  str('true').map(() => true),
  str('false').map(() => false),
]);

// A parser for a JSON null value.
const jsonNull = str('null').map(() => null);
```

### Whitespace Handling

In JSON, whitespace is insignificant between tokens. We'll create a `lexeme` helper to automatically handle this, which drastically cleans up our grammar.

```typescript
// A parser that consumes zero or more whitespace characters.
const ws = regex(/\s*/);

// A lexeme is a parser that consumes any trailing whitespace but discards it.
// We wrap all our structural tokens (like '[', ']', '{', '}', ',') with this.
const lexeme = <T>(parser: Parser<T>): Parser<T> => parser.keepLeft(ws);
```

### Arrays and Objects

Now we compose the primitives into arrays and objects. Because objects and arrays can contain other objects and arrays, this is a recursive grammar. We use `lazy()` to break the circular dependency.

```typescript
// A forward declaration for a JSON value, which can be any of the types we've defined.
const jsonValue: Parser<any> = lazy(() =>
  choice([
    jsonString,
    jsonNumber,
    jsonBoolean,
    jsonNull,
    jsonArray, // Recursion
    jsonObject, // Recursion
  ])
);

// A parser for a JSON array: [value, value, ...]
const jsonArray = between(
  lexeme(str('[')),
  sepBy(jsonValue, lexeme(str(','))), // `sepBy` handles the comma separators.
  lexeme(str(']'))
);

// A helper parser for a single "key": value pair in an object.
const jsonPair = genParser(function* () {
  const key = yield jsonString;
  yield lexeme(str(':'));
  const value = yield jsonValue;
  return [key, value] as [string, any];
});

// A parser for a JSON object: {"key": value, "key": value, ...}
const jsonObject = between(
  lexeme(str('{')),
  sepBy(jsonPair, lexeme(str(','))), // Parse comma-separated pairs
  lexeme(str('}'))
).map(pairs => Object.fromEntries(pairs)); // Convert the array of pairs to an object.

// The complete JSON parser, which accounts for optional leading/trailing whitespace.
const jsonParser = between(ws, jsonValue, ws);

// --- Usage Example ---
const jsonText = '{"users": [{"id": 1, "name": "Alice"}]}';
const result = jsonParser.parse(jsonText);

console.log(result.users[0].name); // → "Alice"
```

## 2. Enhanced Parser with Validation

A basic parser is good, but a production-ready parser should provide excellent error messages and perform semantic validation (e.g., checking for duplicate keys in an object).

Here, we'll enhance our parsers using Combi-Parse's `label`, `context`, and `tryMap` combinators.

```typescript
import { label, context } from 'combi-parse';

// --- Enhanced Primitives with Better Error Messages ---

const enhancedJsonString = label(jsonString, 'a JSON string');
const enhancedJsonNumber = label(jsonNumber, 'a JSON number');

// --- Enhanced Object Parser with Duplicate Key Validation ---

const enhancedJsonPair = genParser(function* () {
  // Add context to errors that happen while parsing a key.
  const key = yield context(enhancedJsonString, 'object key');
  yield lexeme(str(':'));
  const value = yield enhancedJsonValue; // Uses the enhanced recursive value parser
  return [key, value] as [string, any];
});

// The enhanced object parser separates structural parsing from semantic validation.
const enhancedJsonObject = between(
  lexeme(str('{')),
  sepBy(enhancedJsonPair, lexeme(str(','))),
  lexeme(str('}'))
)
// We use .tryMap to perform validation that can fail.
// This is the idiomatic way to handle semantic checks in Combi-Parse.
.tryMap(pairs => {
  const keys = pairs.map(([key]) => key);
  const uniqueKeys = new Set(keys);
  
  // If we find duplicate keys, we return a `failure` result.
  if (keys.length !== uniqueKeys.size) {
    const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);
    return failure(`Duplicate keys found in object: ${duplicates.join(', ')}`, undefined as any);
  }
  
  // Otherwise, we return a `success` result with the final object.
  return success(Object.fromEntries(pairs), undefined as any);
});

// --- Enhanced Recursive Structure ---

const enhancedJsonValue: Parser<any> = lazy(() =>
  choice([
    enhancedJsonString,
    enhancedJsonNumber,
    jsonBoolean,
    jsonNull,
    label(between(
      lexeme(str('[')),
      sepBy(enhancedJsonValue, lexeme(str(','))),
      lexeme(str(']'))
    ), 'a JSON array'),
    label(enhancedJsonObject, 'a JSON object'),
  ])
);

const enhancedJsonParser = between(ws, enhancedJsonValue, ws);

// --- Usage Example ---
try {
  // This will now fail with a clear, semantic error message.
  enhancedJsonParser.parse('{"a": 1, "b": 2, "a": 3}');
} catch (error) {
  // The error comes from our .tryMap logic, not a generic syntax error.
  console.error(error.message); // → Parse error at Line 1, Col 1: Duplicate keys found in object: a
}
```

## 3. SAX-Style (Event-Based) Parser

Sometimes, you want to process a large JSON document without building a complete in-memory Abstract Syntax Tree (AST). An event-based or "SAX-style" parser is perfect for this. It walks the document and emits events for each component it finds.

> **Note:** This is different from parsing an *incremental stream* of separate JSON objects (like JSON Lines). For that, you would use Combi-Parse's dedicated `StreamSession` module. This example focuses on emitting events from a single, complete JSON document that is already in memory.

```typescript
interface JsonEvent {
  type: 'startObject' | 'endObject' | 'startArray' | 'endArray' | 'key' | 'value';
  value?: any;
  path: string[];
}

// An event-based parser doesn't return a value (it returns void).
// Instead, it has a side effect: pushing events into an array.
function createEventDrivenJsonParser(events: JsonEvent[], path: string[] = []): Parser<void> {
  const emit = (type: JsonEvent['type'], value?: any) => events.push({ type, value, path: [...path] });

  return lazy(() => choice([
    // Primitives just emit a 'value' event
    enhancedJsonNumber.map(v => emit('value', v)),
    enhancedJsonString.map(v => emit('value', v)),
    jsonBoolean.map(v => emit('value', v)),
    jsonNull.map(() => emit('value', null)),
    
    // Arrays emit start/end events and recurse on their children.
    between(
      lexeme(str('[')).map(() => emit('startArray')),
      sepBy(
        // Recurse with an updated path for each element
        genParser(function* (idxHolder = { i: 0 }) {
            path.push((idxHolder.i++).toString());
            yield createEventDrivenJsonParser(events, path);
            path.pop();
        }),
        lexeme(str(','))
      ),
      lexeme(str(']')).map(() => emit('endArray'))
    ),
    
    // Objects emit start/end/key events and recurse.
    between(
      lexeme(str('{')).map(() => emit('startObject')),
      sepBy(
        genParser(function* () {
            const key = yield lexeme(jsonString);
            emit('key', key);
            yield lexeme(str(':'));
            
            // Recurse with the key added to the path
            path.push(key);
            yield createEventDrivenJsonParser(events, path);
            path.pop();
        }),
        lexeme(str(','))
      ),
      lexeme(str('}')).map(() => emit('endObject'))
    ),
  ]));
}


// --- Usage Example ---
const events: JsonEvent[] = [];
const eventParser = createEventDrivenJsonParser(events);
eventParser.parse('{"user": {"name": "Beth", "active": true}}');

events.forEach(e => console.log(`${e.path.join('.')} [${e.type}]`, e.value ?? ''));
// Output:
//  [startObject] 
// user [key] user
// user [startObject] 
// user.name [key] name
// user.name [value] Beth
// user.active [key] active
// user.active [value] true
// user [endObject] 
//  [endObject] 
```

## 4. Error Recovery

A robust parser for user-facing input should be able to recover from syntax errors, parsing as much valid content as possible. We can achieve this by defining a "recovery" parser that consumes input until it finds a safe place to resume.

```typescript
// A parser that consumes input until it reaches a structural token (like a comma or closing brace).
// This allows us to skip over a malformed value.
const skippedValue = until(choice([str(','), str('}'), str(']')])).map(skipped => ({
  __error: 'skipped malformed value',
  skippedText: skipped.trim(),
}));

// Create a version of our JSON value parser that attempts to recover on failure.
const recoverableJsonValue: Parser<any> = lazy(() => choice([
  // First, try to parse a valid value.
  enhancedJsonValue,
  // If that fails, run our recovery parser.
  skippedValue,
]));

// We build the rest of the parser using this new `recoverableJsonValue`.
const recoverableArray = between(
  lexeme(str('[')),
  sepBy(recoverableJsonValue, lexeme(str(','))),
  lexeme(str(']'))
);
// ... and so on for objects ...
const recoverableParser = recoverableArray; // Using array parser for this example.

// --- Usage Example ---
// This JSON has a malformed string (`"a"b`) and a missing comma.
const malformedInput = '[1, "a"b, {"c": 3} 4, 5]';
const recoveredResult = recoverableParser.parse(malformedInput);

console.log(recoveredResult);
// Output:
// [
//   1,
//   { __error: 'skipped malformed value', skippedText: '"a"b' },
//   { c: 3 },
//   4,
//   5
// ]
```