import { describe, it, expect } from 'vitest';
import { pattern, literalRegex } from '../../src/primitives/pattern';
import { choice } from '../../src/parser';

describe('Advanced Pattern Matching and Recognition', () => {
  describe('pattern function', () => {
    it('should create parser for literal strings with correct typing', () => {
      const httpMethod = pattern(['GET', 'POST', 'PUT', 'DELETE'] as const);
      
      expect(httpMethod.parse('GET')).toBe('GET');
      expect(httpMethod.parse('POST')).toBe('POST');
      expect(httpMethod.parse('PUT')).toBe('PUT');
      expect(httpMethod.parse('DELETE')).toBe('DELETE');
    });

    it('should fail for non-matching literals', () => {
      const keyword = pattern(['if', 'else', 'while'] as const);
      
      expect(() => keyword.parse('for')).toThrow();
      expect(() => keyword.parse('return')).toThrow();
      expect(() => keyword.parse('IF')).toThrow(); // Case sensitive
    });

    it('should work with single literal', () => {
      const singlePattern = pattern(['hello'] as const);
      
      expect(singlePattern.parse('hello')).toBe('hello');
      expect(() => singlePattern.parse('world')).toThrow();
    });

    it('should work with empty array', () => {
      const emptyPattern = pattern([]);
      
      expect(() => emptyPattern.parse('anything')).toThrow();
    });

    it('should handle boolean literals', () => {
      const boolean = pattern(['true', 'false'] as const);
      
      expect(boolean.parse('true')).toBe('true');
      expect(boolean.parse('false')).toBe('false');
      expect(() => boolean.parse('maybe')).toThrow();
    });

    it('should work with programming language keywords', () => {
      const keyword = pattern([
        'if', 'else', 'while', 'for', 'return', 'function', 'const', 'let', 'var'
      ] as const);
      
      expect(keyword.parse('if')).toBe('if');
      expect(keyword.parse('function')).toBe('function');
      expect(keyword.parse('const')).toBe('const');
      expect(() => keyword.parse('invalid')).toThrow();
    });

    it('should handle operators', () => {
      const operator = pattern(['==', '!=', '+', '-', '*', '/', '=', '<', '>'] as const);
      
      expect(operator.parse('+')).toBe('+');
      expect(operator.parse('==')).toBe('==');
      expect(operator.parse('!=')).toBe('!=');
      expect(() => operator.parse('&&')).toThrow();
    });

    it('should work with log levels', () => {
      const logLevel = pattern(['debug', 'info', 'warn', 'error'] as const);
      
      expect(logLevel.parse('debug')).toBe('debug');
      expect(logLevel.parse('info')).toBe('info');
      expect(logLevel.parse('warn')).toBe('warn');
      expect(logLevel.parse('error')).toBe('error');
      expect(() => logLevel.parse('trace')).toThrow();
    });

    it('should prefer longer matches when using choice internally', () => {
      // When patterns share prefixes, choice returns first match
      // To get longest match behavior, order longer patterns first
      const pattern1 = pattern(['ifdef', 'if'] as const);
      
      expect(pattern1.parse('if')).toBe('if');
      expect(pattern1.parse('ifdef')).toBe('ifdef');
    });

    it('should work with special characters', () => {
      const punctuation = pattern(['.', ',', ';', ':', '!', '?'] as const);
      
      expect(punctuation.parse('.')).toBe('.');
      expect(punctuation.parse(',')).toBe(',');
      expect(punctuation.parse('!')).toBe('!');
      expect(() => punctuation.parse('@')).toThrow();
    });

    it('should handle case-sensitive matching', () => {
      const caseSensitive = pattern(['Test', 'test', 'TEST'] as const);
      
      expect(caseSensitive.parse('Test')).toBe('Test');
      expect(caseSensitive.parse('test')).toBe('test');
      expect(caseSensitive.parse('TEST')).toBe('TEST');
      expect(() => caseSensitive.parse('tEsT')).toThrow();
    });

    it('should work with numeric strings', () => {
      const numbers = pattern(['0', '1', '2', '3', '4', '5'] as const);
      
      expect(numbers.parse('0')).toBe('0');
      expect(numbers.parse('3')).toBe('3');
      expect(() => numbers.parse('6')).toThrow();
      expect(() => numbers.parse('10', { consumeAll: true })).toThrow(); // Multi-digit
    });
  });

  describe('literalRegex function', () => {
    it('should match regex with literal validation', () => {
      const bool = literalRegex(/true|false/, ['true', 'false'] as const);
      
      expect(bool.parse('true')).toBe('true');
      expect(bool.parse('false')).toBe('false');
    });

    it('should fail when regex matches but literal validation fails', () => {
      const restrictedNumbers = literalRegex(/\d+/, ['1', '2', '3'] as const);
      
      expect(restrictedNumbers.parse('1')).toBe('1');
      expect(restrictedNumbers.parse('2')).toBe('2');
      expect(() => restrictedNumbers.parse('4')).toThrow(); // Regex matches but not in literals
    });

    it('should fail when regex does not match', () => {
      const letters = literalRegex(/[a-z]+/, ['hello', 'world'] as const);
      
      expect(() => letters.parse('123')).toThrow(); // Regex doesn't match
    });

    it('should work with color names', () => {
      const colorName = literalRegex(
        /red|blue|green|yellow|black|white/,
        ['red', 'blue', 'green', 'yellow', 'black', 'white'] as const
      );
      
      expect(colorName.parse('red')).toBe('red');
      expect(colorName.parse('blue')).toBe('blue');
      expect(colorName.parse('green')).toBe('green');
      expect(() => colorName.parse('purple')).toThrow(); // Not in literals
    });

    it('should work with complex operator patterns', () => {
      const operator = literalRegex(
        /\+\+|--|[+\-*\/=<>!]=?|&&|\|\|/,
        ['++', '--', '+', '-', '*', '/', '=', '==', '!=', '<', '>', '<=', '>=', '&&', '||'] as const
      );
      
      expect(operator.parse('++')).toBe('++');
      expect(operator.parse('==')).toBe('==');
      expect(operator.parse('<=')).toBe('<=');
      expect(operator.parse('&&')).toBe('&&');
      expect(() => operator.parse('??')).toThrow(); // Not in literals
    });

    it('should handle HTTP status codes', () => {
      const statusCode = literalRegex(
        /[1-5]\d{2}/,
        ['200', '201', '400', '401', '404', '500'] as const
      );
      
      expect(statusCode.parse('200')).toBe('200');
      expect(statusCode.parse('404')).toBe('404');
      expect(statusCode.parse('500')).toBe('500');
      expect(() => statusCode.parse('999')).toThrow(); // Valid regex but not in literals
    });

    it('should work with file extensions', () => {
      const extension = literalRegex(
        /\.(js|ts|json|md)$/,
        ['.js', '.ts', '.json', '.md'] as const
      );
      
      expect(extension.parse('.js')).toBe('.js');
      expect(extension.parse('.ts')).toBe('.ts');
      expect(extension.parse('.json')).toBe('.json');
      expect(() => extension.parse('.py')).toThrow(); // Not in literals
    });

    it('should handle empty literals array', () => {
      const impossible = literalRegex(/.*/, [] as const);
      
      expect(() => impossible.parse('anything')).toThrow();
    });

    it('should handle regex that never matches', () => {
      const neverMatches = literalRegex(/(?!)/, ['impossible'] as const);
      
      expect(() => neverMatches.parse('anything')).toThrow();
    });

    it('should work with anchored patterns', () => {
      const anchored = literalRegex(
        /^(start|begin)$/,
        ['start', 'begin'] as const
      );
      
      expect(anchored.parse('start')).toBe('start');
      expect(anchored.parse('begin')).toBe('begin');
    });

    it('should handle case-insensitive regex with case-sensitive literals', () => {
      const protocol = literalRegex(
        /https?/i,
        ['http', 'https', 'HTTP', 'HTTPS'] as const
      );
      
      expect(protocol.parse('http')).toBe('http');
      expect(protocol.parse('HTTPS')).toBe('HTTPS');
      expect(() => protocol.parse('Http')).toThrow(); // Not in literals
    });

    it('should work with unicode patterns', () => {
      const emoji = literalRegex(
        /😀|😃|😄/,
        ['😀', '😃', '😄'] as const
      );
      
      expect(emoji.parse('😀')).toBe('😀');
      expect(emoji.parse('😃')).toBe('😃');
      expect(() => emoji.parse('😁')).toThrow(); // Not in literals
    });
  });

  describe('integration with larger parsers', () => {
    it('should work in HTTP request parsing', () => {
      const httpMethod = pattern(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const);
      const httpVersion = pattern(['HTTP/1.0', 'HTTP/1.1', 'HTTP/2.0'] as const);
      
      // These would be used in a larger sequence parser
      expect(httpMethod.parse('GET')).toBe('GET');
      expect(httpVersion.parse('HTTP/1.1')).toBe('HTTP/1.1');
    });

    it('should work in CSS parsing', () => {
      const cssUnit = pattern(['px', 'em', 'rem', '%', 'vh', 'vw'] as const);
      const cssColor = literalRegex(
        /red|blue|green|black|white/,
        ['red', 'blue', 'green', 'black', 'white'] as const
      );
      
      expect(cssUnit.parse('px')).toBe('px');
      expect(cssColor.parse('red')).toBe('red');
    });

    it('should work in SQL keyword parsing', () => {
      const sqlKeyword = pattern([
        'SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE',
        'CREATE', 'DROP', 'ALTER', 'INDEX', 'TABLE'
      ] as const);
      
      expect(sqlKeyword.parse('SELECT')).toBe('SELECT');
      expect(sqlKeyword.parse('WHERE')).toBe('WHERE');
      expect(() => sqlKeyword.parse('select')).toThrow(); // Case sensitive
    });

    it('should work with configuration file parsing', () => {
      const configSection = pattern(['[database]', '[server]', '[logging]'] as const);
      const logLevel = pattern(['DEBUG', 'INFO', 'WARN', 'ERROR'] as const);
      
      expect(configSection.parse('[database]')).toBe('[database]');
      expect(logLevel.parse('DEBUG')).toBe('DEBUG');
    });

    it('should combine with choice for flexible parsing', () => {
      const keyword = pattern(['if', 'while', 'for'] as const);
      const operator = pattern(['+', '-', '*', '/'] as const);
      const identifier = literalRegex(/[a-z]+/, ['x', 'y', 'z', 'name'] as const);
      
      const token = choice([keyword, operator, identifier]);
      
      expect(token.parse('if')).toBe('if');
      expect(token.parse('+')).toBe('+');
      expect(token.parse('x')).toBe('x');
      expect(() => token.parse('invalid')).toThrow();
    });
  });

  describe('type safety verification', () => {
    it('should maintain type safety with const assertions', () => {
      const methods = pattern(['GET', 'POST'] as const);
      const result = methods.parse('GET');
      
      // TypeScript should infer result as 'GET' | 'POST'
      expect(typeof result).toBe('string');
      expect(['GET', 'POST']).toContain(result);
    });

    it('should work with mapped transformations', () => {
      const boolean = pattern(['true', 'false'] as const);
      const booleanValue = boolean.map(str => str === 'true');
      
      expect(booleanValue.parse('true')).toBe(true);
      expect(booleanValue.parse('false')).toBe(false);
    });

    it('should work with switch statements on results', () => {
      const logLevel = pattern(['debug', 'info', 'warn', 'error'] as const);
      const logLevelNum = logLevel.map(level => {
        switch (level) {
          case 'debug': return 0;
          case 'info': return 1;
          case 'warn': return 2;
          case 'error': return 3;
        }
      });
      
      expect(logLevelNum.parse('debug')).toBe(0);
      expect(logLevelNum.parse('error')).toBe(3);
    });
  });

  describe('error handling', () => {
    it('should provide meaningful error messages', () => {
      const colors = pattern(['red', 'green', 'blue'] as const);
      
      expect(() => colors.parse('yellow')).toThrow();
    });

    it('should handle empty input', () => {
      const nonEmpty = pattern(['test'] as const);
      
      expect(() => nonEmpty.parse('')).toThrow();
    });

    it('should handle partial matches', () => {
      const fullWord = pattern(['hello'] as const);
      
      expect(() => fullWord.parse('hell')).toThrow();
      expect(() => fullWord.parse('hello world', { consumeAll: true })).toThrow(); // Doesn't consume all
    });

    it('should handle null or undefined in literals array', () => {
      // TypeScript should prevent this, but test runtime behavior
      const withUndefined = pattern(['valid', undefined as any] as const);
      
      expect(withUndefined.parse('valid')).toBe('valid');
      expect(() => withUndefined.parse('undefined')).toThrow();
    });

    it('should handle very long literal arrays', () => {
      const manyLiterals = pattern(Array.from({ length: 1000 }, (_, i) => `item${i}`));
      
      expect(manyLiterals.parse('item0')).toBe('item0');
      expect(manyLiterals.parse('item999')).toBe('item999');
      expect(() => manyLiterals.parse('item1000', { consumeAll: true })).toThrow();
    });

    it('should handle duplicate literals gracefully', () => {
      const withDuplicates = pattern(['test', 'test', 'other'] as const);
      
      expect(withDuplicates.parse('test')).toBe('test');
      expect(withDuplicates.parse('other')).toBe('other');
    });
  });
});
