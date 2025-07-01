import { describe, it, expect } from 'vitest';
import { regex } from '../src/parser';

describe('Regex Parser Comprehensive Tests', () => {
  describe('Basic regex patterns', () => {
    it('should match simple character classes', () => {
      const digits = regex(/\d+/);
      expect(digits.parse('123')).toBe('123');
      expect(digits.parse('0')).toBe('0');
      expect(() => digits.parse('abc')).toThrow();
    });

    it('should match word characters', () => {
      const word = regex(/\w+/);
      expect(word.parse('hello')).toBe('hello');
      expect(word.parse('test123')).toBe('test123');
      expect(word.parse('under_score')).toBe('under_score');
      expect(() => word.parse('!')).toThrow();
    });

    it('should match whitespace', () => {
      const ws = regex(/\s+/);
      expect(ws.parse(' ')).toBe(' ');
      expect(ws.parse('\t\n\r')).toBe('\t\n\r');
      expect(() => ws.parse('a')).toThrow();
    });
  });

  describe('Anchoring behavior', () => {
    it('should automatically anchor patterns to start', () => {
      const pattern = regex(/abc/);
      expect(pattern.parse('abc')).toBe('abc');
      expect(() => pattern.parse('xyzabc')).toThrow();
    });

    it('should work with explicit anchors', () => {
      const pattern = regex(/^abc/);
      expect(pattern.parse('abc')).toBe('abc');
      expect(() => pattern.parse('xyzabc')).toThrow();
    });

    it('should not match end anchors incorrectly', () => {
      const pattern = regex(/abc$/);
      expect(pattern.parse('abc')).toBe('abc');
      // Note: $ in regex doesn't prevent matching partial input
    });
  });

  describe('Quantifiers', () => {
    it('should work with * quantifier', () => {
      const pattern = regex(/a*/);
      expect(pattern.parse('')).toBe('');
      expect(pattern.parse('a')).toBe('a');
      expect(pattern.parse('aaa')).toBe('aaa');
      expect(pattern.parse('aaab')).toBe('aaa');
    });

    it('should work with + quantifier', () => {
      const pattern = regex(/a+/);
      expect(pattern.parse('a')).toBe('a');
      expect(pattern.parse('aaa')).toBe('aaa');
      expect(() => pattern.parse('')).toThrow();
      expect(() => pattern.parse('b')).toThrow();
    });

    it('should work with ? quantifier', () => {
      const pattern = regex(/colou?r/);
      expect(pattern.parse('color')).toBe('color');
      expect(pattern.parse('colour')).toBe('colour');
      expect(() => pattern.parse('colouur')).toThrow();
    });

    it('should work with specific counts', () => {
      const exactly3 = regex(/a{3}/);
      expect(exactly3.parse('aaa')).toBe('aaa');
      expect(() => exactly3.parse('aa')).toThrow();
      expect(() => exactly3.parse('aaaa', { consumeAll: true })).toThrow();

      const range = regex(/a{2,4}/);
      expect(range.parse('aa')).toBe('aa');
      expect(range.parse('aaa')).toBe('aaa');
      expect(range.parse('aaaa')).toBe('aaaa');
      expect(() => range.parse('a')).toThrow();
      expect(range.parse('aaaaa')).toBe('aaaa'); // Matches first 4
    });

    it('should work with open-ended ranges', () => {
      const atLeast2 = regex(/a{2,}/);
      expect(atLeast2.parse('aa')).toBe('aa');
      expect(atLeast2.parse('aaaaa')).toBe('aaaaa');
      expect(() => atLeast2.parse('a')).toThrow();
    });
  });

  describe('Character classes', () => {
    it('should work with custom character classes', () => {
      const vowels = regex(/[aeiou]+/);
      expect(vowels.parse('aei')).toBe('aei');
      expect(vowels.parse('a')).toBe('a');
      expect(() => vowels.parse('bcdfg')).toThrow();
    });

    it('should work with negated character classes', () => {
      const notVowels = regex(/[^aeiou]+/);
      expect(notVowels.parse('bcdfg')).toBe('bcdfg');
      expect(notVowels.parse('xyz')).toBe('xyz');
      expect(() => notVowels.parse('aei')).toThrow();
    });

    it('should work with ranges', () => {
      const lowerCase = regex(/[a-z]+/);
      expect(lowerCase.parse('hello')).toBe('hello');
      expect(() => lowerCase.parse('HELLO')).toThrow();

      const digits = regex(/[0-9]+/);
      expect(digits.parse('123')).toBe('123');
      expect(() => digits.parse('abc')).toThrow();

      const alphaNum = regex(/[a-zA-Z0-9]+/);
      expect(alphaNum.parse('Hello123')).toBe('Hello123');
    });

    it('should handle special characters in classes', () => {
      const special = regex(/[!@#$%^&*()]+/);
      expect(special.parse('!@#')).toBe('!@#');
      
      const withDash = regex(/[a-z\-]+/);
      expect(withDash.parse('hello-world')).toBe('hello-world');
    });
  });

  describe('Groups and alternation', () => {
    it('should work with alternation', () => {
      const pattern = regex(/cat|dog/);
      expect(pattern.parse('cat')).toBe('cat');
      expect(pattern.parse('dog')).toBe('dog');
      expect(() => pattern.parse('bird')).toThrow();
    });

    it('should work with groups', () => {
      const pattern = regex(/(hello|hi) world/);
      expect(pattern.parse('hello world')).toBe('hello world');
      expect(pattern.parse('hi world')).toBe('hi world');
      expect(() => pattern.parse('hey world')).toThrow();
    });

    it('should work with non-capturing groups', () => {
      const pattern = regex(/(?:hello|hi) world/);
      expect(pattern.parse('hello world')).toBe('hello world');
      expect(pattern.parse('hi world')).toBe('hi world');
    });
  });

  describe('Escape sequences', () => {
    it('should handle escaped special characters', () => {
      const dollar = regex(/\$\d+/);
      expect(dollar.parse('$123')).toBe('$123');

      const dot = regex(/\./);
      expect(dot.parse('.')).toBe('.');
      expect(() => dot.parse('a')).toThrow();

      const parens = regex(/\(\w+\)/);
      expect(parens.parse('(hello)')).toBe('(hello)');
    });

    it('should handle backslash escapes', () => {
      const backslash = regex(/\\/);
      expect(backslash.parse('\\')).toBe('\\');

      const quote = regex(/"/);
      expect(quote.parse('"')).toBe('"');
    });
  });

  describe('Flags', () => {
    it('should work with case-insensitive flag', () => {
      const pattern = regex(/hello/i);
      expect(pattern.parse('hello')).toBe('hello');
      expect(pattern.parse('HELLO')).toBe('HELLO');
      expect(pattern.parse('Hello')).toBe('Hello');
      expect(pattern.parse('HeLLo')).toBe('HeLLo');
    });

    it('should work with global flag (though not typically needed)', () => {
      const pattern = regex(/\d/g);
      expect(pattern.parse('1')).toBe('1');
      expect(pattern.parse('123')).toBe('1'); // Only matches first
    });

    it('should work with multiline flag', () => {
      const pattern = regex(/^hello/m);
      expect(pattern.parse('hello')).toBe('hello');
    });
  });

  describe('Complex real-world patterns', () => {
    it('should parse email addresses', () => {
      const email = regex(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      expect(email.parse('test@example.com')).toBe('test@example.com');
      expect(email.parse('user.name+tag@domain.co.uk')).toBe('user.name+tag@domain.co.uk');
      expect(() => email.parse('invalid-email')).toThrow();
      expect(() => email.parse('@example.com')).toThrow();
    });

    it('should parse URLs', () => {
      const url = regex(/https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/[^\s]*)?/);
      expect(url.parse('http://example.com')).toBe('http://example.com');
      expect(url.parse('https://www.example.com/path')).toBe('https://www.example.com/path');
      expect(() => url.parse('ftp://example.com')).toThrow();
    });

    it('should parse phone numbers', () => {
      const phone = regex(/\(\d{3}\) \d{3}-\d{4}/);
      expect(phone.parse('(555) 123-4567')).toBe('(555) 123-4567');
      expect(() => phone.parse('555-123-4567')).toThrow();
    });

    it('should parse IP addresses', () => {
      const ip = regex(/\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/);
      expect(ip.parse('192.168.1.1')).toBe('192.168.1.1');
      expect(ip.parse('255.255.255.255')).toBe('255.255.255.255');
      expect(ip.parse('0.0.0.0')).toBe('0.0.0.0');
    });

    it('should parse hex colors', () => {
      const hexColor = regex(/#[0-9a-fA-F]{6}/);
      expect(hexColor.parse('#ff0000')).toBe('#ff0000');
      expect(hexColor.parse('#ABCDEF')).toBe('#ABCDEF');
      expect(() => hexColor.parse('#ff0')).toThrow();
      expect(() => hexColor.parse('ff0000')).toThrow();
    });

    it('should parse dates in various formats', () => {
      const isoDate = regex(/\d{4}-\d{2}-\d{2}/);
      expect(isoDate.parse('2023-12-25')).toBe('2023-12-25');

      const usDate = regex(/\d{1,2}\/\d{1,2}\/\d{4}/);
      expect(usDate.parse('12/25/2023')).toBe('12/25/2023');
      expect(usDate.parse('1/1/2023')).toBe('1/1/2023');
    });

    it('should parse credit card numbers', () => {
      const creditCard = regex(/\d{4}-\d{4}-\d{4}-\d{4}/);
      expect(creditCard.parse('1234-5678-9012-3456')).toBe('1234-5678-9012-3456');
      expect(() => creditCard.parse('1234567890123456')).toThrow();
    });
  });

  describe('Edge cases', () => {
    it('should handle empty matches', () => {
      const pattern = regex(/a*/);
      expect(pattern.parse('')).toBe('');
      expect(pattern.parse('b')).toBe('');
    });

    it('should handle very long patterns', () => {
      const longPattern = regex(/a{1000}/);
      const longInput = 'a'.repeat(1000);
      expect(longPattern.parse(longInput)).toBe(longInput);
      expect(() => longPattern.parse('a'.repeat(999))).toThrow();
    });

    it('should handle unicode characters', () => {
      const accents = regex(/[àáâãäå]+/);
      expect(accents.parse('àáâãäå')).toBe('àáâãäå');
      
      const greek = regex(/[α-ω]+/);
      expect(greek.parse('αβγ')).toBe('αβγ');
    });

    it('should handle lookaheads and lookbehinds if supported', () => {
      // Note: JavaScript regex engine support varies
      const lookahead = regex(/hello(?= world)/);
      expect(lookahead.parse('hello world')).toBe('hello');
      expect(() => lookahead.parse('hello there')).toThrow();
    });

    it('should provide descriptive error messages', () => {
      const pattern = regex(/\d+/);
      expect(() => pattern.parse('abc')).toThrow('to match regex');
    });

    it('should handle regex with no matches at position', () => {
      const pattern = regex(/xyz/);
      expect(() => pattern.parse('abc')).toThrow();
    });

    it('should work with zero-width assertions', () => {
      const wordBoundary = regex(/\bword\b/);
      expect(wordBoundary.parse('word')).toBe('word');
      // Note: word boundary behavior depends on surrounding context
    });
  });

  describe('Error handling', () => {
    it('should handle invalid regex patterns gracefully', () => {
      // Note: This test depends on how the regex constructor handles invalid patterns
      expect(() => {
        const invalidRegex = new RegExp('[');
        regex(invalidRegex);
      }).toThrow();
    });

    it('should provide clear error messages for failed matches', () => {
      const pattern = regex(/\d+/);
      try {
        pattern.parse('abc');
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('to match regex');
        expect(error.message).toContain('/\\d+/');
      }
    });
  });

  describe('Performance considerations', () => {
    it('should handle large inputs efficiently', () => {
      const pattern = regex(/a+/);
      const largeInput = 'a'.repeat(10000);
      
      const start = performance.now();
      const result = pattern.parse(largeInput);
      const end = performance.now();
      
      expect(result).toBe(largeInput);
      expect(end - start).toBeLessThan(100); // Should be fast
    });

    it('should not cause catastrophic backtracking', () => {
      // This pattern could cause issues with some inputs
      const pattern = regex(/a*a*b/);
      const problematicInput = 'a'.repeat(20) + 'c'; // No 'b' at end
      
      const start = performance.now();
      expect(() => pattern.parse(problematicInput)).toThrow();
      const end = performance.now();
      
      expect(end - start).toBeLessThan(100); // Should fail quickly
    });
  });
});
