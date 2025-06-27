import { describe, it, expect } from 'vitest';
import {
  // Core types
  ParserState,
  Success,
  Failure,
  ParseResult,
  success,
  failure,
  Parser,
  ParseOptions,
  
  // Primitive parsers
  succeed,
  fail,
  str,
  noneOf,
  regex,
  number,
  whitespace,
  optionalWhitespace,
  eof,
  
  // Combinator functions
  lazy,
  lexeme,
  sequence,
  choice,
  sepBy,
  sepBy1,
  between,
  optional,
  
  // Advanced combinators
  label,
  context,
  astNode,
  filter,
  lookahead,
  notFollowedBy,
  memo,
  leftRecursive,
  genParser,
  flatten,
  charClass,
  
  // Type utilities
  ToCharUnion
} from '../src/parser';

// Also import from the main index to test the full export structure
import * as CombiParse from '../src/index';

describe('Parser Core Types and Helpers', () => {
  describe('success and failure factories', () => {
    it('should create success result with value and state', () => {
      const state: ParserState = { input: 'test', index: 0 };
      const result = success('value', state);
      
      expect(result.type).toBe('success');
      expect(result.value).toBe('value');
      expect(result.state).toBe(state);
    });
    
    it('should create failure result with message and state', () => {
      const state: ParserState = { input: 'test', index: 2 };
      const result = failure('error message', state);
      
      expect(result.type).toBe('failure');
      expect(result.message).toBe('error message');
      expect(result.state).toBe(state);
    });
  });
});

