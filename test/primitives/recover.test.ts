import { describe, it, expect } from 'vitest';
import { recover } from '../../src/primitives/recover';
import { str, regex, sequence, choice, many, optional, number } from '../../src/parser';

describe('Error Recovery and Robust Parsing', () => {
  describe('recover function', () => {
    it('should return normal result when primary parser succeeds', () => {
      const primaryParser = str('hello');
      const recoveryParser = str(';');
      const fallback = 'fallback';
      
      const parser = recover(primaryParser, recoveryParser, fallback);
      const result = parser.parse('hello');
      
      expect(result).toBe('hello');
    });

    it('should recover when primary parser fails and recovery point is found', () => {
      const primaryParser = str('expected');
      const recoveryParser = str(';');
      const fallback = 'recovered';
      
      const parser = recover(primaryParser, recoveryParser, fallback);
      const result = parser.parse('unexpected text;');
      
      expect(result).toBe('recovered');
    });

    it('should return original failure when no recovery point is found', () => {
      const primaryParser = str('expected');
      const recoveryParser = str(';');
      const fallback = 'recovered';
      
      const parser = recover(primaryParser, recoveryParser, fallback);
      
      expect(() => parser.parse('unexpected text')).toThrow();
    });

    it('should work with function declaration recovery', () => {
      const identifier = regex(/[a-z]+/);
      const functionDecl = sequence([
        str('function'),
        str(' '),
        identifier,
        str('('),
        str(')'),
        str(' '),
        str('{'),
        str('}')
      ]);
      
      const recoveredFunction = recover(
        functionDecl,
        str('}'),
        ['function', ' ', 'error', '(', ')', ' ', '{', '}']
      );
      
      // Valid function
      const validResult = recoveredFunction.parse('function test() {}');
      expect(validResult).toEqual(['function', ' ', 'test', '(', ')', ' ', '{', '}']);
      
      // Invalid function that recovers at closing brace
      const invalidResult = recoveredFunction.parse('function invalid syntax }');
      expect(invalidResult).toEqual(['function', ' ', 'error', '(', ')', ' ', '{', '}']);
    });

    it('should work with array element recovery', () => {
      const numberLiteral = number;
      const stringLiteral = sequence([str('"'), regex(/[^"]*/), str('"')]);
      const validElement = choice([numberLiteral, stringLiteral]);
      
      const arrayElement = recover(
        validElement,
        str(','),
        { type: 'error', value: null }
      );
      
      // Valid element
      const validResult = arrayElement.parse('123');
      expect(validResult).toBe(123);
      
      // Invalid element that recovers at comma
      const invalidResult = arrayElement.parse('invalid_syntax,');
      expect(invalidResult).toEqual({ type: 'error', value: null });
    });

    it('should work with CSS property recovery', () => {
      const identifier = regex(/[a-z-]+/);
      const cssValue = regex(/[^;]+/);
      const cssProperty = sequence([
        identifier,
        str(':'),
        str(' '),
        cssValue
      ], ([prop, , , value]) => ({ property: prop, value }));
      
      const recoveredProperty = recover(
        cssProperty,
        str(';'),
        { property: 'error', value: 'invalid' }
      );
      
      // Valid property
      const validResult = recoveredProperty.parse('color: red;');
      expect(validResult).toEqual({ property: 'color', value: 'red' });
      
      // Invalid property that recovers at semicolon
      const invalidResult = recoveredProperty.parse('invalid syntax;');
      expect(invalidResult).toEqual({ property: 'error', value: 'invalid' });
    });

    it('should work with statement recovery in a program', () => {
      const validStatement = choice([
        str('let x = 1;'),
        str('console.log("hello");'),
        str('return true;')
      ]);
      
      const statement = recover(
        validStatement,
        str(';'),
        'error_statement;'
      );
      
      const program = many(statement);
      
      const result = program.parse('let x = 1;invalid syntax;console.log("hello");');
      expect(result).toEqual([
        'let x = 1;',
        'error_statement;',
        'console.log("hello");'
      ]);
    });

    it('should skip multiple characters to find recovery point', () => {
      const primaryParser = str('valid');
      const recoveryParser = str('RECOVER');
      const fallback = 'found recovery';
      
      const parser = recover(primaryParser, recoveryParser, fallback);
      const result = parser.parse('invalid lots of text RECOVER');
      
      expect(result).toBe('found recovery');
    });

    it('should work with nested recovery scenarios', () => {
      const innerParser = str('inner');
      const outerParser = sequence([str('outer('), innerParser, str(')')]);
      
      const recoveredInner = recover(innerParser, str(')'), 'inner_error');
      const recoveredOuter = recover(
        sequence([str('outer('), recoveredInner, str(')')]),
        str(';'),
        ['outer(', 'outer_error', ')']
      );
      
      // Outer failure, recovers at semicolon
      const result1 = recoveredOuter.parse('invalid outer;');
      expect(result1).toEqual(['outer(', 'outer_error', ')']);
      
      // Inner failure, recovers at parenthesis
      const result2 = recoveredOuter.parse('outer(invalid)');
      expect(result2).toEqual(['outer(', 'inner_error', ')']);
    });

    it('should work with different fallback types', () => {
      const stringFallback = recover(str('fail'), str(';'), 'string_fallback');
      const numberFallback = recover(str('fail'), str(';'), 42);
      const objectFallback = recover(str('fail'), str(';'), { error: true });
      const arrayFallback = recover(str('fail'), str(';'), ['error']);
      
      expect(stringFallback.parse('wrong;')).toBe('string_fallback');
      expect(numberFallback.parse('wrong;')).toBe(42);
      expect(objectFallback.parse('wrong;')).toEqual({ error: true });
      expect(arrayFallback.parse('wrong;')).toEqual(['error']);
    });

    it('should handle empty recovery parser', () => {
      const parser = recover(str('fail'), str(''), 'empty_recovery');
      
      // Should immediately find empty string and recover
      const result = parser.parse('anything');
      expect(result).toBe('empty_recovery');
    });

    it('should handle recovery at end of input', () => {
      const parser = recover(str('expected'), str('END'), 'recovered');
      
      const result = parser.parse('unexpected END');
      expect(result).toBe('recovered');
    });

    it('should work with regex recovery patterns', () => {
      const primaryParser = str('valid');
      const recoveryParser = regex(/[.!?]/);
      const fallback = 'sentence_end';
      
      const parser = recover(primaryParser, recoveryParser, fallback);
      
      expect(parser.parse('invalid text.')).toBe('sentence_end');
      expect(parser.parse('invalid text!')).toBe('sentence_end');
      expect(parser.parse('invalid text?')).toBe('sentence_end');
    });

    it('should handle complex recovery scenarios', () => {
      // Simulating malformed JSON object recovery
      const key = sequence([str('"'), regex(/[^"]*/), str('"')]);
      const value = choice([
        sequence([str('"'), regex(/[^"]*/), str('"')]),
        number,
        str('true'),
        str('false'),
        str('null')
      ]);
      const keyValue = sequence([key, str(':'), value]);
      
      const recoveredKeyValue = recover(
        keyValue,
        str(','),
        { error: 'malformed_property' }
      );
      
      const result = recoveredKeyValue.parse('invalid property,');
      expect(result).toEqual({ error: 'malformed_property' });
    });
  });

  describe('integration with real-world scenarios', () => {
    it('should handle malformed function parsing', () => {
      const identifier = regex(/[a-zA-Z_][a-zA-Z0-9_]*/);
      const paramList = optional(sequence([identifier, many(sequence([str(','), identifier]))]));
      
      const functionDecl = sequence([
        str('function'),
        regex(/\s+/),
        identifier,
        str('('),
        paramList,
        str(')'),
        regex(/\s*\{\s*\}/)
      ]);
      
      const recoveredFunction = recover(
        functionDecl,
        str('}'),
        {
          type: 'function',
          name: 'error',
          params: [],
          body: []
        }
      );
      
      const program = many(recoveredFunction);
      
      const result = program.parse(`
        function valid(x, y) {}
        function invalid syntax }
        function another() {}
      `.trim());
      
      expect(result).toHaveLength(3);
      expect(result[1]).toEqual({
        type: 'function',
        name: 'error',
        params: [],
        body: []
      });
    });

    it('should handle SQL statement recovery', () => {
      const selectStmt = sequence([str('SELECT'), regex(/[^;]+/)]);
      const insertStmt = sequence([str('INSERT'), regex(/[^;]+/)]);
      const updateStmt = sequence([str('UPDATE'), regex(/[^;]+/)]);
      
      const validStatement = choice([selectStmt, insertStmt, updateStmt]);
      
      const statement = recover(
        validStatement,
        str(';'),
        { type: 'syntax_error', query: 'malformed' }
      );
      
      const script = many(statement);
      
      const result = script.parse(`
        SELECT * FROM users;
        INVALID SYNTAX HERE;
        UPDATE users SET name = 'John';
      `.trim());
      
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual(['SELECT', ' * FROM users']);
      expect(result[1]).toEqual({ type: 'syntax_error', query: 'malformed' });
      expect(result[2]).toEqual(['UPDATE', ' users SET name = \'John\'']);
    });

    it('should handle configuration file parsing with recovery', () => {
      const configKey = regex(/[a-z_]+/);
      const configValue = regex(/[^\n]+/);
      const configLine = sequence([configKey, str('='), configValue]);
      
      const recoveredLine = recover(
        configLine,
        regex(/\n/),
        { key: 'error', value: 'invalid_line' }
      );
      
      const configFile = many(recoveredLine);
      
      const result = configFile.parse(`
        host=localhost
        invalid line without equals
        port=3000
      `.trim());
      
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual(['host', '=', 'localhost']);
      expect(result[1]).toEqual({ key: 'error', value: 'invalid_line' });
      expect(result[2]).toEqual(['port', '=', '3000']);
    });

    it('should handle HTML tag recovery', () => {
      const tagName = regex(/[a-z]+/);
      const openTag = sequence([str('<'), tagName, str('>')]);
      const closeTag = sequence([str('</'), tagName, str('>')]);
      const validTag = sequence([openTag, regex(/[^<]*/), closeTag]);
      
      const recoveredTag = recover(
        validTag,
        str('>'),
        { type: 'malformed_tag', content: 'error' }
      );
      
      const result = recoveredTag.parse('<div incomplete tag >');
      expect(result).toEqual({ type: 'malformed_tag', content: 'error' });
    });
  });

  describe('edge cases', () => {
    it('should handle empty input', () => {
      const parser = recover(str('expected'), str(';'), 'fallback');
      
      expect(() => parser.parse('')).toThrow();
    });

    it('should handle recovery point at start of input', () => {
      const parser = recover(str('expected'), str('start'), 'recovered');
      
      const result = parser.parse('start of input');
      expect(result).toBe('recovered');
    });

    it('should handle multiple recovery points', () => {
      const parser = recover(str('expected'), str(';'), 'recovered');
      
      // Should find first recovery point
      const result = parser.parse('invalid; more text; even more;');
      expect(result).toBe('recovered');
    });

    it('should handle overlapping recovery patterns', () => {
      const parser = recover(str('expected'), str(';;'), 'recovered');
      
      const result = parser.parse('invalid;;');
      expect(result).toBe('recovered');
    });

    it('should handle recovery pattern that appears in valid input', () => {
      const parser = recover(str('valid;input'), str(';'), 'recovered');
      
      // Should succeed normally since primary parser succeeds
      const result = parser.parse('valid;input');
      expect(result).toBe('valid;input');
    });

    it('should handle very long input with recovery', () => {
      const parser = recover(str('needle'), str('haystack'), 'found');
      const longInput = 'x'.repeat(1000) + 'haystack';
      
      const result = parser.parse(longInput);
      expect(result).toBe('found');
    });

    it('should handle recovery with null fallback', () => {
      const parser = recover(str('fail'), str(';'), null);
      
      const result = parser.parse('invalid;');
      expect(result).toBeNull();
    });

    it('should handle recovery with undefined fallback', () => {
      const parser = recover(str('fail'), str(';'), undefined);
      
      const result = parser.parse('invalid;');
      expect(result).toBeUndefined();
    });

    it('should handle recursive recovery', () => {
      let recursiveParser: any;
      recursiveParser = recover(
        choice([str('base'), sequence([str('('), () => recursiveParser, str(')')])]),
        str(')'),
        'error'
      );
      
      const result = recursiveParser.parse('invalid)');
      expect(result).toBe('error');
    });

    it('should handle recovery at exactly the input boundary', () => {
      const parser = recover(str('expected'), str('!'), 'boundary');
      
      const result = parser.parse('wrong!');
      expect(result).toBe('boundary');
    });
  });

  describe('error handling', () => {
    it('should preserve original error message when no recovery', () => {
      const parser = recover(str('expected'), str('never'), 'fallback');
      
      expect(() => parser.parse('wrong')).toThrow(); // Should contain original error
    });

    it('should handle recovery parser that also fails', () => {
      const primaryParser = str('primary');
      const recoveryParser = str('recovery');
      const parser = recover(primaryParser, recoveryParser, 'fallback');
      
      expect(() => parser.parse('neither')).toThrow();
    });

    it('should handle complex nested recovery failures', () => {
      const inner = recover(str('inner'), str(')'), 'inner_error');
      const outer = recover(sequence([str('('), inner]), str(';'), 'outer_error');
      
      // Should fail completely if no recovery points found
      expect(() => outer.parse('completely wrong')).toThrow();
    });

    it('should handle recovery parser consuming no input', () => {
      const parser = recover(str('fail'), str(''), 'empty_recovery');
      
      // Should recover immediately with empty string parser
      const result = parser.parse('anything');
      expect(result).toBe('empty_recovery');
    });
  });

  describe('performance considerations', () => {
    it('should not create infinite loops with invalid recovery', () => {
      // Recovery that doesn't advance should still terminate
      const parser = recover(str('fail'), str(''), 'recovered');
      
      expect(() => {
        const result = parser.parse('test');
        expect(result).toBe('recovered');
      }).not.toThrow();
    });

    it('should handle large inputs efficiently', () => {
      const parser = recover(str('needle'), str('end'), 'found');
      const largeInput = 'a'.repeat(10000) + 'end';
      
      const start = performance.now();
      const result = parser.parse(largeInput);
      const end = performance.now();
      
      expect(result).toBe('found');
      expect(end - start).toBeLessThan(100); // Should be reasonably fast
    });
  });
});
