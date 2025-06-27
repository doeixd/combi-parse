import { describe, it, expect, vi } from 'vitest';
import { 
  ParserTester, 
  differentialTest,
  TestResult,
  FuzzResult,
  DifferentialResult
} from '../../src/primitives/testing';
import { str, regex, choice, sequence, number, many } from '../../src/parser';

describe('Comprehensive Parser Testing Utilities', () => {
  describe('ParserTester', () => {
    describe('propertyTest', () => {
      it('should pass when all generated inputs satisfy the property', async () => {
        const parser = number;
        const tester = new ParserTester(parser);
        
        const generator = () => Math.floor(Math.random() * 1000).toString();
        const property = (input: string, result: number) => 
          typeof result === 'number' && !isNaN(result);
        
        const result = await tester.propertyTest(generator, property, 10);
        
        expect(result.passed).toBe(true);
        expect(result.failures).toEqual([]);
        expect(result.coverage).toBeDefined();
      });

      it('should fail when property is not satisfied', async () => {
        const parser = str('expected');
        const tester = new ParserTester(parser);
        
        const generator = () => 'unexpected';
        const property = (_input: string, _result: string) => false; // Always fails
        
        const result = await tester.propertyTest(generator, property, 5);
        
        expect(result.passed).toBe(false);
        expect(result.failures.length).toBeGreaterThan(0);
      });

      it('should handle parse failures in property testing', async () => {
        const parser = str('specific');
        const tester = new ParserTester(parser);
        
        const generator = () => 'random' + Math.random();
        const property = (_input: string, _result: string) => true;
        
        const result = await tester.propertyTest(generator, property, 5);
        
        expect(result.passed).toBe(false);
        expect(result.failures.length).toBeGreaterThan(0);
        result.failures.forEach(failure => {
          expect(failure.error).toBeTruthy();
        });
      });

      it('should work with complex parsers and properties', async () => {
        const jsonLikeParser = choice([
          str('{}').map(() => ({})),
          str('[]').map(() => []),
          str('null').map(() => null)
        ]);
        const tester = new ParserTester(jsonLikeParser);
        
        const generator = () => ['{}', '[]', 'null'][Math.floor(Math.random() * 3)];
        const property = (input: string, result: any) => {
          if (input === '{}') return typeof result === 'object' && result !== null && !Array.isArray(result);
          if (input === '[]') return Array.isArray(result);
          if (input === 'null') return result === null;
          return false;
        };
        
        const result = await tester.propertyTest(generator, property, 20);
        
        expect(result.passed).toBe(true);
      });

      it('should provide coverage information', async () => {
        const parser = str('test');
        const tester = new ParserTester(parser);
        
        const generator = () => 'test';
        const property = () => true;
        
        const result = await tester.propertyTest(generator, property, 3);
        
        expect(result.coverage).toBeDefined();
        expect(result.coverage.totalParsers).toBeGreaterThan(0);
        expect(result.coverage.coveredParsers).toBeGreaterThanOrEqual(0);
        expect(result.coverage.percentage).toBeGreaterThanOrEqual(0);
        expect(result.coverage.percentage).toBeLessThanOrEqual(100);
        expect(Array.isArray(result.coverage.uncovered)).toBe(true);
      });

      it('should handle property functions that throw', async () => {
        const parser = str('test');
        const tester = new ParserTester(parser);
        
        const generator = () => 'test';
        const property = () => { throw new Error('Property error'); };
        
        const result = await tester.propertyTest(generator, property, 3);
        
        expect(result.passed).toBe(false);
        expect(result.failures.length).toBe(3);
      });
    });

    describe('fuzz', () => {
      it('should generate test cases through mutation', async () => {
        const parser = choice([str('a'), str('b'), str('c')]);
        const tester = new ParserTester(parser);
        
        const result = await tester.fuzz({
          seeds: ['a', 'b'],
          iterations: 50
        });
        
        expect(result.corpus.length).toBeGreaterThan(0);
        expect(result.crashes).toBeDefined();
        expect(Array.isArray(result.corpus)).toBe(true);
        expect(Array.isArray(result.crashes)).toBe(true);
      });

      it('should discover crashes in parsers', async () => {
        const parser = str('specific');
        const tester = new ParserTester(parser);
        
        // Mock parser to throw unexpected errors
        const crashingParser = str('crash');
        crashingParser.parse = () => { throw new Error('Unexpected crash'); };
        const crashingTester = new ParserTester(crashingParser);
        
        const result = await crashingTester.fuzz({
          seeds: ['test'],
          iterations: 10
        });
        
        expect(result.crashes.length).toBeGreaterThan(0);
        result.crashes.forEach(crash => {
          expect(crash.input).toBeTruthy();
          expect(crash.error).toBeInstanceOf(Error);
        });
      });

      it('should use default options when none provided', async () => {
        const parser = str('test');
        const tester = new ParserTester(parser);
        
        const result = await tester.fuzz();
        
        expect(result).toBeDefined();
        expect(result.corpus).toBeDefined();
        expect(result.crashes).toBeDefined();
      });

      it('should build corpus of successful parses', async () => {
        const parser = choice([str('valid1'), str('valid2'), str('valid3')]);
        const tester = new ParserTester(parser);
        
        const result = await tester.fuzz({
          seeds: ['valid1', 'valid2'],
          iterations: 20
        });
        
        // Should include successful parses
        expect(result.corpus).toContain('valid1');
        expect(result.corpus).toContain('valid2');
      });

      it('should apply different mutation strategies', async () => {
        const parser = regex(/[abc]+/);
        const tester = new ParserTester(parser);
        
        const result = await tester.fuzz({
          seeds: ['abc'],
          iterations: 100
        });
        
        // Should have generated various mutations
        expect(result.corpus.length).toBeGreaterThan(1);
        
        // Check that mutations occurred (should have different lengths, etc.)
        const lengths = result.corpus.map(s => s.length);
        const uniqueLengths = new Set(lengths);
        expect(uniqueLengths.size).toBeGreaterThan(1);
      });

      it('should handle empty seeds array', async () => {
        const parser = str('test');
        const tester = new ParserTester(parser);
        
        const result = await tester.fuzz({
          seeds: [],
          iterations: 10
        });
        
        expect(result).toBeDefined();
        // Should still work with default empty string seed
      });

      it('should handle malformed inputs gracefully', async () => {
        const parser = number;
        const tester = new ParserTester(parser);
        
        const result = await tester.fuzz({
          seeds: ['not_a_number'],
          iterations: 20
        });
        
        // Should handle parse failures without crashing the fuzzer
        expect(result).toBeDefined();
      });
    });

    describe('calculateCoverage', () => {
      it('should provide coverage metrics', () => {
        const parser = str('test');
        const tester = new ParserTester(parser);
        
        const coverage = tester.calculateCoverage();
        
        expect(coverage.totalParsers).toBeGreaterThan(0);
        expect(coverage.coveredParsers).toBeGreaterThanOrEqual(0);
        expect(coverage.percentage).toBeGreaterThanOrEqual(0);
        expect(coverage.percentage).toBeLessThanOrEqual(100);
        expect(Array.isArray(coverage.uncovered)).toBe(true);
      });

      it('should handle complex parser structures', () => {
        const complexParser = sequence([
          str('start'),
          many(choice([str('a'), str('b'), str('c')])),
          str('end')
        ]);
        const tester = new ParserTester(complexParser);
        
        const coverage = tester.calculateCoverage();
        
        expect(coverage).toBeDefined();
        expect(typeof coverage.totalParsers).toBe('number');
        expect(typeof coverage.coveredParsers).toBe('number');
        expect(typeof coverage.percentage).toBe('number');
      });
    });
  });

  describe('differentialTest', () => {
    it('should find no differences when parsers are equivalent', async () => {
      const parser1 = str('test');
      const parser2 = str('test');
      
      const result = await differentialTest(parser1, parser2, ['test', 'other']);
      
      expect(result.differences).toEqual([]);
    });

    it('should find differences when parsers produce different results', async () => {
      const parser1 = str('test').map(() => 'result1');
      const parser2 = str('test').map(() => 'result2');
      
      const result = await differentialTest(parser1, parser2, ['test']);
      
      expect(result.differences.length).toBe(1);
      expect(result.differences[0].input).toBe('test');
      expect(result.differences[0].result1).toBe('result1');
      expect(result.differences[0].result2).toBe('result2');
    });

    it('should handle cases where one parser fails and other succeeds', async () => {
      const parser1 = str('success');
      const parser2 = str('failure');
      
      const result = await differentialTest(parser1, parser2, ['success']);
      
      expect(result.differences.length).toBe(1);
      expect(result.differences[0].result1).toBe('success');
      expect(result.differences[0].result2).toBeInstanceOf(Error);
    });

    it('should handle cases where both parsers fail differently', async () => {
      const parser1 = str('expected1');
      const parser2 = str('expected2');
      
      const result = await differentialTest(parser1, parser2, ['different']);
      
      expect(result.differences.length).toBe(1);
      expect(result.differences[0].result1).toBeInstanceOf(Error);
      expect(result.differences[0].result2).toBeInstanceOf(Error);
    });

    it('should work with complex parsers', async () => {
      const jsonParser1 = choice([
        str('{}').map(() => ({})),
        str('[]').map(() => [])
      ]);
      
      const jsonParser2 = choice([
        str('{}').map(() => ({ type: 'object' })),
        str('[]').map(() => ({ type: 'array' }))
      ]);
      
      const result = await differentialTest(jsonParser1, jsonParser2, ['{}', '[]']);
      
      expect(result.differences.length).toBe(2);
    });

    it('should handle empty input array', async () => {
      const parser1 = str('test');
      const parser2 = str('test');
      
      const result = await differentialTest(parser1, parser2, []);
      
      expect(result.differences).toEqual([]);
    });

    it('should handle large numbers of test inputs', async () => {
      const parser1 = regex(/\d+/).map(Number);
      const parser2 = regex(/\d+/).map(Number);
      
      const inputs = Array.from({ length: 100 }, (_, i) => i.toString());
      const result = await differentialTest(parser1, parser2, inputs);
      
      expect(result.differences).toEqual([]);
    });

    it('should handle parsers with different error behaviors', async () => {
      const strictParser = str('exact');
      const lenientParser = regex(/exa.*/).map(() => 'exact');
      
      const result = await differentialTest(strictParser, lenientParser, ['exact', 'example']);
      
      expect(result.differences.length).toBe(1);
      expect(result.differences[0].input).toBe('example');
    });
  });

  describe('integration scenarios', () => {
    it('should test JSON parser comprehensively', async () => {
      const jsonParser = choice([
        str('{}').map(() => ({})),
        str('[]').map(() => []),
        str('null').map(() => null),
        str('true').map(() => true),
        str('false').map(() => false),
        regex(/\d+/).map(Number)
      ]);
      
      const tester = new ParserTester(jsonParser);
      
      // Property-based testing
      const propertyResult = await tester.propertyTest(
        () => ['{}', '[]', 'null', 'true', 'false', '123'][Math.floor(Math.random() * 6)],
        (input, result) => {
          if (input === '{}') return typeof result === 'object' && result !== null && !Array.isArray(result);
          if (input === '[]') return Array.isArray(result);
          if (input === 'null') return result === null;
          if (input === 'true') return result === true;
          if (input === 'false') return result === false;
          if (/^\d+$/.test(input)) return typeof result === 'number';
          return false;
        },
        50
      );
      
      expect(propertyResult.passed).toBe(true);
      
      // Fuzzing
      const fuzzResult = await tester.fuzz({
        seeds: ['{}', '[]', 'null', 'true', 'false', '123'],
        iterations: 100
      });
      
      expect(fuzzResult.corpus.length).toBeGreaterThan(0);
    });

    it('should test arithmetic expression parser', async () => {
      const numberParser = regex(/\d+/).map(Number);
      const operatorParser = choice([str('+'), str('-'), str('*'), str('/')]);
      const exprParser = sequence([
        numberParser,
        str(' '),
        operatorParser,
        str(' '),
        numberParser
      ], ([left, , op, , right]) => ({ left, operator: op, right }));
      
      const tester = new ParserTester(exprParser);
      
      const generator = () => {
        const left = Math.floor(Math.random() * 100);
        const ops = ['+', '-', '*', '/'];
        const op = ops[Math.floor(Math.random() * ops.length)];
        const right = Math.floor(Math.random() * 100);
        return `${left} ${op} ${right}`;
      };
      
      const property = (input: string, result: any) => {
        return typeof result === 'object' && 
               typeof result.left === 'number' && 
               typeof result.operator === 'string' &&
               typeof result.right === 'number';
      };
      
      const result = await tester.propertyTest(generator, property, 30);
      expect(result.passed).toBe(true);
    });

    it('should compare optimized vs reference implementations', async () => {
      const referenceParser = sequence([str('a'), str('b'), str('c')]);
      const optimizedParser = str('abc').map(() => ['a', 'b', 'c']); // Optimized version
      
      const testInputs = ['abc', 'invalid', '', 'abcd'];
      const result = await differentialTest(referenceParser, optimizedParser, testInputs);
      
      // Should find differences due to different return types
      expect(result.differences.length).toBeGreaterThan(0);
    });

    it('should handle fuzzing of configuration parsers', async () => {
      const configParser = sequence([
        regex(/[a-z_]+/),
        str('='),
        regex(/[^\n]+/)
      ], ([key, , value]) => ({ key, value }));
      
      const tester = new ParserTester(configParser);
      
      const fuzzResult = await tester.fuzz({
        seeds: ['key=value', 'host=localhost', 'port=3000'],
        iterations: 50
      });
      
      expect(fuzzResult.corpus.length).toBeGreaterThan(0);
      fuzzResult.corpus.forEach(input => {
        if (configParser.parse) {
          try {
            const result = configParser.parse(input);
            expect(result).toHaveProperty('key');
            expect(result).toHaveProperty('value');
          } catch {
            // Parse failures are acceptable in fuzzing
          }
        }
      });
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle parsers that always fail', async () => {
      const alwaysFailParser = str('impossible');
      const tester = new ParserTester(alwaysFailParser);
      
      const result = await tester.propertyTest(
        () => 'anything',
        () => true,
        5
      );
      
      expect(result.passed).toBe(false);
      expect(result.failures.length).toBe(5);
    });

    it('should handle parsers that throw unexpected errors', async () => {
      const crashingParser = str('test');
      crashingParser.parse = () => { throw new TypeError('Unexpected error'); };
      
      const tester = new ParserTester(crashingParser);
      
      const fuzzResult = await tester.fuzz({ iterations: 5 });
      expect(fuzzResult.crashes.length).toBeGreaterThan(0);
    });

    it('should handle very long inputs in fuzzing', async () => {
      const parser = regex(/.*/);
      const tester = new ParserTester(parser);
      
      const result = await tester.fuzz({
        seeds: ['x'.repeat(1000)],
        iterations: 10
      });
      
      expect(result).toBeDefined();
      expect(result.corpus.length).toBeGreaterThan(0);
    });

    it('should handle generators that throw errors', async () => {
      const parser = str('test');
      const tester = new ParserTester(parser);
      
      const faultyGenerator = () => { throw new Error('Generator error'); };
      
      await expect(tester.propertyTest(faultyGenerator, () => true, 5))
        .rejects.toThrow('Generator error');
    });

    it('should handle differential testing with parsers that have side effects', async () => {
      let sideEffect1 = 0;
      let sideEffect2 = 0;
      
      const parser1 = str('test').map(result => { sideEffect1++; return result; });
      const parser2 = str('test').map(result => { sideEffect2++; return result; });
      
      const result = await differentialTest(parser1, parser2, ['test', 'fail']);
      
      expect(sideEffect1).toBeGreaterThan(0);
      expect(sideEffect2).toBeGreaterThan(0);
      expect(result.differences).toEqual([]); // Should be equivalent despite side effects
    });

    it('should handle empty and null inputs gracefully', async () => {
      const parser = regex(/.*/);
      const tester = new ParserTester(parser);
      
      const result = await tester.propertyTest(
        () => '',
        (input, result) => typeof result === 'string',
        5
      );
      
      expect(result.passed).toBe(true);
    });
  });

  describe('performance and scalability', () => {
    it('should handle large-scale property testing', async () => {
      const parser = regex(/\d+/).map(Number);
      const tester = new ParserTester(parser);
      
      const start = performance.now();
      const result = await tester.propertyTest(
        () => Math.floor(Math.random() * 1000).toString(),
        (input, result) => typeof result === 'number',
        1000
      );
      const end = performance.now();
      
      expect(result.passed).toBe(true);
      expect(end - start).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle intensive fuzzing sessions', async () => {
      const parser = choice([str('a'), str('b'), str('c')]);
      const tester = new ParserTester(parser);
      
      const start = performance.now();
      const result = await tester.fuzz({
        seeds: ['a', 'b', 'c'],
        iterations: 1000
      });
      const end = performance.now();
      
      expect(result.corpus.length).toBeGreaterThan(0);
      expect(end - start).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });
});
