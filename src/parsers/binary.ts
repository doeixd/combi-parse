/**
 * Binary Data Parsing Module
 * 
 * This module provides specialized parsers for working with binary data formats.
 * It offers low-level primitives for parsing structured binary data such as network
 * protocols, file formats, and embedded system communications.
 * 
 * The binary parser system is designed for:
 * - Zero-copy parsing where possible
 * - Type-safe binary data extraction
 * - Composable binary structure definitions
 * - Efficient handling of different endianness
 * 
 * @module parsers/binary
 * @version 1.1.0
 * 
 * @example Parsing a simple binary structure
 * ```typescript
 * import { Binary } from '@doeixd/combi-parse';
 * 
 * const parser = Binary.sequence([
 *   Binary.u16LE,       // Version number (using alias)
 *   Binary.string(10),  // Fixed-length name
 *   Binary.u8           // Flags (using alias)
 * ] as const);
 * 
 * const buffer = new ArrayBuffer(13);
 * const result = parser.parse(buffer, 0);
 * ```
 */

/**
 * Result type for successful binary parsing operations.
 * @template T The type of the parsed value.
 */
export interface BinaryParseSuccess<T> {
  value: T;
  bytesConsumed: number;
}

/**
 * Result type for failed binary parsing operations.
 */
export interface BinaryParseError {
  error: string;
}

/**
 * Union type representing the result of a binary parsing operation.
 * @template T The type of the parsed value on success.
 */
export type BinaryParseResult<T> = BinaryParseSuccess<T> | BinaryParseError;

/**
 * A helper type to infer the success value from a parser.
 * @template P The BinaryParser type.
 */
export type ParserResult<P> = P extends BinaryParser<infer T> ? T : never;

/**
 * Binary parser class that provides composable binary data parsing capabilities.
 * Each parser represents a specific binary format that can be combined with others
 * to parse complex binary structures.
 * 
 * @template T The type of value this parser produces.
 */
export class BinaryParser<T> {
  /**
   * Creates a new binary parser with the given parsing function.
   * 
   * @param parse The function that implements the parsing logic.
   * @param parse.buffer The ArrayBuffer containing binary data.
   * @param parse.offset The starting offset in the buffer.
   * @returns Either a successful parse result or an error object.
   */
  constructor(
    public readonly parse: (buffer: ArrayBuffer, offset: number) => BinaryParseResult<T>
  ) { }

  /**
   * Transforms the parsed value using the provided function.
   * 
   * @template U The type of the transformed value.
   * @param fn The function to transform the parsed value.
   * @returns A new BinaryParser that produces the transformed type.
   * 
   * @example Convert a raw timestamp to a Date object.
   * ```typescript
   * const dateParser = Binary.u32LE.map(timestamp => new Date(timestamp * 1000));
   * ```
   */
  map<U>(fn: (value: T) => U): BinaryParser<U> {
    return new BinaryParser(
      (buffer, offset) => {
        const result = this.parse(buffer, offset);
        if ('error' in result) return result;
        return { value: fn(result.value), bytesConsumed: result.bytesConsumed };
      }
    );
  }

  /**
   * Chains this parser with another parser that depends on the result of this one.
   * Enables conditional parsing based on previously parsed values.
   * 
   * @template U The type produced by the chained parser.
   * @param fn Function that returns a parser based on the parsed value.
   * @returns A new parser that combines both parsing operations.
   * 
   * @example Parse a variable-length structure.
   * ```typescript
   * const varLengthData = Binary.u16LE.chain(length => 
   *   Binary.bytes(length)
   * );
   * ```
   */
  chain<U>(fn: (value: T) => BinaryParser<U>): BinaryParser<U> {
    return new BinaryParser(
      (buffer, offset) => {
        const result = this.parse(buffer, offset);
        if ('error' in result) return result;

        const nextParser = fn(result.value);
        const nextResult = nextParser.parse(buffer, offset + result.bytesConsumed);
        if ('error' in nextResult) return nextResult;

        return {
          value: nextResult.value,
          bytesConsumed: result.bytesConsumed + nextResult.bytesConsumed
        };
      }
    );
  }
}

// Internal helper to create numeric parsers
function createNumericParser<T extends number | bigint>(
  bytes: 1 | 2 | 4 | 8,
  methodName: keyof DataView,
  littleEndian?: boolean
): BinaryParser<T> {
  return new BinaryParser((buffer, offset): BinaryParseResult<T> => {
    if (offset + bytes > buffer.byteLength) {
      return { error: `Not enough bytes for ${String(methodName)}` };
    }
    const view = new DataView(buffer);
    const method = view[methodName];
    if (typeof method === 'function') {
      // TypeScript needs help understanding this is the right function signature
      const value = (method as any).call(view, offset, littleEndian) as T;
      return { value, bytesConsumed: bytes };
    }
    return { error: `Unsupported method: ${String(methodName)}` };
  });
}

