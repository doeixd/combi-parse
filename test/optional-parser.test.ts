import { describe, it, expect } from 'vitest';
import { optional, str, number, regex, sequence, choice, many } from '../src/parser';

describe('Optional Parser Comprehensive Tests', () => {
  describe('Basic optional behavior', () => {
    it('should return value when underlying parser succeeds', () => {
      const parser = optional(str('hello'));
      expect(parser.parse('hello')).toBe('hello');
    });

    it('should return null when underlying parser fails', () => {
      const parser = optional(str('hello'));
      expect(parser.parse('world')).toBeNull();
    });

    it('should not consume input when underlying parser fails', () => {
      const parser = optional(str('hello'));
      const state = { input: 'world', index: 0 };
      const result = parser.run(state);
      
      expect(result.type).toBe('success');
      expect(result.value).toBeNull();
      expect(result.state.index).toBe(0); // No input consumed
    });

    it('should consume input when underlying parser succeeds', () => {
      const parser = optional(str('hello'));
      const state = { input: 'hello world', index: 0 };
      const result = parser.run(state);
      
      expect(result.type).toBe('success');
      expect(result.value).toBe('hello');
      expect(result.state.index).toBe(5); // 'hello' consumed
    });
  });

  describe('Optional with different parser types', () => {
    it('should work with number parser', () => {
      const parser = optional(number);
      expect(parser.parse('123')).toBe(123);
      expect(parser.parse('abc')).toBeNull();
    });

    it('should work with regex parser', () => {
      const parser = optional(regex(/\d+/));
      expect(parser.parse('123')).toBe('123');
      expect(parser.parse('abc')).toBeNull();
    });

    it('should work with sequence parser', () => {
      const parser = optional(sequence([str('hello'), str(' '), str('world')]));
      expect(parser.parse('hello world')).toEqual(['hello', ' ', 'world']);
      expect(parser.parse('goodbye')).toBeNull();
    });

    it('should work with choice parser', () => {
      const parser = optional(choice([str('yes'), str('no')]));
      expect(parser.parse('yes')).toBe('yes');
      expect(parser.parse('no')).toBe('no');
      expect(parser.parse('maybe')).toBeNull();
    });

    it('should work with many parser', () => {
      const parser = optional(many(str('a')));
      expect(parser.parse('aaa')).toEqual(['a', 'a', 'a']);
      expect(parser.parse('bbb')).toEqual([]); // many returns [] when no matches
    });
  });

  describe('Nested optional parsers', () => {
    it('should handle optional of optional', () => {
      const parser = optional(optional(str('hello')));
      expect(parser.parse('hello')).toBe('hello');
      expect(parser.parse('world')).toBeNull();
    });

    it('should work in sequences with other optional parsers', () => {
      const parser = sequence([
        optional(str('Mr. ')),
        str('John'),
        optional(str(' Smith'))
      ]);
      
      expect(parser.parse('John')).toEqual([null, 'John', null]);
      expect(parser.parse('Mr. John')).toEqual(['Mr. ', 'John', null]);
      expect(parser.parse('John Smith')).toEqual([null, 'John', ' Smith']);
      expect(parser.parse('Mr. John Smith')).toEqual(['Mr. ', 'John', ' Smith']);
    });

    it('should work in choice with required parsers', () => {
      // Note: choice returns first successful result, so optional always wins
      const parser = choice([
        optional(str('optional')),
        str('required')
      ]);
      
      expect(parser.parse('optional')).toBe('optional');
      expect(parser.parse('required')).toBeNull(); // optional succeeds with null
      expect(parser.parse('other')).toBeNull(); // First option (optional) succeeds with null
    });
  });

  describe('Optional parser method vs function', () => {
    it('should behave identically as method and function', () => {
      const methodVersion = str('hello').optional();
      const functionVersion = optional(str('hello'));
      
      expect(methodVersion.parse('hello')).toBe(functionVersion.parse('hello'));
      expect(methodVersion.parse('world')).toBe(functionVersion.parse('world'));
    });

    it('should have same state behavior for both forms', () => {
      const state = { input: 'world', index: 0 };
      const methodResult = str('hello').optional().run(state);
      const functionResult = optional(str('hello')).run(state);
      
      expect(methodResult).toEqual(functionResult);
    });
  });

  describe('Complex optional scenarios', () => {
    it('should handle optional protocol in URL parsing', () => {
      const protocol = optional(sequence([regex(/https?/), str('://')], ([p]) => p));
      const domain = regex(/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      const url = sequence([protocol, domain], ([p, d]) => 
        p ? `${p}://${d}` : d
      );
      
      expect(url.parse('http://example.com')).toBe('http://example.com');
      expect(url.parse('https://example.com')).toBe('https://example.com');
      expect(url.parse('example.com')).toBe('example.com');
    });

    it('should handle optional sign in number parsing', () => {
      const sign = optional(choice([str('+'), str('-')]));
      const digits = regex(/\d+/);
      const signedNumber = sequence([sign, digits], ([s, d]) => {
        const num = parseInt(d);
        return s === '-' ? -num : num;
      });
      
      expect(signedNumber.parse('123')).toBe(123);
      expect(signedNumber.parse('+123')).toBe(123);
      expect(signedNumber.parse('-123')).toBe(-123);
    });

    it('should handle optional whitespace', () => {
      const optionalWs = optional(regex(/\s+/));
      const word = regex(/\w+/);
      const twoWords = sequence([word, optionalWs, word]);
      
      expect(twoWords.parse('hello world')).toEqual(['hello', ' ', 'world']);
      // Note: Without lookahead, first \w+ consumes all word chars
      expect(() => twoWords.parse('helloworld')).toThrow();
    });

    it('should handle optional file extensions', () => {
      const filename = regex(/[a-zA-Z0-9_-]+/);
      const extension = optional(sequence([str('.'), regex(/[a-zA-Z0-9]+/)], 
        ([, ext]) => ext));
      const file = sequence([filename, extension], ([name, ext]) => 
        ext ? `${name}.${ext}` : name
      );
      
      expect(file.parse('document.txt')).toBe('document.txt');
      expect(file.parse('README')).toBe('README');
    });
  });

  describe('Optional in parsing configurations', () => {
    it('should parse configuration with optional values', () => {
      const key = regex(/[a-z_]+/);
      const equals = str('=');
      const value = regex(/[^#\n]+/);  // Stop at # or newline
      const comment = optional(sequence([regex(/\s*#/), regex(/[^\n]*/)], 
        ([, c]) => c));
      
      const configLine = sequence([key, equals, value, comment], 
        ([k, , v, c]) => ({ key: k, value: v, comment: c }));
      
      expect(configLine.parse('host=localhost')).toEqual({
        key: 'host',
        value: 'localhost',
        comment: null
      });
      
      expect(configLine.parse('port=3000 # default port')).toEqual({
        key: 'port',
        value: '3000 ',
        comment: ' default port'
      });
    });

    it('should parse function signatures with optional parameters', () => {
      const identifier = regex(/[a-zA-Z_][a-zA-Z0-9_]*/);
      const type = regex(/[a-zA-Z]+/);
      const optionalDefault = optional(sequence([str(' = '), regex(/[^,)]+/)], 
        ([, def]) => def));
      
      const parameter = sequence([identifier, str(': '), type, optionalDefault], 
        ([name, , t, def]) => ({ name, type: t, default: def }));
      
      expect(parameter.parse('name: string')).toEqual({
        name: 'name',
        type: 'string',
        default: null
      });
      
      expect(parameter.parse('count: number = 0')).toEqual({
        name: 'count',
        type: 'number',
        default: '0'
      });
    });
  });

  describe('Edge cases and error scenarios', () => {
    it('should handle optional with always-failing parser', () => {
      const neverMatches = regex(/(?!)/); // Negative lookahead that never matches
      const parser = optional(neverMatches);
      expect(parser.parse('anything')).toBeNull();
    });

    it('should handle optional with empty-matching parser', () => {
      const emptyMatch = regex(/a*/); // Matches zero or more 'a'
      const parser = optional(emptyMatch);
      expect(parser.parse('')).toBe('');
      expect(parser.parse('b')).toBe('');
      expect(parser.parse('aaa')).toBe('aaa');
    });

    it('should work at end of input', () => {
      const parser = optional(str('end'));
      expect(parser.parse('')).toBeNull();
      expect(parser.parse('end')).toBe('end');
    });

    it('should work with parsers that consume entire input', () => {
      const parser = optional(regex(/.*/));
      expect(parser.parse('everything')).toBe('everything');
      expect(parser.parse('')).toBe('');
    });

    it('should maintain position correctly in complex sequences', () => {
      const a = str('a');
      const optB = optional(str('b'));
      const c = str('c');
      const parser = sequence([a, optB, c]);
      
      expect(parser.parse('abc')).toEqual(['a', 'b', 'c']);
      expect(parser.parse('ac')).toEqual(['a', null, 'c']);
      expect(() => parser.parse('ab')).toThrow(); // Missing 'c'
    });
  });

  describe('Type safety and return types', () => {
    it('should preserve original type in union with null', () => {
      const stringOptional = optional(str('hello'));
      const numberOptional = optional(number);
      const arrayOptional = optional(many(str('a')));
      
      // These would fail TypeScript compilation if types were wrong
      const stringResult: string | null = stringOptional.parse('hello');
      const numberResult: number | null = numberOptional.parse('123');
      const arrayResult: string[] | null = arrayOptional.parse('aaa');
      
      expect(stringResult).toBe('hello');
      expect(numberResult).toBe(123);
      expect(arrayResult).toEqual(['a', 'a', 'a']);
    });

    it('should work with complex generic types', () => {
      type User = { name: string; age: number };
      const userParser = sequence([
        str('name:'), regex(/\w+/),
        str(',age:'), number
      ], ([, name, , age]) => ({ name, age } as User));
      
      const optionalUser = optional(userParser);
      const result = optionalUser.parse('name:John,age:30');
      
      expect(result).toEqual({ name: 'John', age: 30 });
      expect(optionalUser.parse('invalid')).toBeNull();
    });
  });

  describe('Performance considerations', () => {
    it('should not add significant overhead for successful parsing', () => {
      const baseParser = regex(/\w+/);
      const optionalParser = optional(baseParser);
      const input = 'performance';
      
      const baseStart = performance.now();
      baseParser.parse(input);
      const baseEnd = performance.now();
      
      const optionalStart = performance.now();
      optionalParser.parse(input);
      const optionalEnd = performance.now();
      
      const baseTime = baseEnd - baseStart;
      const optionalTime = optionalEnd - optionalStart;
      
      // Optional should not add more than 2x overhead
      expect(optionalTime).toBeLessThan(baseTime * 2 + 1); // +1ms tolerance
    });

    it('should fail quickly for failed parsers', () => {
      const complexParser = sequence([
        regex(/complex/),
        regex(/pattern/),
        regex(/that/),
        regex(/will/),
        regex(/fail/)
      ]);
      const optionalParser = optional(complexParser);
      
      const start = performance.now();
      const result = optionalParser.parse('simple input');
      const end = performance.now();
      
      expect(result).toBeNull();
      expect(end - start).toBeLessThan(10); // Should fail quickly
    });
  });

  describe('Integration with other combinators', () => {
    it('should work correctly in many() combinator', () => {
      const optionalDigit = optional(regex(/\d/));
      const parser = many(optionalDigit);
      
      // This would create infinite loop since optional always succeeds
      // many() correctly detects this and prevents it
      expect(() => parser.parse('123abc')).toThrow('infinite loop');
    });

    it('should work in choice combinator correctly', () => {
      const parser = choice([
        optional(str('maybe')),
        str('definitely')
      ]);
      
      expect(parser.parse('maybe')).toBe('maybe');
      expect(parser.parse('definitely')).toBeNull(); // optional wins with null
      expect(parser.parse('nothing')).toBeNull(); // First choice succeeds with null
    });
  });
});
