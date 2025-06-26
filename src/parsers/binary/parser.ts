// Binary parser primitives
export class BinaryParser<T> {
  constructor(
    public readonly parse: (buffer: ArrayBuffer, offset: number) =>
      { value: T; bytesConsumed: number } | { error: string }
  ) { }

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

export const Binary = {
  uint8: new BinaryParser((buffer, offset) => {
    if (offset >= buffer.byteLength) {
      return { error: 'Not enough bytes for uint8' };
    }
    const view = new DataView(buffer);
    return { value: view.getUint8(offset), bytesConsumed: 1 };
  }),

  uint16LE: new BinaryParser((buffer, offset) => {
    if (offset + 2 > buffer.byteLength) {
      return { error: 'Not enough bytes for uint16' };
    }
    const view = new DataView(buffer);
    return { value: view.getUint16(offset, true), bytesConsumed: 2 };
  }),

  string(length: number): BinaryParser<string> {
    return new BinaryParser((buffer, offset) => {
      if (offset + length > buffer.byteLength) {
        return { error: `Not enough bytes for string of length ${length}` };
      }
      const bytes = new Uint8Array(buffer, offset, length);
      const value = new TextDecoder().decode(bytes);
      return { value, bytesConsumed: length };
    });
  },

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
        value: results as T,
        bytesConsumed: currentOffset - offset
      };
    });
  }
};

// Usage: Parse PNG header
const pngHeader = Binary.sequence([
  Binary.uint8,              // 0x89
  Binary.string(3),          // "PNG"
  Binary.uint8,              // 0x0D
  Binary.uint8,              // 0x0A
  Binary.uint8,              // 0x1A
  Binary.uint8,              // 0x0A
] as const);