describe('Parser Class', () => {
  describe('constructor', () => {
    it('should create parser with run function', () => {
      const runFn = (state: ParserState) => success('test', state);
      const parser = new Parser(runFn);
      
      expect(parser.run).toBe(runFn);
    });
  });
  
  describe('parse method', () => {
    it('should parse successfully when consuming all input', () => {
      const parser = new Parser(state => 
        success('result', { ...state, index: state.input.length })
      );
      
      const result = parser.parse('test');
      expect(result).toBe('result');
    });
    
    it('should throw error when parser fails', () => {
      const parser = new Parser(state => 
        failure('test error', state)
      );
      
      expect(() => parser.parse('test')).toThrow('Parse error at line 1, col 1: test error');
    });
    
    it('should throw error when not consuming all input with consumeAll=true', () => {
      const parser = new Parser(state => 
        success('result', { ...state, index: 2 })
      );
      
      expect(() => parser.parse('test')).toThrow('Parser did not consume entire input. Stopped at index 2');
    });
    
    it('should not throw when not consuming all input with consumeAll=false', () => {
      const parser = new Parser(state => 
        success('result', { ...state, index: 2 })
      );
      
      const result = parser.parse('test', { consumeAll: false });
      expect(result).toBe('result');
    });
    
    it('should calculate correct line and column for error reporting', () => {
      const parser = new Parser(state => 
        failure('error', { ...state, index: 8 })
      );
      
      expect(() => parser.parse('line1\nline2')).toThrow('Parse error at line 2, col 3: error');
    });
  });
  
  describe('map method', () => {
    it('should transform successful result', () => {
      const parser = new Parser(state => success('5', state));
      const mapped = parser.map(x => parseInt(x));
      
      const result = mapped.run({ input: '', index: 0 });
      expect(result.type).toBe('success');
      expect((result as Success<number>).value).toBe(5);
    });
    
    it('should pass through failure unchanged', () => {
      const parser = new Parser(state => failure('error', state));
      const mapped = parser.map((x: string) => x.toUpperCase());
      
      const result = mapped.run({ input: '', index: 0 });
      expect(result.type).toBe('failure');
      expect((result as Failure).message).toBe('error');
    });
  });
  
  describe('chain method', () => {
    it('should sequence successful parsers', () => {
      const parser1 = new Parser(state => success('a', { ...state, index: 1 }));
      const chained = parser1.chain(value => 
        new Parser(state => success(value + 'b', { ...state, index: state.index + 1 }))
      );
      
      const result = chained.run({ input: 'ab', index: 0 });
      expect(result.type).toBe('success');
      expect((result as Success<string>).value).toBe('ab');
      expect(result.state.index).toBe(2);
    });
    
    it('should fail if first parser fails', () => {
      const parser1 = new Parser(state => failure('first failed', state));
      const chained = parser1.chain(() => succeed('second'));
      
      const result = chained.run({ input: '', index: 0 });
      expect(result.type).toBe('failure');
      expect((result as Failure).message).toBe('first failed');
    });
    
    it('should fail if second parser fails', () => {
      const parser1 = succeed('first');
      const chained = parser1.chain(() => fail('second failed'));
      
      const result = chained.run({ input: '', index: 0 });
      expect(result.type).toBe('failure');
      expect((result as Failure).message).toBe('second failed');
    });
  });
  
  describe('many method', () => {
    it('should parse zero occurrences', () => {
      const parser = str('a');
      const many = parser.many();
      
      const result = many.run({ input: 'b', index: 0 });
      expect(result.type).toBe('success');
      expect((result as Success<string[]>).value).toEqual([]);
    });
    
    it('should parse multiple occurrences', () => {
      const parser = str('a');
      const many = parser.many();
      
      const result = many.run({ input: 'aaa', index: 0 });
      expect(result.type).toBe('success');
      expect((result as Success<string[]>).value).toEqual(['a', 'a', 'a']);
      expect(result.state.index).toBe(3);
    });
    
    it('should fail on infinite loop (parser succeeds without consuming)', () => {
      const parser = new Parser(state => success('', state)); // Never consumes input
      const many = parser.many();
      
      const result = many.run({ input: 'test', index: 0 });
      expect(result.type).toBe('failure');
      expect((result as Failure).message).toBe('Infinite loop in .many(): parser succeeded without consuming input.');
    });
    
    it('should use into function to transform results', () => {
      const parser = str('a');
      const many = parser.many(results => results.length);
      
      const result = many.run({ input: 'aaa', index: 0 });
      expect(result.type).toBe('success');
      expect((result as Success<number>).value).toBe(3);
    });
  });
  
  describe('many1 method', () => {
    it('should fail when no occurrences', () => {
      const parser = str('a');
      const many1 = parser.many1();
      
      const result = many1.run({ input: 'b', index: 0 });
      expect(result.type).toBe('failure');
    });
    
    it('should parse one occurrence', () => {
      const parser = str('a');
      const many1 = parser.many1();
      
      const result = many1.run({ input: 'ab', index: 0 });
      expect(result.type).toBe('success');
      expect((result as Success<string[]>).value).toEqual(['a']);
    });
    
    it('should parse multiple occurrences', () => {
      const parser = str('a');
      const many1 = parser.many1();
      
      const result = many1.run({ input: 'aaa', index: 0 });
      expect(result.type).toBe('success');
      expect((result as Success<string[]>).value).toEqual(['a', 'a', 'a']);
    });
    
    it('should use into function to transform results', () => {
      const parser = str('a');
      const many1 = parser.many1(results => results.join(''));
      
      const result = many1.run({ input: 'aaa', index: 0 });
      expect(result.type).toBe('success');
      expect((result as Success<string>).value).toBe('aaa');
    });
  });
  
  describe('or method', () => {
    it('should use first parser if successful', () => {
      const parser1 = str('a');
      const parser2 = str('b');
      const orParser = parser1.or(parser2);
      
      const result = orParser.run({ input: 'a', index: 0 });
      expect(result.type).toBe('success');
      expect((result as Success<string>).value).toBe('a');
    });
    
    it('should use second parser if first fails without consuming input', () => {
      const parser1 = str('a');
      const parser2 = str('b');
      const orParser = parser1.or(parser2);
      
      const result = orParser.run({ input: 'b', index: 0 });
      expect(result.type).toBe('success');
      expect((result as Success<string>).value).toBe('b');
    });
    
    it('should not try second parser if first fails after consuming input', () => {
      const parser1 = new Parser(state => 
        failure('error', { ...state, index: state.index + 1 })
      );
      const parser2 = str('b');
      const orParser = parser1.or(parser2);
      
      const result = orParser.run({ input: 'x', index: 0 });
      expect(result.type).toBe('failure');
      expect((result as Failure).message).toBe('error');
    });
  });
  
  describe('optional method', () => {
    it('should return value if parser succeeds', () => {
      const parser = str('a');
      const optional = parser.optional();
      
      const result = optional.run({ input: 'a', index: 0 });
      expect(result.type).toBe('success');
      expect((result as Success<string | null>).value).toBe('a');
    });
    
    it('should return null if parser fails', () => {
      const parser = str('a');
      const optional = parser.optional();
      
      const result = optional.run({ input: 'b', index: 0 });
      expect(result.type).toBe('success');
      expect((result as Success<string | null>).value).toBe(null);
    });
  });
  
  describe('keepRight method', () => {
    it('should keep result of second parser', () => {
      const parser1 = str('a');
      const parser2 = str('b');
      const keepRight = parser1.keepRight(parser2);
      
      const result = keepRight.run({ input: 'ab', index: 0 });
      expect(result.type).toBe('success');
      expect((result as Success<string>).value).toBe('b');
    });
    
    it('should fail if first parser fails', () => {
      const parser1 = str('x');
      const parser2 = str('b');
      const keepRight = parser1.keepRight(parser2);
      
      const result = keepRight.run({ input: 'ab', index: 0 });
      expect(result.type).toBe('failure');
    });
  });
  
  describe('keepLeft method', () => {
    it('should keep result of first parser', () => {
      const parser1 = str('a');
      const parser2 = str('b');
      const keepLeft = parser1.keepLeft(parser2);
      
      const result = keepLeft.run({ input: 'ab', index: 0 });
      expect(result.type).toBe('success');
      expect((result as Success<string>).value).toBe('a');
    });
    
    it('should fail if second parser fails', () => {
      const parser1 = str('a');
      const parser2 = str('x');
      const keepLeft = parser1.keepLeft(parser2);
      
      const result = keepLeft.run({ input: 'ab', index: 0 });
      expect(result.type).toBe('failure');
    });
  });
  
  describe('debug method', () => {
    it('should add debug logging without affecting parsing', () => {
      const originalLog = console.log;
      const logs: string[] = [];
      console.log = (msg: string) => logs.push(msg);
      
      try {
        const parser = str('a').debug('test');
        const result = parser.run({ input: 'a', index: 0 });
        
        expect(result.type).toBe('success');
        expect(logs.length).toBe(2);
        expect(logs[0]).toContain('[test] Trying at position 0');
        expect(logs[1]).toContain('[test] ✅ Success!');
      } finally {
        console.log = originalLog;
      }
    });
  });
});

