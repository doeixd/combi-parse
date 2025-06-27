import { describe, it, expect, vi } from 'vitest';
import { analyzeParser, optimizeParser, GrammarAnalysis } from '../../src/primitives/grammar';
import { 
  str, 
  regex, 
  choice, 
  sequence, 
  number, 
  many, 
  optional,
  lazy,
  Parser
} from '../../src/parser';

describe('Grammar Analysis and Optimization', () => {
  describe('analyzeParser', () => {
    it('should analyze simple string parser', () => {
      const parser = str('hello');
      const analysis = analyzeParser(parser);
      
      expect(analysis).toHaveProperty('nullable');
      expect(analysis).toHaveProperty('firstSet');
      expect(analysis).toHaveProperty('canBacktrack');
      expect(analysis).toHaveProperty('leftRecursive');
      expect(analysis).toHaveProperty('complexity');
      expect(analysis).toHaveProperty('memoizable');
      
      expect(typeof analysis.nullable).toBe('boolean');
      expect(analysis.firstSet).toBeInstanceOf(Set);
      expect(typeof analysis.canBacktrack).toBe('boolean');
      expect(typeof analysis.leftRecursive).toBe('boolean');
      expect(typeof analysis.complexity).toBe('number');
      expect(typeof analysis.memoizable).toBe('boolean');
    });

    it('should detect nullable parsers', () => {
      const nullableParser = optional(str('test'));
      const nonNullableParser = str('test');
      
      const nullableAnalysis = analyzeParser(nullableParser);
      const nonNullableAnalysis = analyzeParser(nonNullableParser);
      
      expect(nullableAnalysis.nullable).toBe(true);
      expect(nonNullableAnalysis.nullable).toBe(false);
    });

    it('should compute first sets', () => {
      const parser = str('hello');
      const analysis = analyzeParser(parser);
      
      expect(analysis.firstSet).toBeInstanceOf(Set);
      expect(analysis.firstSet.has('h')).toBe(true);
    });

    it('should detect backtracking parsers', () => {
      const simpleParser = str('hello');
      const choiceParser = choice([str('hello'), str('hi'), regex(/\w+/)]);
      
      const simpleAnalysis = analyzeParser(simpleParser);
      const choiceAnalysis = analyzeParser(choiceParser);
      
      expect(simpleAnalysis.canBacktrack).toBe(false);
      expect(choiceAnalysis.canBacktrack).toBe(true);
    });

    it('should estimate parser complexity', () => {
      const simpleParser = str('test');
      const complexParser = many(choice([
        sequence([str('a'), number, str('b')]),
        sequence([str('c'), regex(/\w+/), str('d')]),
        sequence([str('e'), optional(str('f')), str('g')])
      ]));
      
      const simpleAnalysis = analyzeParser(simpleParser);
      const complexAnalysis = analyzeParser(complexParser);
      
      expect(simpleAnalysis.complexity).toBeLessThan(complexAnalysis.complexity);
      expect(complexAnalysis.complexity).toBeGreaterThan(1);
    });

    it('should identify memoizable parsers', () => {
      const simpleParser = str('test');
      const complexParser = choice([
        sequence([regex(/\w+/), str(':'), regex(/\w+/)]),
        sequence([regex(/\w+/), str('='), number]),
        regex(/\w+/)
      ]);
      
      const simpleAnalysis = analyzeParser(simpleParser);
      const complexAnalysis = analyzeParser(complexParser);
      
      // Complex parsers with alternatives should be more likely to benefit from memoization
      expect(typeof simpleAnalysis.memoizable).toBe('boolean');
      expect(typeof complexAnalysis.memoizable).toBe('boolean');
    });

    it('should handle regex parsers', () => {
      const regexParser = regex(/[a-z]+/);
      const analysis = analyzeParser(regexParser);
      
      expect(analysis.complexity).toBeGreaterThan(0);
      expect(analysis.firstSet.size).toBeGreaterThan(0);
    });

    it('should handle sequence parsers', () => {
      const seqParser = sequence([str('let'), regex(/\s+/), regex(/[a-z]+/)]);
      const analysis = analyzeParser(seqParser);
      
      expect(analysis.nullable).toBe(false);
      expect(analysis.firstSet.has('l')).toBe(true);
    });

    it('should handle many parsers', () => {
      const manyParser = many(str('a'));
      const analysis = analyzeParser(manyParser);
      
      expect(analysis.nullable).toBe(true); // many can match zero times
      expect(analysis.firstSet.has('a')).toBe(true);
      expect(analysis.firstSet.has('')).toBe(true); // nullable
    });

    it('should detect left recursion patterns', () => {
      // Simple test for left recursion detection
      const parser = str('test');
      const analysis = analyzeParser(parser);
      
      // Most simple parsers should not be left recursive
      expect(analysis.leftRecursive).toBe(false);
    });
  });

  describe('optimizeParser', () => {
    it('should return an optimized parser', () => {
      const parser = str('hello');
      const optimized = optimizeParser(parser);
      
      expect(optimized).toBeInstanceOf(Parser);
      expect(optimized.parse('hello')).toBe('hello');
    });

    it('should preserve parser semantics', () => {
      const parser = sequence([str('let'), regex(/\s+/), regex(/[a-z]+/)]);
      const optimized = optimizeParser(parser);
      
      const input = 'let variable';
      const originalResult = parser.parse(input);
      const optimizedResult = optimized.parse(input);
      
      expect(optimizedResult).toEqual(originalResult);
    });

    it('should optimize complex parsers', () => {
      const complexParser = choice([
        sequence([str('if'), regex(/\s+/), regex(/[a-z]+/)]),
        sequence([str('while'), regex(/\s+/), regex(/[a-z]+/)]),
        sequence([str('for'), regex(/\s+/), regex(/[a-z]+/)])
      ]);
      
      const optimized = optimizeParser(complexParser);
      
      // Should still parse correctly
      expect(optimized.parse('if condition')).toEqual(['if', ' ', 'condition']);
      expect(optimized.parse('while condition')).toEqual(['while', ' ', 'condition']);
    });

    it('should handle memoization optimization', () => {
      // Create a parser that should benefit from memoization
      const expensiveParser = choice([
        sequence([regex(/\w+/), str(':'), regex(/\w+/)]),
        sequence([regex(/\w+/), str('='), number]),
        sequence([regex(/\w+/), str('('), regex(/\w+/), str(')')])
      ]);
      
      const optimized = optimizeParser(expensiveParser);
      
      // Should still work correctly
      expect(optimized.parse('name:value')).toEqual(['name', ':', 'value']);
      expect(optimized.parse('count=42')).toEqual(['count', '=', 42]);
    });

    it('should optimize recursive parsers', () => {
      let recursiveParser: Parser<any>;
      recursiveParser = choice([
        str('base'),
        sequence([str('rec('), lazy(() => recursiveParser), str(')')])
      ]);
      
      const optimized = optimizeParser(recursiveParser);
      
      // Should handle recursion safely
      expect(optimized.parse('base')).toBe('base');
      expect(optimized.parse('rec(base)')).toEqual(['rec(', 'base', ')']);
    });

    it('should chain multiple optimizations', () => {
      const parser = many(choice([
        sequence([str('a'), number]),
        sequence([str('b'), regex(/\w+/)])
      ]));
      
      // Apply optimization multiple times
      let optimized = parser;
      for (let i = 0; i < 3; i++) {
        optimized = optimizeParser(optimized);
      }
      
      // Should still parse correctly
      expect(optimized.parse('a123b456')).toEqual([['a', 123], ['b', '456']]);
    });
  });

  describe('performance analysis', () => {
    it('should measure parser performance', () => {
      const parser = str('test');
      
      // Mock performance.now for consistent testing
      const mockNow = vi.spyOn(performance, 'now');
      let time = 0;
      mockNow.mockImplementation(() => time++);
      
      const analysis = analyzeParser(parser);
      
      expect(analysis.complexity).toBeGreaterThan(0);
      
      mockNow.mockRestore();
    });

    it('should detect expensive parsers', () => {
      // Simulate an expensive parser by mocking timing
      const mockNow = vi.spyOn(performance, 'now');
      let callCount = 0;
      mockNow.mockImplementation(() => {
        // Return progressively higher times to simulate expensive operations
        return callCount++ * 10;
      });
      
      const parser = many(choice([str('a'), str('b'), str('c')]));
      const analysis = analyzeParser(parser);
      
      expect(analysis.complexity).toBeGreaterThan(1);
      
      mockNow.mockRestore();
    });

    it('should identify quadratic behavior', () => {
      const mockNow = vi.spyOn(performance, 'now');
      let callCount = 0;
      
      // Simulate quadratic timing behavior
      mockNow.mockImplementation(() => {
        const time = callCount * callCount * 0.1;
        callCount++;
        return time;
      });
      
      const parser = many(many(str('a')));
      const analysis = analyzeParser(parser);
      
      // Should detect high complexity
      expect(analysis.complexity).toBeGreaterThan(5);
      
      mockNow.mockRestore();
    });
  });

  describe('edge cases', () => {
    it('should handle empty parsers gracefully', () => {
      const parser = optional(str(''));
      const analysis = analyzeParser(parser);
      
      expect(analysis.nullable).toBe(true);
      expect(analysis.complexity).toBeGreaterThan(0);
    });

    it('should handle very simple parsers', () => {
      const parser = str('a');
      const analysis = analyzeParser(parser);
      
      expect(analysis.complexity).toBeGreaterThan(0);
      
      // Create fresh parser for optimization
      const parser2 = str('a');
      const optimized = optimizeParser(parser2);
      expect(optimized.parse('a')).toBe('a');
    });

    it('should handle failing parsers', () => {
      const parser = str('expected');
      const analysis = analyzeParser(parser);
      const optimized = optimizeParser(parser);
      
      // Should handle analysis of parsers that might fail
      expect(analysis).toBeDefined();
      expect(() => optimized.parse('wrong')).toThrow();
    });

    it('should handle deeply nested parsers', () => {
      let deepParser = str('base');
      for (let i = 0; i < 10; i++) {
        deepParser = choice([deepParser, sequence([str(`level${i}`), deepParser])]);
      }
      
      const analysis = analyzeParser(deepParser);
      const optimized = optimizeParser(deepParser);
      
      expect(analysis.complexity).toBeGreaterThan(1);
      expect(optimized.parse('base')).toBe('base');
    });

    it('should handle parsers with cycles', () => {
      let cyclicParser: Parser<any>;
      cyclicParser = choice([
        str('end'),
        sequence([str('step'), lazy(() => cyclicParser)])
      ]);
      
      const analysis = analyzeParser(cyclicParser);
      const optimized = optimizeParser(cyclicParser);
      
      expect(analysis).toBeDefined();
      expect(optimized.parse('end')).toBe('end');
      expect(optimized.parse('stepend')).toEqual(['step', 'end']);
    });
  });

  describe('integration with real grammars', () => {
    it('should analyze JSON-like grammar', () => {
      // Create fresh parsers for analysis
      const stringLiteral = sequence([
        str('"'),
        regex(/[^"]*/),
        str('"')
      ]);
      
      const numberLiteral = number;
      
      const value = choice([
        stringLiteral,
        numberLiteral,
        str('true'),
        str('false'),
        str('null')
      ]);
      
      const analysis = analyzeParser(value);
      expect(analysis.canBacktrack).toBe(true);
      expect(analysis.firstSet.size).toBeGreaterThan(1);
      
      // Create fresh parsers for optimization testing
      const stringLiteral2 = sequence([
        str('"'),
        regex(/[^"]*/),
        str('"')
      ]);
      
      const numberLiteral2 = number;
      
      const value2 = choice([
        stringLiteral2,
        numberLiteral2,
        str('true'),
        str('false'),
        str('null')
      ]);
      
      const optimized = optimizeParser(value2);
      
      expect(optimized.parse('"hello"')).toEqual(['"', 'hello', '"']);
      expect(optimized.parse('123')).toBe(123);
      expect(optimized.parse('true')).toBe('true');
    });

    it('should optimize expression grammar', () => {
      const identifier = regex(/[a-z]+/);
      const operator = choice([str('+'), str('-'), str('*'), str('/')]);
      
      const expression = choice([
        identifier,
        sequence([identifier, operator, identifier])
      ]);
      
      const analysis = analyzeParser(expression);
      const optimized = optimizeParser(expression);
      
      expect(analysis.complexity).toBeGreaterThan(1);
      expect(optimized.parse('x')).toBe('x');
      expect(optimized.parse('x+y')).toEqual(['x', '+', 'y']);
    });

    it('should handle SQL-like SELECT grammar', () => {
      const keyword = (word: string) => str(word.toUpperCase());
      const identifier = regex(/[a-zA-Z_][a-zA-Z0-9_]*/);
      
      const selectClause = sequence([
        keyword('SELECT'),
        regex(/\s+/),
        identifier
      ]);
      
      const fromClause = sequence([
        regex(/\s+/),
        keyword('FROM'),
        regex(/\s+/),
        identifier
      ]);
      
      const selectStatement = sequence([
        selectClause,
        fromClause
      ]);
      
      const analysis = analyzeParser(selectStatement);
      const optimized = optimizeParser(selectStatement);
      
      expect(analysis.nullable).toBe(false);
      expect(analysis.firstSet.has('S')).toBe(true);
      
      expect(optimized.parse('SELECT name FROM users')).toEqual([
        ['SELECT', ' ', 'name'],
        [' ', 'FROM', ' ', 'users']
      ]);
    });
  });
});
