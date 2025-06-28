import { describe, it, expect } from 'vitest';
import { recover, terminated, recoverWithContext, legacyRecover } from '../../src/primitives/recover';
import { str, regex, sequence, choice, many, optional, number } from '../../src/parser';

describe('Error Recovery and Robust Parsing', () => {
  describe('terminated function', () => {
    it('should consume terminator when primary parser succeeds', () => {
      const primaryParser = str('hello');
      const terminator = str(';');
      
      const parser = terminated(primaryParser, terminator);
      const result = parser.parse('hello;');
      
      expect(result).toBe('hello');
    });

    it('should fail when terminator is missing', () => {
      const primaryParser = str('hello');
      const terminator = str(';');
      
      const parser = terminated(primaryParser, terminator);
      
      expect(() => parser.parse('hello')).toThrow('Expected terminator');
    });

    it('should work with CSS properties', () => {
      const identifier = regex(/[a-z-]+/);
      const cssValue = regex(/[^;]+/);
      const cssProperty = sequence([
        identifier,
        str(':'),
        str(' '),
        cssValue
      ], ([prop, , , value]) => ({ property: prop, value }));
      
      const terminatedProperty = terminated(cssProperty, str(';'));
      
      const result = terminatedProperty.parse('color: red;');
      expect(result).toEqual({ property: 'color', value: 'red' });
    });
  });

  describe('recover function with new API', () => {
    it('should return normal result when primary parser succeeds and onSuccess is ignore', () => {
      const primaryParser = str('hello');
      
      const parser = recover(primaryParser, {
        patterns: str(';'),
        fallback: 'fallback',
        strategy: 'consume',
        onSuccess: 'ignore'
      });
      const result = parser.parse('hello');
      
      expect(result).toBe('hello');
    });

    it('should recover when primary parser fails and recovery point is found', () => {
      const primaryParser = str('expected');
      
      const parser = recover(primaryParser, {
        patterns: str(';'),
        fallback: 'recovered',
        strategy: 'consume'
      });
      const result = parser.parse('unexpected text;');
      
      expect(result).toBe('recovered');
    });

    it('should return original failure when no recovery point is found', () => {
      const primaryParser = str('expected');
      
      const parser = recover(primaryParser, {
        patterns: str(';'),
        fallback: 'recovered',
        strategy: 'consume'
      });
      
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
      
      const recoveredFunction = recover(functionDecl, {
        patterns: str('}'),
        fallback: ['function', ' ', 'error', '(', ')', ' ', '{', '}'],
        strategy: 'consume'
      });
      
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
      
      const arrayElement = recover(validElement, {
        patterns: str(','),
        fallback: { type: 'error', value: null },
        strategy: 'consume'
      });
      
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
      
      const recoveredProperty = terminated(cssProperty, str(';'));
      
      // Valid property
      const validResult = recoveredProperty.parse('color: red;');
      expect(validResult).toEqual({ property: 'color', value: 'red' });
      
      // Invalid property should fail since we're using terminated, not recover
      expect(() => recoveredProperty.parse('invalid syntax;')).toThrow();
    });

    it('should work with CSS property recovery using recover function', () => {
      const identifier = regex(/[a-z-]+/);
      const cssValue = regex(/[^;]+/);
      const cssProperty = sequence([
        identifier,
        str(':'),
        str(' '),
        cssValue
      ], ([prop, , , value]) => ({ property: prop, value }));
      
      const recoveredProperty = recover(cssProperty, {
        patterns: str(';'),
        fallback: { property: 'error', value: 'invalid' },
        strategy: 'consume'
      });
      
      // Valid property
      const validResult = recoveredProperty.parse('color: red;', { consumeAll: false });
      expect(validResult).toEqual({ property: 'color', value: 'red' });
      
      // Invalid property that recovers at semicolon
      const invalidResult = recoveredProperty.parse('invalid syntax;', { consumeAll: false });
      expect(invalidResult).toEqual({ property: 'error', value: 'invalid' });
    });

    it('should work with statement recovery in a program', () => {
      const validStatement = choice([
        str('let x = 1;'),
        str('console.log("hello");'),
        str('return true;')
      ]);
      
      const statement = recover(validStatement, {
        patterns: str(';'),
        fallback: 'error_statement;',
        strategy: 'consume'
      });
      
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
      
      const parser = recover(primaryParser, {
        patterns: str('RECOVER'),
        fallback: 'found recovery',
        strategy: 'consume'
      });
      const result = parser.parse('invalid lots of text RECOVER');
      
      expect(result).toBe('found recovery');
    });

    it('should work with nested recovery scenarios', () => {
      const innerParser = str('inner');
      const outerParser = sequence([str('outer('), innerParser, str(')')]);
      
      const recoveredInner = recover(innerParser, {
        patterns: str(')'),
        fallback: 'inner_error',
        strategy: 'consume'
      });
      const recoveredOuter = recover(
        sequence([str('outer('), recoveredInner, str(')')]), {
          patterns: str(';'),
          fallback: ['outer(', 'outer_error', ')'],
          strategy: 'consume'
        }
      );
      
      // Outer failure, recovers at semicolon
      const result1 = recoveredOuter.parse('invalid outer;');
      expect(result1).toEqual(['outer(', 'outer_error', ')']);
      
      // Inner failure, recovers at parenthesis
      const result2 = recoveredOuter.parse('outer(invalid)', { consumeAll: false });
      expect(result2).toEqual(['outer(', 'inner_error', ')']);
    });

    it('should work with different fallback types', () => {
      const stringFallback = recover(str('fail'), {
        patterns: str(';'),
        fallback: 'string_fallback',
        strategy: 'consume'
      });
      const numberFallback = recover(str('fail'), {
        patterns: str(';'),
        fallback: 42,
        strategy: 'consume'
      });
      const objectFallback = recover(str('fail'), {
        patterns: str(';'),
        fallback: { error: true },
        strategy: 'consume'
      });
      const arrayFallback = recover(str('fail'), {
        patterns: str(';'),
        fallback: ['error'],
        strategy: 'consume'
      });
      
      expect(stringFallback.parse('wrong;')).toBe('string_fallback');
      expect(numberFallback.parse('wrong;')).toBe(42);
      expect(objectFallback.parse('wrong;')).toEqual({ error: true });
      expect(arrayFallback.parse('wrong;')).toEqual(['error']);
    });

    it('should handle empty recovery parser', () => {
      const parser = recover(str('fail'), {
        patterns: str(''),
        fallback: 'empty_recovery',
        strategy: 'consume'
      });
      
      // Should immediately find empty string and recover
      const result = parser.parse('anything', { consumeAll: false });
      expect(result).toBe('empty_recovery');
    });

    it('should handle recovery at end of input', () => {
      const parser = recover(str('expected'), {
        patterns: str('END'),
        fallback: 'recovered',
        strategy: 'consume'
      });
      
      const result = parser.parse('unexpected END', { consumeAll: false });
      expect(result).toBe('recovered');
    });

    it('should work with regex recovery patterns', () => {
      const primaryParser = str('valid');
      
      const parser = recover(primaryParser, {
        patterns: regex(/[.!?]/),
        fallback: 'sentence_end',
        strategy: 'consume'
      });
      
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
      
      const recoveredKeyValue = recover(keyValue, {
        patterns: str(','),
        fallback: { error: 'malformed_property' },
        strategy: 'consume'
      });
      
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
      
      const recoveredFunction = recover(functionDecl, {
        patterns: str('}'),
        fallback: {
          type: 'function',
          name: 'error',
          params: [],
          body: []
        },
        strategy: 'consume'
      });
      
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
      
      const statement = recover(validStatement, {
        patterns: str(';'),
        fallback: { type: 'syntax_error', query: 'malformed' },
        strategy: 'consume'
      });
      
      const script = many(statement);
      
      const input = `SELECT * FROM users;INVALID SYNTAX HERE;UPDATE users SET name = 'John';`;
      const result = script.parse(input);
      
      // The input produces 5 items because the invalid syntax doesn't start with valid keywords
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual(['SELECT', ' * FROM users']);
      expect(result[1]).toEqual({ type: 'syntax_error', query: 'malformed' });
      expect(result[2]).toEqual(['UPDATE', ' users SET name = \'John\'']);
    });

    it('should handle configuration file parsing with recovery', () => {
      const configKey = regex(/[a-z_]+/);
      const configValue = regex(/[^\n]+/);
      const configLine = sequence([configKey, str('='), configValue]);
      
      const recoveredLine = recover(configLine, {
        patterns: regex(/\n/),
        fallback: { key: 'error', value: 'invalid_line' },
        strategy: 'consume'
      });
      
      const configFile = many(recoveredLine);
      
      const input = `host=localhost\ninvalid line without equals\nport=3000`;
      const result = configFile.parse(input);
      
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
      
      const recoveredTag = recover(validTag, {
        patterns: str('>'),
        fallback: { type: 'malformed_tag', content: 'error' },
        strategy: 'consume'
      });
      
      const result = recoveredTag.parse('<div incomplete tag >');
      expect(result).toEqual({ type: 'malformed_tag', content: 'error' });
    });
  });

  describe('edge cases', () => {
    it('should handle empty input', () => {
      const parser = recover(str('expected'), {
        patterns: str(';'),
        fallback: 'fallback',
        strategy: 'consume'
      });
      
      expect(() => parser.parse('')).toThrow();
    });

    it('should handle recovery point at start of input', () => {
      const parser = recover(str('expected'), {
        patterns: str('start'),
        fallback: 'recovered',
        strategy: 'consume'
      });
      
      const result = parser.parse('start of input', { consumeAll: false });
      expect(result).toBe('recovered');
    });

    it('should handle multiple recovery points', () => {
      const parser = recover(str('expected'), {
        patterns: str(';'),
        fallback: 'recovered',
        strategy: 'consume'
      });
      
      // Should find first recovery point
      const result = parser.parse('invalid; more text; even more;', { consumeAll: false });
      expect(result).toBe('recovered');
    });

    it('should handle overlapping recovery patterns', () => {
      const parser = recover(str('expected'), {
        patterns: str(';;'),
        fallback: 'recovered',
        strategy: 'consume'
      });
      
      const result = parser.parse('invalid;;');
      expect(result).toBe('recovered');
    });

    it('should handle recovery pattern that appears in valid input', () => {
      const parser = recover(str('valid;input'), {
        patterns: str(';'),
        fallback: 'recovered',
        strategy: 'consume'
      });
      
      // Should succeed normally since primary parser succeeds
      const result = parser.parse('valid;input');
      expect(result).toBe('valid;input');
    });

    it('should handle very long input with recovery', () => {
      const parser = recover(str('needle'), {
        patterns: str('haystack'),
        fallback: 'found',
        strategy: 'consume'
      });
      const longInput = 'x'.repeat(1000) + 'haystack';
      
      const result = parser.parse(longInput);
      expect(result).toBe('found');
    });

    it('should handle recovery with null fallback', () => {
      const parser = recover(str('fail'), {
        patterns: str(';'),
        fallback: null,
        strategy: 'consume'
      });
      
      const result = parser.parse('invalid;');
      expect(result).toBeNull();
    });

    it('should handle recovery with undefined fallback', () => {
      const parser = recover(str('fail'), {
        patterns: str(';'),
        fallback: undefined,
        strategy: 'consume'
      });
      
      const result = parser.parse('invalid;');
      expect(result).toBeUndefined();
    });

    it('should handle recursive recovery', () => {
      let recursiveParser: any;
      recursiveParser = recover(
        choice([str('base'), sequence([str('('), () => recursiveParser, str(')')])]), {
          patterns: str(')'),
          fallback: 'error',
          strategy: 'consume'
        }
      );
      
      const result = recursiveParser.parse('invalid)');
      expect(result).toBe('error');
    });

    it('should handle recovery at exactly the input boundary', () => {
      const parser = recover(str('expected'), {
        patterns: str('!'),
        fallback: 'boundary',
        strategy: 'consume'
      });
      
      const result = parser.parse('wrong!');
      expect(result).toBe('boundary');
    });
  });

  describe('error handling', () => {
    it('should preserve original error message when no recovery', () => {
      const parser = recover(str('expected'), {
        patterns: str('never'),
        fallback: 'fallback',
        strategy: 'consume'
      });
      
      expect(() => parser.parse('wrong')).toThrow(); // Should contain original error
    });

    it('should handle recovery parser that also fails', () => {
      const primaryParser = str('primary');
      const parser = recover(primaryParser, {
        patterns: str('recovery'),
        fallback: 'fallback',
        strategy: 'consume'
      });
      
      expect(() => parser.parse('neither')).toThrow();
    });

    it('should handle complex nested recovery failures', () => {
      const inner = recover(str('inner'), {
        patterns: str(')'),
        fallback: 'inner_error',
        strategy: 'consume'
      });
      const outer = recover(sequence([str('('), inner]), {
        patterns: str(';'),
        fallback: 'outer_error',
        strategy: 'consume'
      });
      
      // Should fail completely if no recovery points found
      expect(() => outer.parse('completely wrong')).toThrow();
    });

    it('should handle recovery parser consuming no input', () => {
      const parser = recover(str('fail'), {
        patterns: str(''),
        fallback: 'empty_recovery',
        strategy: 'consume'
      });
      
      // Should recover immediately with empty string parser
      const result = parser.parse('anything', { consumeAll: false });
      expect(result).toBe('empty_recovery');
    });
  });

  describe('performance considerations', () => {
    it('should not create infinite loops with invalid recovery', () => {
      // Recovery that doesn't advance should still terminate
      const parser = recover(str('fail'), {
        patterns: str(''),
        fallback: 'recovered',
        strategy: 'consume'
      });
      
      expect(() => {
        const result = parser.parse('test', { consumeAll: false });
        expect(result).toBe('recovered');
      }).not.toThrow();
    });

    it('should handle large inputs efficiently', () => {
      const parser = recover(str('needle'), {
        patterns: str('end'),
        fallback: 'found',
        strategy: 'consume'
      });
      const largeInput = 'a'.repeat(10000) + 'end';
      
      const start = performance.now();
      const result = parser.parse(largeInput);
      const end = performance.now();
      
      expect(result).toBe('found');
      expect(end - start).toBeLessThan(100); // Should be reasonably fast
    });
  });

  describe('new API features', () => {
    describe('strategy: position', () => {
      it('should position at pattern but not consume it', () => {
        const parser = recover(str('fail'), {
          patterns: str(';'),
          fallback: 'recovered',
          strategy: 'position'
        });
        
        const result = parser.parse('invalid;remaining', { consumeAll: false });
        expect(result).toBe('recovered');
        // TODO: Add assertion that ';remaining' is left unconsumed
      });

      it('should work with multiple recovery points using position strategy', () => {
        const parser = recover(str('expected'), {
          patterns: str(','),
          fallback: 'comma_found',
          strategy: 'position'
        });
        
        const result = parser.parse('invalid,more,text', { consumeAll: false });
        expect(result).toBe('comma_found');
      });
    });

    describe('onSuccess options', () => {
      it('should ignore pattern when onSuccess is ignore', () => {
        const parser = recover(str('hello'), {
          patterns: str(';'),
          fallback: 'fallback',
          strategy: 'consume',
          onSuccess: 'ignore'
        });
        
        const result = parser.parse('hello');
        expect(result).toBe('hello');
      });

      it('should require pattern when onSuccess is requirePattern', () => {
        const parser = recover(str('hello'), {
          patterns: str(';'),
          fallback: 'fallback',
          strategy: 'consume',
          onSuccess: 'requirePattern'
        });
        
        const result = parser.parse('hello;');
        expect(result).toBe('hello');
        
        expect(() => parser.parse('hello')).toThrow();
      });

      it('should optionally consume pattern when onSuccess is optionalPattern', () => {
        const parser = recover(str('hello'), {
          patterns: str(';'),
          fallback: 'fallback',
          strategy: 'consume',
          onSuccess: 'optionalPattern'
        });
        
        const result1 = parser.parse('hello;');
        expect(result1).toBe('hello');
        
        const result2 = parser.parse('hello');
        expect(result2).toBe('hello');
      });
    });

    describe('multiple patterns', () => {
      it('should handle array of recovery patterns', () => {
        const parser = recover(str('expected'), {
          patterns: [str(';'), str(','), str('.')],
          fallback: 'recovered',
          strategy: 'consume'
        });
        
        expect(parser.parse('invalid;')).toBe('recovered');
        expect(parser.parse('invalid,')).toBe('recovered');
        expect(parser.parse('invalid.')).toBe('recovered');
      });

      it('should find first matching pattern in array', () => {
        const parser = recover(str('expected'), {
          patterns: [str('second'), str('first')],
          fallback: 'found',
          strategy: 'consume'
        });
        
        const result = parser.parse('invalid first second', { consumeAll: false });
        expect(result).toBe('found');
      });

      it('should work with mixed pattern types', () => {
        const parser = recover(str('expected'), {
          patterns: [regex(/[.!?]/), str(';'), str('END')],
          fallback: 'punctuation',
          strategy: 'consume'
        });
        
        expect(parser.parse('invalid.')).toBe('punctuation');
        expect(parser.parse('invalid;')).toBe('punctuation');
        expect(parser.parse('invalidEND')).toBe('punctuation');
      });
    });

    describe('recoverWithContext function', () => {
      it('should use local recovery context', () => {
        const parser = recoverWithContext(str('expected'), {
          pattern: str(';'),
          fallback: 'local_recovery',
          consume: true
        });
        
        const result = parser.parse('unexpected text;more text', { consumeAll: false });
        expect(result).toBe('local_recovery');
      });

      it('should work with position strategy by not consuming', () => {
        const parser = recoverWithContext(str('valid'), {
          pattern: str('}'),
          fallback: 'positioned',
          consume: false
        });
        
        const result = parser.parse('invalid code}', { consumeAll: false });
        expect(result).toBe('positioned');
      });

      it('should handle global recovery context', () => {
        const parser = recoverWithContext(
          str('expected'), 
          {
            pattern: str(','),
            fallback: 'local_recovery',
            consume: true
          },
          {
            pattern: str(';'),
            fallback: 'global_recovery',
            consume: true
          }
        );
        
        // Should find global pattern when local not found
        const result = parser.parse('wrong;');
        expect(result).toBe('global_recovery');
      });

      it('should prefer local recovery over global', () => {
        const parser = recoverWithContext(
          str('expected'), 
          {
            pattern: str(','),
            fallback: 'local_recovery',
            consume: true
          },
          {
            pattern: str(';'),
            fallback: 'global_recovery',
            consume: true
          }
        );
        
        // Should find local pattern first
        const result = parser.parse('wrong,;', { consumeAll: false });
        expect(result).toBe('local_recovery');
      });
    });

    describe('complex scenarios with new API', () => {
      it('should handle CSS parsing with position strategy', () => {
        const cssProperty = sequence([
          regex(/[a-z-]+/),
          str(':'),
          regex(/[^;]+/)
        ]);
        
        const recoveredProperty = recover(cssProperty, {
          patterns: str(';'),
          fallback: { property: 'error', value: 'invalid' },
          strategy: 'position',
          onSuccess: 'requirePattern'
        });
        
        const result = recoveredProperty.parse('color: red;');
        expect(result).toEqual(['color', ':', ' red']);
      });

      it('should handle function parsing with multiple recovery patterns', () => {
        const functionDecl = sequence([
          str('function'),
          str(' '),
          regex(/[a-z]+/),
          str('()')
        ]);
        
        const recoveredFunction = recover(functionDecl, {
          patterns: [str('}'), str(';'), str('\n')],
          fallback: { type: 'error', name: 'unknown' },
          strategy: 'consume'
        });
        
        expect(recoveredFunction.parse('function test()')).toEqual(['function', ' ', 'test', '()']);
        expect(recoveredFunction.parse('invalid function}')).toEqual({ type: 'error', name: 'unknown' });
      });

      it('should handle nested recovery with different strategies', () => {
        const innerContent = str('valid');
        const innerRecover = recover(innerContent, {
          patterns: str(')'),
          fallback: 'inner_error',
          strategy: 'position'
        });
        
        const outerContent = sequence([str('('), innerRecover, str(')')]);
        const outerRecover = recover(outerContent, {
          patterns: str(';'),
          fallback: ['(', 'outer_error', ')'],
          strategy: 'consume'
        });
        
        // This should trigger outer recovery since '(' is missing
        const result = outerRecover.parse('invalid);', { consumeAll: false });
        expect(result).toEqual(['(', 'outer_error', ')']);
      });
    });
  });
});