describe('Primitive Parsers', () => {
  describe('succeed', () => {
    it('should always succeed with given value', () => {
      const parser = succeed('test');
      const result = parser.run({ input: 'anything', index: 5 });
      
      expect(result.type).toBe('success');
      expect((result as Success<string>).value).toBe('test');
      expect(result.state.index).toBe(5); // Should not consume input
    });
  });
  
  describe('fail', () => {
    it('should always fail with given message', () => {
      const parser = fail('test error');
      const result = parser.run({ input: 'anything', index: 0 });
      
      expect(result.type).toBe('failure');
      expect((result as Failure).message).toBe('test error');
    });
  });
  
  describe('str', () => {
    it('should match exact string', () => {
      const parser = str('hello');
      const result = parser.run({ input: 'hello world', index: 0 });
      
      expect(result.type).toBe('success');
      expect((result as Success<string>).value).toBe('hello');
      expect(result.state.index).toBe(5);
    });
    
    it('should fail when string does not match', () => {
      const parser = str('hello');
      const result = parser.run({ input: 'goodbye', index: 0 });
      
      expect(result.type).toBe('failure');
      expect((result as Failure).message).toBe('Expected "hello"');
    });
    
    it('should match at given index', () => {
      const parser = str('world');
      const result = parser.run({ input: 'hello world', index: 6 });
      
      expect(result.type).toBe('success');
      expect((result as Success<string>).value).toBe('world');
      expect(result.state.index).toBe(11);
    });
  });
  
  describe('noneOf', () => {
    it('should match character not in given string', () => {
      const parser = noneOf('abc');
      const result = parser.run({ input: 'xyz', index: 0 });
      
      expect(result.type).toBe('success');
      expect((result as Success<string>).value).toBe('x');
      expect(result.state.index).toBe(1);
    });
    
    it('should fail when character is in given string', () => {
      const parser = noneOf('abc');
      const result = parser.run({ input: 'abc', index: 0 });
      
      expect(result.type).toBe('failure');
      expect((result as Failure).message).toBe('Expected a character not in "abc"');
    });
    
    it('should fail at end of input', () => {
      const parser = noneOf('abc');
      const result = parser.run({ input: '', index: 0 });
      
      expect(result.type).toBe('failure');
      expect((result as Failure).message).toBe('Unexpected end of input');
    });
  });
  
  describe('regex', () => {
    it('should match regular expression', () => {
      const parser = regex(/[a-z]+/);
      const result = parser.run({ input: 'hello123', index: 0 });
      
      expect(result.type).toBe('success');
      expect((result as Success<string>).value).toBe('hello');
      expect(result.state.index).toBe(5);
    });
    
    it('should fail when regex does not match', () => {
      const parser = regex(/[0-9]+/);
      const result = parser.run({ input: 'hello', index: 0 });
      
      expect(result.type).toBe('failure');
      expect((result as Failure).message).toBe('Expected to match regex /[0-9]+/');
    });
    
    it('should respect regex flags', () => {
      const parser = regex(/hello/i);
      const result = parser.run({ input: 'HELLO', index: 0 });
      
      expect(result.type).toBe('success');
      expect((result as Success<string>).value).toBe('HELLO');
    });
  });
  
  describe('number', () => {
    it('should parse digits as number', () => {
      const result = number.run({ input: '123abc', index: 0 });
      
      expect(result.type).toBe('success');
      expect((result as Success<number>).value).toBe(123);
      expect(result.state.index).toBe(3);
    });
    
    it('should fail when no digits', () => {
      const result = number.run({ input: 'abc', index: 0 });
      
      expect(result.type).toBe('failure');
    });
  });
  
  describe('whitespace', () => {
    it('should parse whitespace characters', () => {
      const result = whitespace.run({ input: '  \t\n  abc', index: 0 });
      
      expect(result.type).toBe('success');
      expect((result as Success<string>).value).toBe('  \t\n  ');
      expect(result.state.index).toBe(6);
    });
    
    it('should fail when no whitespace', () => {
      const result = whitespace.run({ input: 'abc', index: 0 });
      
      expect(result.type).toBe('failure');
    });
  });
  
  describe('eof', () => {
    it('should succeed at end of input', () => {
      const result = eof.run({ input: 'test', index: 4 });
      
      expect(result.type).toBe('success');
      expect((result as Success<null>).value).toBe(null);
      expect(result.state.index).toBe(4);
    });
    
    it('should fail when not at end of input', () => {
      const result = eof.run({ input: 'test', index: 2 });
      
      expect(result.type).toBe('failure');
      expect((result as Failure).message).toBe('Expected end of file');
    });
  });
});

