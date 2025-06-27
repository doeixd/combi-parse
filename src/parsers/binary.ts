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
 * @version 1.0.0
 * 
 * @example Parsing a simple binary structure
 * ```typescript
 * import { Binary } from '@combi-parse/parsers/binary';
 * 
 * const parser = Binary.sequence([
 *   Binary.uint16LE,    // Version number
 *   Binary.string(10),  // Fixed-length name
 *   Binary.uint8        // Flags
 * ] as const);
 * 
 * const buffer = new ArrayBuffer(13);
 * const result = parser.parse(buffer, 0);
 * ```
 * 
 * @example Parsing PNG file header
 * ```typescript
 * const pngHeader = Binary.sequence([
 *   Binary.uint8,       // PNG signature start
 *   Binary.string(3),   // "PNG"
 *   Binary.uint8,       // CR
 *   Binary.uint8,       // LF
 *   Binary.uint8,       // SUB
 *   Binary.uint8        // LF
 * ] as const);
 * ```
 */

/**
 * Binary parser class that provides composable binary data parsing capabilities.
 * Each parser represents a specific binary format that can be combined with others
 * to parse complex binary structures.
 * 
 * @template T The type of value this parser produces
 * 
 * @example Creating a custom binary parser
 * ```typescript
 * const timestampParser = new BinaryParser<Date>((buffer, offset) => {
 *   if (offset + 8 > buffer.byteLength) {
 *     return { error: 'Not enough bytes for timestamp' };
 *   }
 *   const view = new DataView(buffer);
 *   const timestamp = view.getBigUint64(offset, true);
 *   return { 
 *     value: new Date(Number(timestamp)), 
 *     bytesConsumed: 8 
 *   };
 * });
 * ```
 */
export class BinaryParser<T> {
  /**
   * Creates a new binary parser with the given parsing function.
   * 
   * @param parse Function that parses binary data from a buffer
   * @param parse.buffer The ArrayBuffer containing binary data
   * @param parse.offset Starting offset in the buffer
   * @returns Either a successful parse result or an error
   * 
   * @example
   * ```typescript
   * const parser = new BinaryParser((buffer, offset) => {
   *   // Custom parsing logic
   *   return { value: parsedData, bytesConsumed: 4 };
   * });
   * ```
   */
  constructor(
    public readonly parse: (buffer: ArrayBuffer, offset: number) =>
      { value: T; bytesConsumed: number } | { error: string }
  ) { }

