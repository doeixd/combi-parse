import { describe, it, expect } from 'vitest';
import { ParserAlgebra } from '../../src/primitives/algebra';
import { str, regex, choice, sequence, number } from '../../src/parser';

describe('ParserAlgebra', () => {
  describe('intersect', () => {
    it('should succeed when both parsers succeed with identical results', () => {
      const p1 = str('test');
      const p2 = str('test');
      const intersection = ParserAlgebra.intersect(p1, p2);
      
      expect(intersection.parse('test')).toBe('test');
    });

    it('should fail when first parser fails', () => {
      const p1 = str('hello');
      const p2 = str('world');
      const intersection = ParserAlgebra.intersect(p1, p2);
      
      expect(() => intersection.parse('world')).toThrow();
    });

    it('should fail when second parser fails', () => {
      const p1 = regex(/.*?/);
      const p2 = str('specific');
      const intersection = ParserAlgebra.intersect(p1, p2);
      
      expect(() => intersection.parse('other')).toThrow();
    });

    it('should fail when parsers succeed with different results', () => {
      const p1 = regex(/\d+/).map(Number);
      const p2 = regex(/\d+/).map(s => s.length);
      const intersection = ParserAlgebra.intersect(p1, p2);
      
      expect(() => intersection.parse('123')).toThrow();
    });

    it('should work with complex parsers', () => {
      const identifier = regex(/[a-z]+/);
      const notKeyword = regex(/(?!if|while|for)[a-z]+/);
      const validIdentifier = ParserAlgebra.intersect(identifier, notKeyword);
      
      expect(validIdentifier.parse('variable')).toBe('variable');
      expect(() => validIdentifier.parse('if')).toThrow();
    });
  });

  describe('difference', () => {
    it('should succeed when first parser succeeds and second fails', () => {
      const identifier = regex(/[a-z]+/);
      const keyword = choice([str('if'), str('while'), str('for')]);
      const nonKeyword = ParserAlgebra.difference(identifier, keyword);
      
      expect(nonKeyword.parse('variable')).toBe('variable');
    });

    it('should fail when second parser succeeds', () => {
      const identifier = regex(/[a-z]+/);
      const keyword = choice([str('if'), str('while'), str('for')]);
      const nonKeyword = ParserAlgebra.difference(identifier, keyword);
      
      expect(() => nonKeyword.parse('if')).toThrow();
    });

    it('should fail when first parser fails', () => {
      const identifier = regex(/[a-z]+/);
      const keyword = str('if');
      const nonKeyword = ParserAlgebra.difference(identifier, keyword);
      
      expect(() => nonKeyword.parse('123')).toThrow();
    });

    it('should work with any number except zero', () => {
      const anyNumber = number;
      const zero = str('0').map(() => 0);
      const nonZero = ParserAlgebra.difference(anyNumber, zero);
      
      expect(nonZero.parse('123')).toBe(123);
      expect(() => nonZero.parse('0')).toThrow();
    });

    it('should preserve result type of first parser', () => {
      const stringParser = str('test');
      const failingParser = str('never');
      const result = ParserAlgebra.difference(stringParser, failingParser);
      
      const parsed = result.parse('test');
      expect(typeof parsed).toBe('string');
      expect(parsed).toBe('test');
    });
  });

  describe('permutation', () => {
    it('should match all parsers in any order', () => {
      const parsers = [
        str('a'),
        str('b'),
        str('c')
      ] as const;
      const permutation = ParserAlgebra.permutation(parsers);
      
      expect(permutation.parse('abc')).toEqual(['a', 'b', 'c']);
      expect(permutation.parse('bac')).toEqual(['a', 'b', 'c']);
      expect(permutation.parse('cab')).toEqual(['a', 'b', 'c']);
    });

    it('should fail if not all parsers match', () => {
      const parsers = [
        str('a'),
        str('b'),
        str('c')
      ] as const;
      const permutation = ParserAlgebra.permutation(parsers);
      
      expect(() => permutation.parse('ab')).toThrow();
      expect(() => permutation.parse('abd')).toThrow();
    });

    it('should work with different parser types', () => {
      const parsers = [
        str('class').keepRight(regex(/[a-z]+/)).keepLeft(str(' ')),
        str('id').keepRight(regex(/[a-z]+/)).keepLeft(str(' ')),
        str('style').keepRight(regex(/[a-z]+/))
      ] as const;
      const permutation = ParserAlgebra.permutation(parsers);
      
      // Should work in any order - test with input that matches all parsers
      expect(permutation.parse('classfoo idbar stylebaz')).toEqual(['foo', 'bar', 'baz']);
    });

    it('should handle empty array', () => {
      const permutation = ParserAlgebra.permutation([]);
      expect(permutation.parse('')).toEqual([]);
    });

    it('should handle single parser', () => {
      const permutation = ParserAlgebra.permutation([str('test')]);
      expect(permutation.parse('test')).toEqual(['test']);
    });

    it('should fail with duplicate parsers', () => {
      const parsers = [
        str('a'),
        str('a')
      ] as const;
      const permutation = ParserAlgebra.permutation(parsers);
      
      // Should fail because second 'a' can't be matched after first 'a' consumes the only 'a'
      expect(() => permutation.parse('a')).toThrow();
    });
  });

  describe('longest', () => {
    it('should return the longest matching parser', () => {
      const longest = ParserAlgebra.longest(
        str('if'),
        str('ifdef'),
        str('identifier')
      );
      
      expect(longest.parse('identifier')).toBe('identifier');
      expect(longest.parse('ifdef')).toBe('ifdef');
      expect(longest.parse('if')).toBe('if');
    });

    it('should prefer longer matches over shorter ones', () => {
      const longest = ParserAlgebra.longest(
        regex(/\d+/),
        regex(/\d+\.\d+/),
        regex(/\d+\.\d+e[+-]?\d+/)
      );
      
      expect(longest.parse('123.45e-10')).toBe('123.45e-10');
      expect(longest.parse('123.45')).toBe('123.45');
      expect(longest.parse('123')).toBe('123');
    });

    it('should fail if no parser succeeds', () => {
      const longest = ParserAlgebra.longest(
        str('hello'),
        str('world'),
        str('test')
      );
      
      expect(() => longest.parse('other')).toThrow();
    });

    it('should work with single parser', () => {
      const longest = ParserAlgebra.longest(str('test'));
      expect(longest.parse('test')).toBe('test');
    });

    it('should handle tie-breaking by first parser', () => {
      const longest = ParserAlgebra.longest(
        str('test'),
        str('best').map(() => 'test'), // Same length, different value
        str('rest').map(() => 'test')  // Same length, different value
      );
      
      expect(longest.parse('test')).toBe('test');
    });

    it('should work with parsers of different types', () => {
      const longest = ParserAlgebra.longest(
        str('123').map(Number),
        str('123').map(s => s.length),
        str('123')
      );
      
      // All same length, should return first successful parser's result
      const result = longest.parse('123');
      expect(typeof result).toBe('number');
      expect(result).toBe(123);
    });

    it('should handle complex patterns', () => {
      const keywordParser = choice([str('if'), str('while'), str('for')]);
      const identifierParser = regex(/[a-z]+/);
      const longest = ParserAlgebra.longest(keywordParser, identifierParser);
      
      expect(longest.parse('while')).toBe('while');
      expect(longest.parse('variable')).toBe('variable');
    });
  });

  describe('integration tests', () => {
    it('should work with nested algebra operations', () => {
      const basicId = regex(/[a-z]+/);
      const keywords = choice([str('if'), str('while'), str('for')]);
      const reservedWords = choice([str('true'), str('false'), str('null')]);
      
      // Create a parser that matches identifiers but not keywords or reserved words
      const validId = ParserAlgebra.difference(
        basicId,
        ParserAlgebra.longest(keywords, reservedWords)
      );
      
      expect(validId.parse('variable')).toBe('variable');
      expect(() => validId.parse('if')).toThrow();
      expect(() => validId.parse('true')).toThrow();
    });

    it('should work with complex permutation scenarios', () => {
      const classAttr = str('class="').keepRight(regex(/[^"]+/)).keepLeft(str('"'));
      const idAttr = str('id="').keepRight(regex(/[^"]+/)).keepLeft(str('"'));
      const styleAttr = str('style="').keepRight(regex(/[^"]+/)).keepLeft(str('"'));
      
      const attributes = ParserAlgebra.permutation([
        classAttr,
        idAttr,
        styleAttr
      ] as const);
      
      // Note: This is a simplified example - real HTML parsing would be more complex
      expect(attributes.parse('class="foo"id="bar"style="baz"')).toEqual(['foo', 'bar', 'baz']);
    });

    it('should handle error cases gracefully', () => {
      const p1 = str('test');
      const p2 = str('other');
      
      const intersection = ParserAlgebra.intersect(p1, p2);
      const difference = ParserAlgebra.difference(p1, p2);
      const permutation = ParserAlgebra.permutation([p1, p2]);
      const longest = ParserAlgebra.longest(p1, p2);
      
      // All should handle invalid input gracefully
      expect(() => intersection.parse('invalid')).toThrow();
      expect(() => difference.parse('invalid')).toThrow();
      expect(() => permutation.parse('invalid')).toThrow();
      expect(() => longest.parse('invalid')).toThrow();
    });
  });
});