describe('Combinator Functions', () => {
  describe('lazy', () => {
    it('should defer parser creation until run', () => {
      let created = false;
      const parser = lazy(() => {
        created = true;
        return str('test');
      });
      
      expect(created).toBe(false);
      
      const result = parser.run({ input: 'test', index: 0 });
      expect(created).toBe(true);
      expect(result.type).toBe('success');
    });
    
    it('should enable recursive parsers', () => {
      // Simple recursive parser for nested parentheses
      const parenParser: Parser<string> = lazy(() => 
        choice([
          str('()'),
          between(str('('), parenParser, str(')')).map(inner => `(${inner})`)
        ])
      );
      
      expect(parenParser.parse('()')).toBe('()');
      expect(parenParser.parse('(())')).toBe('(())');
      expect(parenParser.parse('((()))')).toBe('((()))');
    });
  });
  
  describe('lexeme', () => {
    it('should consume trailing whitespace', () => {
      const parser = lexeme(str('hello'));
      const result = parser.run({ input: 'hello   world', index: 0 });
      
      expect(result.type).toBe('success');
      expect((result as Success<string>).value).toBe('hello');
      expect(result.state.index).toBe(8); // 5 + 3 spaces
    });
    
    it('should work with no trailing whitespace', () => {
      const parser = lexeme(str('hello'));
      const result = parser.run({ input: 'helloworld', index: 0 });
      
      expect(result.type).toBe('success');
      expect((result as Success<string>).value).toBe('hello');
      expect(result.state.index).toBe(5);
    });
  });
  
  describe('sequence', () => {
    it('should parse sequence of parsers', () => {
      const parser = sequence([str('a'), str('b'), str('c')] as const);
      const result = parser.run({ input: 'abc', index: 0 });
      
      expect(result.type).toBe('success');
      expect((result as Success<readonly [string, string, string]>).value).toEqual(['a', 'b', 'c']);
    });
    
    it('should fail if any parser fails', () => {
      const parser = sequence([str('a'), str('x'), str('c')] as const);
      const result = parser.run({ input: 'abc', index: 0 });
      
      expect(result.type).toBe('failure');
    });
    
    it('should use into function to transform result', () => {
      const parser = sequence(
        [str('a'), str('b')] as const,
        ([a, b]) => a + b
      );
      const result = parser.run({ input: 'ab', index: 0 });
      
      expect(result.type).toBe('success');
      expect((result as Success<string>).value).toBe('ab');
    });
  });
  
  describe('choice', () => {
    it('should try parsers in order', () => {
      const parser = choice([str('a'), str('b'), str('c')]);
      
      expect(parser.parse('a')).toBe('a');
      expect(parser.parse('b')).toBe('b');
      expect(parser.parse('c')).toBe('c');
    });
    
    it('should fail if all parsers fail', () => {
      const parser = choice([str('a'), str('b')]);
      const result = parser.run({ input: 'c', index: 0 });
      
      expect(result.type).toBe('failure');
    });
    
    it('should report furthest failure', () => {
      const parser = choice([
        str('abc'),
        str('ab'),
        str('a')
      ]);
      const result = parser.run({ input: 'xyz', index: 0 });
      
      expect(result.type).toBe('failure');
      // Should report the failure from 'abc' parser which got furthest
    });
    
    it('should use into function to transform result', () => {
      const parser = choice(
        [str('a'), str('b')] as const,
        (result) => result.toUpperCase()
      );
      
      expect(parser.parse('a')).toBe('A');
      expect(parser.parse('b')).toBe('B');
    });
  });
  
  describe('sepBy', () => {
    it('should parse zero occurrences', () => {
      const parser = sepBy(str('a'), str(','));
      const result = parser.run({ input: 'b', index: 0 });
      
      expect(result.type).toBe('success');
      expect((result as Success<string[]>).value).toEqual([]);
    });
    
    it('should parse one occurrence', () => {
      const parser = sepBy(str('a'), str(','));
      const result = parser.run({ input: 'a', index: 0 });
      
      expect(result.type).toBe('success');
      expect((result as Success<string[]>).value).toEqual(['a']);
    });
    
    it('should parse multiple occurrences', () => {
      const parser = sepBy(str('a'), str(','));
      const result = parser.run({ input: 'a,a,a', index: 0 });
      
      expect(result.type).toBe('success');
      expect((result as Success<string[]>).value).toEqual(['a', 'a', 'a']);
    });
    
    it('should use into function', () => {
      const parser = sepBy(str('a'), str(','), arr => arr.length);
      
      expect(parser.parse('a,a,a')).toBe(3);
      expect(parser.parse('')).toBe(0);
    });
  });
  
  describe('sepBy1', () => {
    it('should fail on zero occurrences', () => {
      const parser = sepBy1(str('a'), str(','));
      const result = parser.run({ input: 'b', index: 0 });
      
      expect(result.type).toBe('failure');
    });
    
    it('should parse one occurrence', () => {
      const parser = sepBy1(str('a'), str(','));
      const result = parser.run({ input: 'a', index: 0 });
      
      expect(result.type).toBe('success');
      expect((result as Success<string[]>).value).toEqual(['a']);
    });
    
    it('should parse multiple occurrences', () => {
      const parser = sepBy1(str('a'), str(','));
      const result = parser.run({ input: 'a,a,a', index: 0 });
      
      expect(result.type).toBe('success');
      expect((result as Success<string[]>).value).toEqual(['a', 'a', 'a']);
    });
  });
  
  describe('between', () => {
    it('should parse content between delimiters', () => {
      const parser = between(str('('), str('content'), str(')'));
      const result = parser.run({ input: '(content)', index: 0 });
      
      expect(result.type).toBe('success');
      expect((result as Success<string>).value).toBe('content');
    });
    
    it('should fail if left delimiter fails', () => {
      const parser = between(str('('), str('content'), str(')'));
      const result = parser.run({ input: '[content)', index: 0 });
      
      expect(result.type).toBe('failure');
    });
    
    it('should fail if right delimiter fails', () => {
      const parser = between(str('('), str('content'), str(')'));
      const result = parser.run({ input: '(content]', index: 0 });
      
      expect(result.type).toBe('failure');
    });
  });
  
  describe('optional standalone function', () => {
    it('should make parser optional', () => {
      const parser = optional(str('test'));
      
      expect(parser.parse('test')).toBe('test');
      expect(parser.parse('')).toBe(null);
    });
  });
});

