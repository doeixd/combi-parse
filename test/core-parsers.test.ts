import { describe, it, expect } from 'vitest';
import { 
  str, regex, number, optional, choice, sequence, many, many1,
  anyChar, noneOf, whitespace, eof, between, sepBy, sepBy1
} from '../src/parser';

describe('Core Parser Functions', () => {
  describe('str parser', () => {
    it('should match exact string literals', () => {
      const parser = str('hello');
      expect(parser.parse('hello')).toBe('hello');
      expect(() => parser.parse('world')).toThrow();
    });

    it('should match at any position', () => {
      const parser = str('world');
      expect(parser.run({ input: 'hello world', index: 6 }).type).toBe('success');
      expect(parser.run({ input: 'hello world', index: 6 }).value).toBe('world');
    });

    it('should fail with descriptive error', () => {
      const parser = str('expected');
      expect(() => parser.parse('actual')).toThrow('"expected"');
    });

    it('should work with empty strings', () => {
      const parser = str('');
      expect(parser.parse('')).toBe('');
      expect(parser.parse('anything', { consumeAll: false })).toBe('');
    });

    it('should work with special characters', () => {
      const parser = str('!@#$%^&*()');
      expect(parser.parse('!@#$%^&*()')).toBe('!@#$%^&*()');
    });
  });

  describe('regex parser', () => {
    it('should match basic patterns', () => {
      const parser = regex(/[a-z]+/);
      expect(parser.parse('hello')).toBe('hello');
      expect(() => parser.parse('123')).toThrow();
    });

    it('should work with digits', () => {
      const parser = regex(/\d+/);
      expect(parser.parse('123')).toBe('123');
      expect(parser.parse('123abc', { consumeAll: false })).toBe('123');
    });

    it('should work with flags', () => {
      const parser = regex(/hello/i);
      expect(parser.parse('HELLO')).toBe('HELLO');
      expect(parser.parse('Hello')).toBe('Hello');
    });

    it('should be anchored to current position', () => {
      const parser = regex(/abc/);
      expect(() => parser.parse('xyzabc')).toThrow();
      expect(parser.parse('abcxyz', { consumeAll: false })).toBe('abc');
    });

    it('should work with complex patterns', () => {
      const emailPattern = regex(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      expect(emailPattern.parse('test@example.com')).toBe('test@example.com');
      expect(() => emailPattern.parse('invalid-email')).toThrow();
    });

    it('should work with optional groups', () => {
      const parser = regex(/colou?r/);
      expect(parser.parse('color')).toBe('color');
      expect(parser.parse('colour')).toBe('colour');
    });

    it('should work with character classes', () => {
      const parser = regex(/[0-9a-fA-F]+/);
      expect(parser.parse('abc123')).toBe('abc123');
      expect(parser.parse('ABC123')).toBe('ABC123');
    });

    it('should handle quantifiers', () => {
      const parser = regex(/a{2,4}/);
      expect(parser.parse('aa')).toBe('aa');
      expect(parser.parse('aaa')).toBe('aaa');
      expect(parser.parse('aaaa')).toBe('aaaa');
      expect(() => parser.parse('a')).toThrow();
    });

    it('should work with escaped characters', () => {
      const parser = regex(/\$\d+\.\d{2}/);
      expect(parser.parse('$19.95')).toBe('$19.95');
    });
  });

  describe('number parser', () => {
    it('should parse integers', () => {
      expect(number.parse('123')).toBe(123);
      expect(number.parse('0')).toBe(0);
    });

    it('should parse negative numbers', () => {
      expect(number.parse('-123')).toBe(-123);
      expect(number.parse('-0')).toBe(-0);
    });

    it('should parse decimals', () => {
      expect(number.parse('123.45')).toBe(123.45);
      expect(number.parse('0.5')).toBe(0.5);
      expect(number.parse('.5')).toBe(0.5);
    });

    it('should parse scientific notation', () => {
      expect(number.parse('1e5')).toBe(100000);
      expect(number.parse('1.5e2')).toBe(150);
      expect(number.parse('1E-2')).toBe(0.01);
      expect(number.parse('-1.5e2')).toBe(-150);
    });

    it('should fail on invalid numbers', () => {
      expect(() => number.parse('abc')).toThrow();
      expect(() => number.parse('')).toThrow();
      expect(() => number.parse('.')).toThrow();
    });

    it('should stop at first non-numeric character', () => {
      expect(number.parse('123abc', { consumeAll: false })).toBe(123);
    });
  });

  describe('anyChar parser', () => {
    it('should consume any single character', () => {
      expect(anyChar.parse('a')).toBe('a');
      expect(anyChar.parse('1')).toBe('1');
      expect(anyChar.parse(' ')).toBe(' ');
      expect(anyChar.parse('!')).toBe('!');
    });

    it('should fail at end of input', () => {
      expect(() => anyChar.parse('')).toThrow('any character');
    });

    it('should work with unicode characters', () => {
      // Note: emoji characters may be multi-byte, so we test with simpler unicode
      expect(anyChar.parse('ñ')).toBe('ñ');
      expect(anyChar.parse('α')).toBe('α');
      expect(anyChar.parse('中')).toBe('中');
    });
  });

  describe('noneOf parser', () => {
    it('should parse characters not in the set', () => {
      const parser = noneOf('abc');
      expect(parser.parse('d')).toBe('d');
      expect(parser.parse('1')).toBe('1');
      expect(parser.parse(' ')).toBe(' ');
    });

    it('should fail on characters in the set', () => {
      const parser = noneOf('abc');
      expect(() => parser.parse('a')).toThrow();
      expect(() => parser.parse('b')).toThrow();
      expect(() => parser.parse('c')).toThrow();
    });

    it('should fail at end of input', () => {
      const parser = noneOf('abc');
      expect(() => parser.parse('')).toThrow();
    });

    it('should work with special characters', () => {
      const parser = noneOf('!@#');
      expect(parser.parse('$')).toBe('$');
      expect(() => parser.parse('!')).toThrow();
    });
  });

  describe('whitespace parser', () => {
    it('should parse various whitespace characters', () => {
      expect(whitespace.parse(' ')).toBe(' ');
      expect(whitespace.parse('\t')).toBe('\t');
      expect(whitespace.parse('\n')).toBe('\n');
      expect(whitespace.parse('\r')).toBe('\r');
    });

    it('should parse multiple whitespace characters', () => {
      expect(whitespace.parse('   ')).toBe('   ');
      expect(whitespace.parse(' \t\n ')).toBe(' \t\n ');
    });

    it('should fail on non-whitespace', () => {
      expect(() => whitespace.parse('a')).toThrow();
      expect(() => whitespace.parse('')).toThrow();
    });

    it('should stop at first non-whitespace', () => {
      expect(whitespace.parse('  abc', { consumeAll: false })).toBe('  ');
    });
  });

  describe('eof parser', () => {
    it('should succeed at end of input', () => {
      expect(eof.parse('')).toBeNull();
    });

    it('should fail when input remains', () => {
      expect(() => eof.parse('a')).toThrow('end of file');
    });

    it('should work after other parsers consume input', () => {
      const parser = sequence([str('hello'), eof]);
      expect(parser.parse('hello')).toEqual(['hello', null]);
      expect(() => parser.parse('hello world')).toThrow();
    });
  });

  describe('optional parser', () => {
    it('should return value when parser succeeds', () => {
      const parser = optional(str('hello'));
      expect(parser.parse('hello')).toBe('hello');
    });

    it('should return null when parser fails', () => {
      const parser = optional(str('hello'));
      expect(parser.parse('world', { consumeAll: false })).toBeNull();
    });

    it('should not consume input on failure', () => {
      const parser = optional(str('hello'));
      const result = parser.run({ input: 'world', index: 0 });
      expect(result.type).toBe('success');
      expect(result.value).toBeNull();
      expect(result.state.index).toBe(0);
    });

    it('should work with complex parsers', () => {
      const parser = optional(sequence([str('hello'), str(' '), str('world')]));
      expect(parser.parse('hello world')).toEqual(['hello', ' ', 'world']);
      expect(parser.parse('goodbye', { consumeAll: false })).toBeNull();
    });
  });

  describe('choice parser', () => {
    it('should try parsers in order', () => {
      const parser = choice([str('hello'), str('world')]);
      expect(parser.parse('hello')).toBe('hello');
      expect(parser.parse('world')).toBe('world');
    });

    it('should fail when all parsers fail', () => {
      const parser = choice([str('hello'), str('world')]);
      expect(() => parser.parse('goodbye')).toThrow();
    });

    it('should return result of first successful parser', () => {
      const parser = choice([str('a'), str('ab')]);
      expect(parser.parse('ab', { consumeAll: false })).toBe('a'); // First one wins
    });

    it('should provide intelligent error messages', () => {
      const parser = choice([str('hello'), str('world')]);
      expect(() => parser.parse('goodbye')).toThrow('"hello" or "world"');
    });

    it('should work with different types using union types', () => {
      const parser = choice([str('hello'), number]);
      expect(parser.parse('hello')).toBe('hello');
      expect(parser.parse('123')).toBe(123);
    });

    it('should handle empty choice list', () => {
      const parser = choice([]);
      expect(() => parser.parse('anything')).toThrow('empty list');
    });
  });

  describe('sequence parser', () => {
    it('should parse all parsers in order', () => {
      const parser = sequence([str('hello'), str(' '), str('world')]);
      expect(parser.parse('hello world')).toEqual(['hello', ' ', 'world']);
    });

    it('should fail if any parser fails', () => {
      const parser = sequence([str('hello'), str(' '), str('world')]);
      expect(() => parser.parse('hello earth')).toThrow();
    });

    it('should work with transform function', () => {
      const parser = sequence([str('hello'), str(' '), str('world')], 
        ([a, , c]) => `${a}_${c}`);
      expect(parser.parse('hello world')).toBe('hello_world');
    });

    it('should work with mixed types', () => {
      const parser = sequence([str('value:'), number]);
      expect(parser.parse('value:123')).toEqual(['value:', 123]);
    });

    it('should handle empty sequence', () => {
      const parser = sequence([]);
      expect(parser.parse('')).toEqual([]);
    });
  });

  describe('many parser', () => {
    it('should parse zero or more occurrences', () => {
      const parser = many(str('a'));
      expect(parser.parse('')).toEqual([]);
      expect(parser.parse('a')).toEqual(['a']);
      expect(parser.parse('aaa')).toEqual(['a', 'a', 'a']);
    });

    it('should stop at first failure', () => {
      const parser = many(str('a'));
      expect(parser.parse('aaab', { consumeAll: false })).toEqual(['a', 'a', 'a']);
    });

    it('should work with complex parsers', () => {
      const parser = many(sequence([str('hello'), str(' ')]));
      expect(parser.parse('hello hello hello world', { consumeAll: false })).toEqual([
        ['hello', ' '], ['hello', ' '], ['hello', ' ']
      ]);
    });

    it('should work with transform function', () => {
      const parser = many(str('a'), arr => arr.length);
      expect(parser.parse('aaa')).toBe(3);
    });
  });

  describe('many1 parser', () => {
    it('should require at least one occurrence', () => {
      const parser = many1(str('a'));
      expect(parser.parse('a')).toEqual(['a']);
      expect(parser.parse('aaa')).toEqual(['a', 'a', 'a']);
      expect(() => parser.parse('')).toThrow();
      expect(() => parser.parse('b')).toThrow();
    });

    it('should work with transform function', () => {
      const parser = many1(str('a'), arr => arr.join(''));
      expect(parser.parse('aaa')).toBe('aaa');
    });
  });

  describe('between parser', () => {
    it('should parse content between delimiters', () => {
      const parser = between(str('('), str('content'), str(')'));
      expect(parser.parse('(content)')).toBe('content');
    });

    it('should fail if delimiters are missing', () => {
      const parser = between(str('('), str('content'), str(')'));
      expect(() => parser.parse('content)')).toThrow();
      expect(() => parser.parse('(content')).toThrow();
    });

    it('should work with complex content', () => {
      const parser = between(str('"'), regex(/[^"]*/), str('"'));
      expect(parser.parse('"hello world"')).toBe('hello world');
    });
  });

  describe('sepBy parser', () => {
    it('should parse separated values', () => {
      const parser = sepBy(str('a'), str(','));
      expect(parser.parse('')).toEqual([]);
      expect(parser.parse('a')).toEqual(['a']);
      expect(parser.parse('a,a,a')).toEqual(['a', 'a', 'a']);
    });

    it('should not require trailing separator', () => {
      const parser = sepBy(number, str(','));
      expect(parser.parse('1,2,3')).toEqual([1, 2, 3]);
      expect(parser.parse('1,2,3,', { consumeAll: false })).toEqual([1, 2, 3]); // Stops before trailing comma
    });

    it('should work with complex elements', () => {
      const element = sequence([str('"'), regex(/[^"]*/), str('"')], 
        ([, content]) => content);
      const parser = sepBy(element, str(','));
      expect(parser.parse('"a","b","c"')).toEqual(['a', 'b', 'c']);
    });

    it('should work with transform function', () => {
      const parser = sepBy(number, str(','), arr => arr.reduce((a, b) => a + b, 0));
      expect(parser.parse('1,2,3')).toBe(6);
    });
  });

  describe('sepBy1 parser', () => {
    it('should require at least one element', () => {
      const parser = sepBy1(str('a'), str(','));
      expect(parser.parse('a')).toEqual(['a']);
      expect(parser.parse('a,a,a')).toEqual(['a', 'a', 'a']);
      expect(() => parser.parse('')).toThrow();
    });

    it('should work with numbers', () => {
      const parser = sepBy1(number, str(','));
      expect(parser.parse('1,2,3')).toEqual([1, 2, 3]);
    });
  });

  describe('Integration tests', () => {
    it('should parse CSV-like data', () => {
      const field = between(str('"'), regex(/[^"]*/), str('"'));
      const row = sepBy(field, str(','));
      const csv = sepBy(row, str('\n'));
      
      const input = '"name","age","city"\n"John","30","NYC"\n"Jane","25","LA"';
      const expected = [
        ['name', 'age', 'city'],
        ['John', '30', 'NYC'],
        ['Jane', '25', 'LA']
      ];
      expect(csv.parse(input)).toEqual(expected);
    });

    it('should parse JSON-like objects', () => {
      const jsonString = between(str('"'), regex(/[^"]*/), str('"'));
      const jsonNumber = number;
      const jsonValue = choice([jsonString, jsonNumber]);
      const keyValue = sequence([jsonString, str(':'), jsonValue], 
        ([key, , value]) => ({ [key]: value }));
      const jsonObject = between(str('{'), sepBy(keyValue, str(',')), str('}'))
        .map(pairs => Object.assign({}, ...pairs));
      
      const input = '{"name":"John","age":30}';
      expect(jsonObject.parse(input)).toEqual({ name: 'John', age: 30 });
    });

    it('should parse arithmetic expressions', () => {
      const factor = choice([number, between(str('('), () => expr, str(')'))]);
      const term = sepBy1(factor, choice([str('*'), str('/')]))
        .map(values => values.reduce((a, b) => a * b)); // Simplified for test
      const expr = sepBy1(term, choice([str('+'), str('-')]))
        .map(values => values.reduce((a, b) => a + b)); // Simplified for test
      
      expect(expr.parse('1+2')).toBe(3);
      expect(expr.parse('2*3')).toBe(6);
    });
  });
});