/**
 * A static collection of common binary data parsers and combinators.
 * Provides pre-built parsers for standard binary data types and operations.
 * 
 * @namespace Binary
 */
export const Binary = {
  // --- Unsigned Integers ---

  uint8: createNumericParser<number>(1, 'getUint8'),
  uint16LE: createNumericParser<number>(2, 'getUint16', true),
  uint16BE: createNumericParser<number>(2, 'getUint16', false),
  uint32LE: createNumericParser<number>(4, 'getUint32', true),
  uint32BE: createNumericParser<number>(4, 'getUint32', false),
  uint64LE: createNumericParser<bigint>(8, 'getBigUint64', true),
  uint64BE: createNumericParser<bigint>(8, 'getBigUint64', false),

  // --- Signed Integers ---

  int8: createNumericParser<number>(1, 'getInt8'),
  int16LE: createNumericParser<number>(2, 'getInt16', true),
  int16BE: createNumericParser<number>(2, 'getInt16', false),
  int32LE: createNumericParser<number>(4, 'getInt32', true),
  int32BE: createNumericParser<number>(4, 'getInt32', false),
  int64LE: createNumericParser<bigint>(8, 'getBigInt64', true),
  int64BE: createNumericParser<bigint>(8, 'getBigInt64', false),

  // --- Floating Point Numbers ---

  float32LE: createNumericParser<number>(4, 'getFloat32', true),
  float32BE: createNumericParser<number>(4, 'getFloat32', false),
  float64LE: createNumericParser<number>(8, 'getFloat64', true),
  float64BE: createNumericParser<number>(8, 'getFloat64', false),

  /**
   * Creates a parser for fixed-length strings with a specified encoding.
   * 
   * @param length The number of bytes to read.
   * @param encoding The text encoding to use (default: 'utf-8').
   * @returns A parser that extracts a string.
   * 
   * @example Read a 4-byte ASCII magic string.
   * ```typescript
   * const magic = Binary.string(4, 'ascii');
   * ```
   */
  string(length: number, encoding: string = 'utf-8'): BinaryParser<string> {
    return new BinaryParser((buffer, offset): BinaryParseResult<string> => {
      if (offset + length > buffer.byteLength) {
        return { error: `Not enough bytes for string of length ${length}` };
      }
      const bytes = new Uint8Array(buffer, offset, length);
      try {
        const value = new TextDecoder(encoding).decode(bytes);
        return { value, bytesConsumed: length };
      } catch (e) {
        return { error: `Failed to decode string: ${e instanceof Error ? e.message : String(e)}` };
      }
    });
  },

  /**
   * Creates a parser that extracts a raw slice of bytes.
   * 
   * @param length The number of bytes to extract.
   * @returns A parser that produces a Uint8Array.
   */
  bytes(length: number): BinaryParser<Uint8Array> {
    return new BinaryParser((buffer, offset): BinaryParseResult<Uint8Array> => {
      if (offset + length > buffer.byteLength) {
        return { error: `Not enough bytes for byte array of length ${length}` };
      }
      // Return a copy to prevent mutation of the underlying ArrayBuffer
      const value = new Uint8Array(buffer.slice(offset, offset + length));
      return { value, bytesConsumed: length };
    });
  },

  /**
   * Creates a parser that consumes bytes but produces no value.
   * Useful for skipping over padding or reserved fields in a binary structure.
   * 
   * @param bytesToSkip The number of bytes to advance the parser state.
   * @returns A parser that produces `void`.
   */
  skip(bytesToSkip: number): BinaryParser<void> {
    return new BinaryParser((buffer, offset) => {
      if (offset + bytesToSkip > buffer.byteLength) {
        return { error: `Not enough bytes to skip ${bytesToSkip}` };
      }
      return { value: undefined, bytesConsumed: bytesToSkip };
    });
  },

  /**
   * Creates a parser that applies multiple parsers in sequence.
   * Returns a tuple containing all parsed values in order.
   * 
   * @template T Tuple type representing the sequence of parser results.
   * @param parsers An array of parsers to apply, ideally marked with `as const`.
   * @returns A parser that produces a tuple of all parsed values.
   * 
   * @example Parse a user record.
   * ```typescript
   * const userRecord = Binary.sequence([
   *   Binary.u32LE,        // User ID
   *   Binary.string(20),   // Username
   *   Binary.skip(4),      // Reserved bytes
   *   Binary.u8,           // Status flags
   * ] as const);
   * 
   * const result = userRecord.parse(buffer, 0);
   * if (!('error' in result)) {
   *   const [id, username, , flags] = result.value;
   * }
   * ```
   */
  sequence<T extends readonly unknown[]>(
    parsers: [...{ [K in keyof T]: BinaryParser<T[K]> }]
  ): BinaryParser<T> {
    return new BinaryParser((buffer, offset): BinaryParseResult<T> => {
      const results: unknown[] = [];
      let currentOffset = offset;

      for (const parser of parsers) {
        const result = parser.parse(buffer, currentOffset);
        if ('error' in result) return result;

        results.push(result.value);
        currentOffset += result.bytesConsumed;
      }

      return {
        value: results as unknown as T,
        bytesConsumed: currentOffset - offset
      };
    });
  },

  /**
   * Tries a list of parsers and returns the result of the first one that succeeds.
   * The parsers must all produce values of a compatible type.
   * 
   * @param parsers An array of parsers to try in order.
   * @returns A parser that produces a value from the first successful parser.
   * 
   * @example Parse a tagged union value.
   * ```typescript
   * const data = Binary.choice([
   *   Binary.float64LE, // Try parsing as a float first
   *   Binary.int64LE    // Fall back to an integer
   * ]);
   * ```
   */
  choice<T extends readonly BinaryParser<any>[]>(
    parsers: T
  ): BinaryParser<ParserResult<T[number]>> {
    return new BinaryParser((buffer, offset) => {
      let lastError: string = 'No parsers provided to choice.';
      for (const parser of parsers) {
        const result = parser.parse(buffer, offset);
        if (!('error' in result)) {
          return result; // Success, return immediately
        }
        lastError = result.error;
      }
      return { error: `Choice failed: all parsers returned an error. Last error: ${lastError}` };
    });
  },

  /**
   * Creates a parser that reads an array of values.
   * 
   * @template T The type of elements in the array.
   * @param elementParser Parser for individual array elements.
   * @param count Number of elements to parse.
   * @returns A parser that produces an array of parsed values.
   * 
   * @example Parse an array of 10 integers.
   * ```typescript
   * const intArray = Binary.array(Binary.i32LE, 10);
   * ```
   */
  array<T>(elementParser: BinaryParser<T>, count: number): BinaryParser<T[]> {
    return new BinaryParser((buffer, offset): BinaryParseResult<T[]> => {
      const results: T[] = [];
      let currentOffset = offset;

      for (let i = 0; i < count; i++) {
        const result = elementParser.parse(buffer, currentOffset);
        if ('error' in result) {
          return { error: `Array parsing failed at index ${i}: ${result.error}` };
        }
        results.push(result.value);
        currentOffset += result.bytesConsumed;
      }

      return {
        value: results,
        bytesConsumed: currentOffset - offset
      };
    });
  },

  /**
   * Creates a parser that validates the parsed value with a predicate.
   * 
   * @template T The type of value to validate.
   * @param parser The underlying parser.
   * @param predicate Function that returns true if the value is valid.
   * @param errorMessage Optional custom error message.
   * @returns A parser that fails if the predicate returns false.
   * 
   * @example Ensure a version number is supported.
   * ```typescript
   * const version = Binary.validate(
   *   Binary.u16LE,
   *   v => v >= 1 && v <= 3,
   *   'Unsupported version'
   * );
   * ```
   */
  validate<T>(
    parser: BinaryParser<T>,
    predicate: (value: T) => boolean,
    errorMessage: string = 'Validation failed'
  ): BinaryParser<T> {
    return new BinaryParser((buffer, offset) => {
      const result = parser.parse(buffer, offset);
      if ('error' in result) return result;

      if (!predicate(result.value)) {
        return { error: errorMessage };
      }

      return result;
    });
  },

  /**
   * Creates a parser that reads a null-terminated string.
   * 
   * @param maxLength Maximum number of bytes to read (prevents runaway reads).
   * @param encoding The text encoding to use (default: 'utf-8').
   * @returns A parser that extracts a null-terminated string.
   * 
   * @example Read a C-style string.
   * ```typescript
   * const cString = Binary.cstring(256);
   * ```
   */
  cstring(maxLength: number, encoding: string = 'utf-8'): BinaryParser<string> {
    return new BinaryParser((buffer, offset): BinaryParseResult<string> => {
      const view = new Uint8Array(buffer);
      let length = 0;

      while (offset + length < buffer.byteLength && length < maxLength) {
        if (view[offset + length] === 0) break;
        length++;
      }

      if (length === maxLength && offset + length < buffer.byteLength && view[offset + length] !== 0) {
        return { error: `Null terminator not found within ${maxLength} bytes` };
      }

      const bytes = new Uint8Array(buffer, offset, length);
      try {
        const value = new TextDecoder(encoding).decode(bytes);
        return { value, bytesConsumed: length + 1 }; // +1 for null terminator
      } catch (e) {
        return { error: `Failed to decode string: ${e instanceof Error ? e.message : String(e)}` };
      }
    });
  },

  /**
   * Creates a parser that always succeeds with a constant value without consuming bytes.
   * Useful for injecting default values into sequences.
   * 
   * @template T The type of the constant value.
   * @param value The constant value to return.
   * @returns A parser that always succeeds with the given value.
   */
  constant<T>(value: T): BinaryParser<T> {
    return new BinaryParser(() => ({
      value,
      bytesConsumed: 0
    }));
  },

  /**
   * Creates a parser that fails with a specific error message.
   * Useful for creating custom error conditions.
   * 
   * @param message The error message.
   * @returns A parser that always fails.
   */
  fail<T = never>(message: string): BinaryParser<T> {
    return new BinaryParser(() => ({ error: message }));
  },

  // --- Convenience Aliases ---
  u8: createNumericParser<number>(1, 'getUint8'),
  i8: createNumericParser<number>(1, 'getInt8'),
  u16LE: createNumericParser<number>(2, 'getUint16', true),
  u16BE: createNumericParser<number>(2, 'getUint16', false),
  i16LE: createNumericParser<number>(2, 'getInt16', true),
  i16BE: createNumericParser<number>(2, 'getInt16', false),
  u32LE: createNumericParser<number>(4, 'getUint32', true),
  u32BE: createNumericParser<number>(4, 'getUint32', false),
  i32LE: createNumericParser<number>(4, 'getInt32', true),
  i32BE: createNumericParser<number>(4, 'getInt32', false),
  u64LE: createNumericParser<bigint>(8, 'getBigUint64', true),
  u64BE: createNumericParser<bigint>(8, 'getBigUint64', false),
  i64LE: createNumericParser<bigint>(8, 'getBigInt64', true),
  i64BE: createNumericParser<bigint>(8, 'getBigInt64', false),
  f32LE: createNumericParser<number>(4, 'getFloat32', true),
  f32BE: createNumericParser<number>(4, 'getFloat32', false),
  f64LE: createNumericParser<number>(8, 'getFloat64', true),
  f64BE: createNumericParser<number>(8, 'getFloat64', false),
} as const;