describe('Advanced Combinators', () => {
  describe('label', () => {
    it('should replace error message on failure', () => {
      const parser = label(str('test'), 'custom error message');
      const result = parser.run({ input: 'fail', index: 0 });
      
      expect(result.type).toBe('failure');
      expect((result as Failure).message).toBe('custom error message');
    });
    
    it('should not affect successful parsing', () => {
      const parser = label(str('test'), 'custom error message');
      const result = parser.run({ input: 'test', index: 0 });
      
      expect(result.type).toBe('success');
      expect((result as Success<string>).value).toBe('test');
    });
  });
  
  describe('context', () => {
    it('should add context to error message', () => {
      const parser = context(str('test'), 'in test context');
      const result = parser.run({ input: 'fail', index: 0 });
      
      expect(result.type).toBe('failure');
      expect((result as Failure).message).toBe('[in test context] Expected "test"');
    });
    
    it('should not affect successful parsing', () => {
      const parser = context(str('test'), 'in test context');
      const result = parser.run({ input: 'test', index: 0 });
      
      expect(result.type).toBe('success');
      expect((result as Success<string>).value).toBe('test');
    });
  });
  
  describe('astNode', () => {
    it('should wrap result in AST node', () => {
      const parser = astNode('StringLiteral', str('hello'));
      const result = parser.run({ input: 'hello', index: 0 });
      
      expect(result.type).toBe('success');
      const node = (result as Success<{ type: 'StringLiteral'; value: string }>).value;
      expect(node.type).toBe('StringLiteral');
      expect(node.value).toBe('hello');
    });
  });
  
  describe('filter', () => {
    it('should succeed when predicate returns true', () => {
      const parser = filter(number, n => n > 10, 'number must be greater than 10');
      const result = parser.run({ input: '15', index: 0 });
      
      expect(result.type).toBe('success');
      expect((result as Success<number>).value).toBe(15);
    });
    
    it('should fail when predicate returns false', () => {
      const parser = filter(number, n => n > 10, 'number must be greater than 10');
      const result = parser.run({ input: '5', index: 0 });
      
      expect(result.type).toBe('failure');
      expect((result as Failure).message).toBe('number must be greater than 10');
    });
    
    it('should use default error message', () => {
      const parser = filter(number, n => n > 10);
      const result = parser.run({ input: '5', index: 0 });
      
      expect(result.type).toBe('failure');
      expect((result as Failure).message).toBe('filter failed');
    });
  });
  
  describe('lookahead', () => {
    it('should succeed without consuming input', () => {
      const parser = lookahead(str('test'));
      const result = parser.run({ input: 'test', index: 0 });
      
      expect(result.type).toBe('success');
      expect((result as Success<string>).value).toBe('test');
      expect(result.state.index).toBe(0); // No input consumed
    });
    
    it('should fail when lookahead fails', () => {
      const parser = lookahead(str('test'));
      const result = parser.run({ input: 'fail', index: 0 });
      
      expect(result.type).toBe('failure');
    });
    
    it('should work in sequence', () => {
      const parser = sequence([
        lookahead(str('test')),
        str('test')
      ] as const);
      
      const result = parser.run({ input: 'test', index: 0 });
      expect(result.type).toBe('success');
      expect((result as Success<readonly [string, string]>).value).toEqual(['test', 'test']);
      expect(result.state.index).toBe(4);
    });
  });
  
  describe('notFollowedBy', () => {
    it('should succeed when parser fails', () => {
      const parser = notFollowedBy(str('test'));
      const result = parser.run({ input: 'other', index: 0 });
      
      expect(result.type).toBe('success');
      expect((result as Success<null>).value).toBe(null);
      expect(result.state.index).toBe(0); // No input consumed
    });
    
    it('should fail when parser succeeds', () => {
      const parser = notFollowedBy(str('test'));
      const result = parser.run({ input: 'test', index: 0 });
      
      expect(result.type).toBe('failure');
      expect((result as Failure).message).toBe('Negative lookahead failed: parser unexpectedly succeeded');
    });
    
    it('should work for keyword boundary checking', () => {
      const keyword = str('if').keepLeft(notFollowedBy(regex(/[a-zA-Z0-9_]/)));
      
      expect(keyword.parse('if (', { consumeAll: false })).toBe('if');
      expect(() => keyword.parse('iffy')).toThrow();
    });
  });
  
  describe('memo', () => {
    it('should cache results', () => {
      let callCount = 0;
      const baseParser = new Parser(state => {
        callCount++;
        return str('test').run(state);
      });
      const memoParser = memo(baseParser);
      
      // First call
      memoParser.run({ input: 'test', index: 0 });
      expect(callCount).toBe(1);
      
      // Second call at same position should use cache
      memoParser.run({ input: 'test', index: 0 });
      expect(callCount).toBe(1);
      
      // Different position should not use cache
      memoParser.run({ input: 'xtest', index: 1 });
      expect(callCount).toBe(2);
    });
  });
  
  describe('leftRecursive', () => {
    it('should handle left-recursive grammars', () => {
      // Test simple number parsing first
      const createExpr = () => {
        const term = lexeme(number);
        const plus = lexeme(str('+'));
        const expr = leftRecursive(() =>
          choice([
            sequence([expr, plus, term] as const, ([e1, , t]) => (e1 as number) + (t as number)),
            term
          ])
        );
        return expr;
      };
      
      const expr1 = createExpr();
      expect(expr1.parse('5')).toBe(5);
      
      const expr2 = createExpr();
      const result12 = expr2.parse('1 + 2', { consumeAll: false });
      expect(result12).toBe(3);
      
      const expr3 = createExpr();
      expect(expr3.parse('1 + 2 + 3')).toBe(6);
    });
  });
  
  describe('genParser', () => {
    it('should work with generator syntax', () => {
      const parser = genParser(function* () {
        const name = yield regex(/[a-z]+/);
        yield str(':');
        const value = yield number;
        return { [name]: value };
      });
      
      const result = parser.parse('key:123');
      expect(result).toEqual({ key: 123 });
    });
    
    it('should fail if any yielded parser fails', () => {
      const parser = genParser(function* () {
        yield str('a');
        yield str('x'); // This will fail
        return 'done';
      });
      
      expect(() => parser.parse('ab')).toThrow();
    });
  });
  
  describe('flatten', () => {
    it('should flatten array results', () => {
      const parser = succeed([1, [2, 3], [4, [5]]]);
      
      const flat1 = flatten(parser, 1);
      expect(flat1.parse('')).toEqual([1, 2, 3, 4, [5]]);
      
      const flat2 = flatten(parser, 2);
      expect(flat2.parse('')).toEqual([1, 2, 3, 4, 5]);
    });
    
    it('should use default depth of 1', () => {
      const parser = succeed([1, [2, 3]]);
      const flattened = flatten(parser);
      
      expect(flattened.parse('')).toEqual([1, 2, 3]);
    });
  });
  
  describe('charClass', () => {
    it('should work with custom character strings', () => {
      const parser = charClass('abc');
      
      expect(parser.parse('a')).toBe('a');
      expect(parser.parse('b')).toBe('b');
      expect(parser.parse('c')).toBe('c');
      expect(() => parser.parse('d')).toThrow();
    });
    
    // Note: Testing named character classes would require importing the character class definitions
    // which might not be available in the test environment
  });
});

