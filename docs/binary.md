# Binary Data Parsing Guide

Combi-Parse provides a dedicated, powerful module for parsing structured binary data. It's designed for performance, type safety, and composability, making it ideal for working with network protocols, file formats, or any other byte-oriented data.

## 📖 Core Concepts

The binary parsing system is built around the `BinaryParser<T>` class, which is analogous to the `Parser<T>` class for strings but operates on `ArrayBuffer`s.

1.  **Immutability:** Binary parsers are immutable. Operations like `.map()` and `.chain()` return a *new* parser instance, allowing you to safely build complex parsers without side effects.
2.  **State Management:** The parser's state is simple: it tracks the current `offset` (in bytes) within the source `ArrayBuffer`. Each successful parse operation consumes bytes and returns a new offset for the next operation.
3.  **Composability:** Just like string parsers, simple binary parsers (e.g., for an 8-bit integer) can be combined to define complex, nested binary structures.
4.  **Endianness:** The library explicitly handles both Little Endian (`LE`) and Big Endian (`BE`) byte orders, which is critical for cross-platform compatibility.

## 🚀 Getting Started: Parsing a Simple Header

Let's parse a common type of binary header: a 2-byte magic number, a 1-byte version, and a 1-byte status flag.

```typescript
import { Binary } from '@doeixd/combi-parse';

// Define the structure of the header using `Binary.sequence`.
const headerParser = Binary.sequence([
  Binary.u16BE,    // A 16-bit unsigned integer, Big Endian (e.g., 0xCAFE)
  Binary.u8,       // An 8-bit unsigned integer for the version
  Binary.u8,       // An 8-bit unsigned integer for the status flags
] as const);       // `as const` helps TypeScript infer a precise tuple type.

// Create a sample buffer to parse.
// Let's represent the data: 0xCA 0xFE 0x01 0x80
const buffer = new Uint8Array([0xCA, 0xFE, 0x01, 0x80]).buffer;

// Run the parser. The result is a simple object, not an exception.
const result = headerParser.parse(buffer, 0);

if (!('error' in result)) {
  // Success! The `value` is a tuple of the parsed results.
  const [magicNumber, version, flags] = result.value;
  
  console.log(`Magic Number: ${magicNumber.toString(16)}`); // "cafe"
  console.log(`Version: ${version}`);                       // 1
  console.log(`Flags: ${flags.toString(2)}`);              // "10000000"
  console.log(`Bytes Consumed: ${result.bytesConsumed}`);    // 4
} else {
  // Handle the error if parsing fails.
  console.error(`Parsing failed: ${result.error}`);
}
```

## 🛠️ The `Binary` Namespace: Your Toolkit

All parsers and combinators are available under the static `Binary` namespace.

### Primitive Data Types

A comprehensive set of parsers for standard numeric types is provided, with explicit endianness.

-   **Unsigned Integers:** `u8`, `u16LE`, `u16BE`, `u32LE`, `u32BE`, `u64LE`, `u64BE` (64-bit parsers produce a `bigint`).
-   **Signed Integers:** `i8`, `i16LE`, `i16BE`, `i32LE`, `i32BE`, `i64LE`, `i64BE` (64-bit parsers produce a `bigint`).
-   **Floating-Point:** `f32LE`, `f32BE`, `f64LE`, `f64BE`.

### Common Binary Structures

-   `Binary.string(length, encoding)`: Parses a fixed-length string (e.g., `'utf-8'`).
-   `Binary.cstring(maxLength, encoding)`: Parses a null-terminated string (C-style).
-   `Binary.bytes(length)`: Extracts a raw `Uint8Array` slice of a fixed length.
-   `Binary.skip(bytesToSkip)`: Skips a fixed number of bytes, useful for padding or reserved fields.

## ✨ Composing Parsers

You can build complex parsers by combining simpler ones.

### `Binary.sequence`

Parses a fixed sequence of fields, returning the results in a tuple. This is the most common combinator for defining structured records.