/**
 * Example PNG header parser demonstrating binary sequence parsing.
 * This parser validates the PNG file signature according to the PNG specification.
 */
// export const pngHeaderParser = Binary.sequence([
//   Binary.validate(Binary.u8, v => v === 0x89, 'Invalid PNG signature byte 1'),
//   Binary.validate(Binary.string(3, 'ascii'), v => v === 'PNG', 'Invalid PNG signature'),
//   Binary.validate(Binary.u8, v => v === 0x0D, 'Invalid PNG signature byte 5'),
//   Binary.validate(Binary.u8, v => v === 0x0A, 'Invalid PNG signature byte 6'),
//   Binary.validate(Binary.u8, v => v === 0x1A, 'Invalid PNG signature byte 7'),
//   Binary.validate(Binary.u8, v => v === 0x0A, 'Invalid PNG signature byte 8'),
// ] as const);

/**
 * Example: Parse a simple network packet header
 */
// export const networkPacketParser = Binary.sequence([
//   Binary.u16BE,        // Packet length
//   Binary.u8,           // Protocol version
//   Binary.u8,           // Packet type
//   Binary.u32BE,        // Sequence number
//   Binary.u32BE,        // Timestamp
// ] as const).map(([length, version, type, sequence, timestamp]) => ({
//   length,
//   version,
//   type,
//   sequence,
//   timestamp
// }));

/**
 * Example: Parse a variable-length message
 */
// export const variableLengthMessage = Binary.sequence([
//   Binary.u16LE,        // Message length
// ] as const).chain(([length]) =>
//   Binary.sequence([
//     Binary.constant(length),     // Include length in result
//     Binary.string(length),       // Message content
//   ] as const)
// ).map(([length, content]) => ({ length, content }));