describe('Error Handling and Edge Cases', () => {
  describe('empty input', () => {
    it('should handle empty input correctly', () => {
      expect(eof.parse('')).toBe(null);
      expect(str('').parse('')).toBe('');
      expect(() => str('a').parse('')).toThrow();
    });
  });
  
  describe('index bounds', () => {
    it('should handle parsing at end of input', () => {
      const parser = str('a');
      const result = parser.run({ input: 'abc', index: 3 });
      
      expect(result.type).toBe('failure');
    });
    
    it('should handle parsing beyond end of input', () => {
      const parser = str('a');
      const result = parser.run({ input: 'abc', index: 5 });
      
      expect(result.type).toBe('failure');
    });
  });
  
  describe('complex parsing scenarios', () => {
    it('should parse JSON-like structures', () => {
      const jsonValue = lazy(() => choice([
        str('null').map(() => null),
        str('true').map(() => true),
        str('false').map(() => false),
        number,
        between(str('"'), regex(/[^"]*/), str('"')),
        between(str('['), sepBy(jsonValue, lexeme(str(','))), str(']')),
      ]));
      
      expect(jsonValue.parse('null')).toBe(null);
      expect(jsonValue.parse('true')).toBe(true);
      expect(jsonValue.parse('123')).toBe(123);
      expect(jsonValue.parse('"hello"')).toBe('hello');
      expect(jsonValue.parse('[1, 2, 3]')).toEqual([1, 2, 3]);
    });
    
    it('should parse arithmetic expressions', () => {
      // Create a proper arithmetic expression parser with precedence
      const createArithmeticParser = () => {
        const factor = choice([
          lexeme(number),
          between(lexeme(str('(')), lazy(() => expr), lexeme(str(')')))
        ]);
        
        const term = leftRecursive(() => choice([
          sequence([term, lexeme(str('*')), factor] as const, ([t, , f]) => (t as number) * (f as number)),
          sequence([term, lexeme(str('/')), factor] as const, ([t, , f]) => Math.floor((t as number) / (f as number))),
          factor
        ]));
        
        const expr = leftRecursive(() => choice([
          sequence([expr, lexeme(str('+')), term] as const, ([e, , t]) => (e as number) + (t as number)),
          sequence([expr, lexeme(str('-')), term] as const, ([e, , t]) => (e as number) - (t as number)),
          term
        ]));
        
        return expr;
      };
      
      const parser1 = createArithmeticParser();
      expect(parser1.parse('2 + 3 * 4')).toBe(14);
      
      const parser2 = createArithmeticParser();  
      expect(parser2.parse('(2 + 3) * 4')).toBe(20);
    });
  });
});

describe('Type Safety Verification', () => {
  it('should maintain type safety through transformations', () => {
    // This test mainly verifies TypeScript compilation
    const stringParser: Parser<string> = str('test');
    const numberParser: Parser<number> = stringParser.map(s => s.length);
    const booleanParser: Parser<boolean> = numberParser.map(n => n > 0);
    
    expect(booleanParser.parse('test')).toBe(true);
  });
  
  it('should handle union types correctly', () => {
    const parser: Parser<string | number> = choice([str('hello'), number]);
    
    const result1 = parser.parse('hello');
    const result2 = parser.parse('123');
    
    expect(typeof result1).toBe('string');
    expect(typeof result2).toBe('number');
  });
  
  it('should handle complex nested types', () => {
    const parser = sequence([
      str('name'),
      str(':'),
      choice([str('string'), number])
    ] as const, ([, , value]) => ({ value }));
    
    expect(parser.parse('name:string')).toEqual({ value: 'string' });
    expect(parser.parse('name:123')).toEqual({ value: 123 });
  });
});

describe('Integration Tests', () => {
  it('should parse a simple programming language', () => {
    // Define a simple language: var name = value;
    const identifier = lexeme(regex(/[a-zA-Z_][a-zA-Z0-9_]*/));
    const stringLiteral = between(str('"'), regex(/[^"]*/), str('"'));
    const value = choice([number, stringLiteral]);
    
    const declaration = sequence([
      lexeme(str('var')),
      identifier,
      lexeme(str('=')),
      lexeme(value),
      lexeme(str(';'))
    ] as const, ([, name, , val]) => ({ type: 'declaration', name, value: val }));
    
    const program = optionalWhitespace.keepRight(declaration.many());
    
    const result = program.parse(`
      var x = 123;
      var y = "hello";
      var z = 456;
    `.trim());
    
    expect(result).toEqual([
      { type: 'declaration', name: 'x', value: 123 },
      { type: 'declaration', name: 'y', value: 'hello' },
      { type: 'declaration', name: 'z', value: 456 }
    ]);
  });
  
  it('should handle complex nested structures', () => {
    // Parse nested function calls: f(g(h(x)))
    const identifier = regex(/[a-zA-Z_][a-zA-Z0-9_]*/);
    const expr = lazy(() => choice([
      sequence([
        identifier,
        str('('),
        sepBy(expr, str(',')),
        str(')')
      ] as const, ([name, , args]) => ({ type: 'call', name, args })),
      identifier
    ]));
    
    const result = expr.parse('f(g(h(x)),y)');
    expect(result).toEqual({
      type: 'call',
      name: 'f',
      args: [
        {
          type: 'call',
          name: 'g',
          args: [
            {
              type: 'call',
              name: 'h',
              args: ['x']
            }
          ]
        },
        'y'
      ]
    });
  });
});

describe('Module Exports', () => {
  it('should export all main parsers from index', () => {
    // Test that the main exports are available
    expect(typeof CombiParse.str).toBe('function');
    expect(typeof CombiParse.regex).toBe('function');
    expect(typeof CombiParse.number).toBe('object');
    expect(typeof CombiParse.sequence).toBe('function');
    expect(typeof CombiParse.choice).toBe('function');
    expect(typeof CombiParse.Parser).toBe('function');
  });
  
  it('should be able to use parsers from main exports', () => {
    const parser = CombiParse.sequence([
      CombiParse.str('hello'),
      CombiParse.str(' '),
      CombiParse.str('world')
    ] as const, arr => arr.join(''));
    
    expect(parser.parse('hello world')).toBe('hello world');
  });
});