```typescript
const userParser = Binary.sequence([
  Binary.u32LE,        // User ID
  Binary.string(20),   // Fixed-length username
  Binary.skip(4),      // 4 bytes of reserved space
  Binary.u8,           // Status flag
] as const);

// The resulting type is: BinaryParser<[number, string, void, number]>
```

### `Binary.array`

Parses a fixed-size array where every element has the same type.

```typescript
// A parser for an array of 16 3D points (x, y, z floats).
const pointParser = Binary.sequence([Binary.f32LE, Binary.f32LE, Binary.f32LE]);
const geometryParser = Binary.array(pointParser, 16);

// Resulting type: BinaryParser<[number, number, number][]>
```

### `Binary.choice`

Tries an array of parsers in order and succeeds with the result of the first one that works. This is useful for parsing tagged unions or data formats with multiple possible record types.

```typescript
// A packet can contain either a string or a float.
const textPacket = Binary.string(8);
const dataPacket = Binary.f64LE;

const packetPayload = Binary.choice([textPacket, dataPacket]);
// Resulting type: BinaryParser<string | number>
```

## 🌀 Dynamic & Context-Sensitive Parsing

Sometimes, the structure of later data depends on the value of earlier data. The `.chain()` method enables this dynamic behavior.

### `.chain()` for Variable-Length Data

A classic example is a length-prefixed string, where a number tells you how many bytes to read next.

```typescript
// Parse a message where the first 2 bytes define the length of the string that follows.
const messageParser = Binary.u16LE.chain(length => {
  // The `length` value from the first parser is now available.
  // We return a *new* parser for the rest of the data.
  return Binary.string(length);
});

// Create a buffer for "3, 'abc'"
// 0x03 0x00 (length 3, LE) + 'a', 'b', 'c'
const buffer = new Uint8Array([0x03, 0x00, 0x61, 0x62, 0x63]).buffer;
const result = messageParser.parse(buffer, 0); // -> { value: "abc", bytesConsumed: 5 }
```

### `.chain()` for Tagged Unions

Another common use case is parsing a structure where a "type" field determines the format of the rest of the payload.

```typescript
const payloadParser = (type: number): BinaryParser<string | number> => {
  if (type === 0x01) { // Type 1 is a string payload
    return Binary.string(8);
  } else if (type === 0x02) { // Type 2 is a float payload
    return Binary.f32LE;
  }
  return Binary.fail('Unknown payload type'); // Fail for unknown types
};

const taggedUnionParser = Binary.u8.chain(type => 
  payloadParser(type)
);
```

##  Transforming and Validating Data

### `.map()` for Transformations

Use `.map()` to transform a parsed value into a more useful type without changing the parsing logic.

```typescript
// Parse a 32-bit Unix timestamp and map it to a JavaScript Date object.
const dateParser = Binary.u32BE.map(timestamp => new Date(timestamp * 1000));
```

You can also use `.map()` with `Binary.sequence` to transform the result tuple into a structured object, which is highly recommended for readability.

```typescript
const networkPacketParser = Binary.sequence([
  Binary.u16BE,        // Packet length
  Binary.u8,           // Protocol version
  Binary.u8,           // Packet type
] as const).map(([length, version, type]) => ({
  // The tuple is mapped to a clean object.
  length,
  version,
  type
}));
```

### `Binary.validate()` for Assertions

Use `Binary.validate()` to ensure a parsed value meets certain criteria, failing the parse if it doesn't. This is perfect for validating magic numbers, version fields, or checksums.

```typescript
// Create a parser that only accepts version 2.
const versionParser = Binary.validate(
  Binary.u8,
  (v) => v === 2,
  "Unsupported version! Must be 2."
);

// Define a parser for the PNG file signature and validate it.
const pngSignature = Binary.validate(
  Binary.bytes(8),
  (bytes) => bytes.every((b, i) => b === [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A][i]),
  'Invalid PNG file signature.'
);
```