  /**
   * Transforms the parsed value using the provided function.
   * This allows for post-processing of binary data after parsing.
   * 
   * @template U The type of the transformed value
   * @param fn Function to transform the parsed value
   * @returns A new BinaryParser that produces the transformed type
   * 
   * @example Converting raw bytes to a string
   * ```typescript
   * const rawBytes = Binary.sequence([Binary.uint8, Binary.uint8]);
   * const asciiChars = rawBytes.map(([a, b]) => 
   *   String.fromCharCode(a) + String.fromCharCode(b)
   * );
   * ```
   * 
   * @example Converting timestamp to Date object
   * ```typescript
   * const unixTimestamp = Binary.uint32LE;
   * const dateParser = unixTimestamp.map(timestamp => new Date(timestamp * 1000));
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
}

/**
 * Collection of common binary data parsers.
 * Provides pre-built parsers for standard binary data types and operations.
 * 
 * @namespace Binary
 * 
 * @example Reading network packet header
 * ```typescript
 * const packetHeader = Binary.sequence([
 *   Binary.uint16LE,    // Packet length
 *   Binary.uint8,       // Protocol version
 *   Binary.uint8        // Flags
 * ] as const);
 * 
 * const [length, version, flags] = packetHeader.parse(buffer, 0).value;
 * ```
 */
export const Binary = {
  /**
   * Parses a single unsigned 8-bit integer (byte).
   * 
   * @type {BinaryParser<number>}
   * 
   * @example Reading a byte value
   * ```typescript
   * const buffer = new ArrayBuffer(1);
   * new DataView(buffer).setUint8(0, 255);
   * const result = Binary.uint8.parse(buffer, 0);
   * console.log(result.value); // 255
   * ```
   * 
   * @example Using in a sequence
   * ```typescript
   * const rgbColor = Binary.sequence([
   *   Binary.uint8,  // Red
   *   Binary.uint8,  // Green
   *   Binary.uint8   // Blue
   * ] as const);
   * ```
   */
  uint8: new BinaryParser((buffer, offset) => {
    if (offset >= buffer.byteLength) {
      return { error: 'Not enough bytes for uint8' };
    }
    const view = new DataView(buffer);
    return { value: view.getUint8(offset), bytesConsumed: 1 };
  }),

  /**
   * Parses an unsigned 16-bit integer in little-endian format.
   * 
   * @type {BinaryParser<number>}
   * 
   * @example Reading a port number
   * ```typescript
   * const buffer = new ArrayBuffer(2);
   * new DataView(buffer).setUint16(0, 8080, true); // little-endian
   * const result = Binary.uint16LE.parse(buffer, 0);
   * console.log(result.value); // 8080
   * ```
   * 
   * @example Reading file header magic number
   * ```typescript
   * const fileHeader = Binary.sequence([
   *   Binary.uint16LE,  // Magic number
   *   Binary.uint16LE   // Version
   * ] as const);
   * ```
   */
  uint16LE: new BinaryParser((buffer, offset) => {
    if (offset + 2 > buffer.byteLength) {
      return { error: 'Not enough bytes for uint16' };
    }
    const view = new DataView(buffer);
    return { value: view.getUint16(offset, true), bytesConsumed: 2 };
  }),

  /**
   * Creates a parser for fixed-length strings.
   * Decodes bytes as UTF-8 text.
   * 
   * @param length The number of bytes to read
   * @returns A parser that extracts a string of the specified byte length
   * 
   * @example Reading a fixed-length identifier
   * ```typescript
   * const buffer = new ArrayBuffer(4);
   * const view = new Uint8Array(buffer);
   * view[0] = 0x48; // 'H'
   * view[1] = 0x54; // 'T'
   * view[2] = 0x54; // 'T'
   * view[3] = 0x50; // 'P'
   * 
   * const result = Binary.string(4).parse(buffer, 0);
   * console.log(result.value); // "HTTP"
   * ```
   * 
   * @example Reading null-terminated-like fields
   * ```typescript
   * const recordParser = Binary.sequence([
   *   Binary.uint32LE,     // Record ID
   *   Binary.string(32),   // Name field (32 bytes)
   *   Binary.string(64)    // Description field (64 bytes)
   * ] as const);
   * ```
   */
  string(length: number): BinaryParser<string> {
    return new BinaryParser((buffer, offset) => {
      if (offset + length > buffer.byteLength) {
        return { error: `Not enough bytes for string of length ${length}` };
      }
      const bytes = new Uint8Array(buffer, offset, length);
      const value = new TextDecoder().decode(bytes);
      return { value: value || '', bytesConsumed: length };
    });
  },

  /**
   * Creates a parser that applies multiple parsers in sequence.
   * Returns a tuple containing all parsed values in order.
   * 
   * @template T Tuple type representing the sequence of parser results
   * @param parsers Array of parsers to apply in sequence
   * @returns A parser that produces a tuple of all parsed values
   * 
   * @throws {Error} If any parser in the sequence fails
   * 
   * @example Parsing a complete binary record
   * ```typescript
   * const userRecord = Binary.sequence([
   *   Binary.uint32LE,     // User ID
   *   Binary.string(20),   // Username
   *   Binary.uint8,        // Age
   *   Binary.uint8         // Status flags
   * ] as const);
   * 
   * const [id, username, age, flags] = userRecord.parse(buffer, 0).value;
   * ```
   * 
   * @example Parsing nested structures
   * ```typescript
   * const point3D = Binary.sequence([
   *   Binary.uint32LE,  // X coordinate
   *   Binary.uint32LE,  // Y coordinate
   *   Binary.uint32LE   // Z coordinate
   * ] as const);
   * 
   * const mesh = Binary.sequence([
   *   Binary.uint16LE,  // Vertex count
   *   point3D,          // Center point
   *   Binary.uint8      // Mesh type
   * ] as const);
   * ```
   */
  sequence<T extends readonly any[]>(
    parsers: [...{ [K in keyof T]: BinaryParser<T[K]> }]
  ): BinaryParser<T> {
    return new BinaryParser((buffer, offset) => {
      const results: any[] = [];
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
  }
};

/**
 * Example PNG header parser demonstrating binary sequence parsing.
 * This parser validates the PNG file signature according to the PNG specification.
 * 
 * PNG files start with an 8-byte signature:
 * - 0x89: High bit set to detect systems that don't support 8-bit data
 * - "PNG": File type identifier
 * - 0x0D 0x0A: DOS line ending to detect DOS-Unix line ending conversion
 * - 0x1A: Character that stops display on DOS when typed
 * - 0x0A: Unix line ending to detect Unix-DOS line ending conversion
 * 
 * @example Validating a PNG file
 * ```typescript
 * const pngSignature = Binary.sequence([
 *   Binary.uint8,     // 0x89
 *   Binary.string(3), // "PNG"
 *   Binary.uint8,     // 0x0D
 *   Binary.uint8,     // 0x0A
 *   Binary.uint8,     // 0x1A
 *   Binary.uint8      // 0x0A
 * ] as const);
 * 
 * const result = pngSignature.parse(fileBuffer, 0);
 * if ('error' in result) {
 *   console.error('Not a valid PNG file');
 * } else {
 *   const [signature, type, ...rest] = result.value;
 *   console.log('PNG file detected:', signature === 0x89 && type === 'PNG');
 * }
 * ```
 */
const _pngHeader = Binary.sequence([
  Binary.uint8,              // 0x89
  Binary.string(3),          // "PNG"
  Binary.uint8,              // 0x0D
  Binary.uint8,              // 0x0A
  Binary.uint8,              // 0x1A
  Binary.uint8,              // 0x0A
] as const);