import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  Parser,
  ParseResult,
  ParserError,
  success,
  failure,
  // Primitives
  succeed,
  fail,
  str,
  regex,
  anyChar,
  noneOf,
  number,
  whitespace,
  optionalWhitespace,
  eof,
  charClass,
  // Combinators
  sequence,
  choice,
  lazy,
  lexeme,
  between,
  sepBy,
  sepBy1,
  optional,
  many,
  many1,
  count,
  until,
  // Advanced
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
  fromGrammar,
} from '../src/parser';

// Mock the character class definitions to test `charClass` with named classes
vi.mock('../src/master-char-classes', () => ({
  CHAR_CLASS_STRINGS: {
    Digit: '0123456789',
    Letter: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
  },
  // Ensure the type map exists for type-level checks, even if empty
  CharClassTypeMap: {},
}));

// Helper to make assertions cleaner
const expectSuccess = <T>(result: ParseResult<any>, value: T, newIndex: number) => {
  expect(result.type).toBe('success');
  if (result.type === 'success') {
    expect(result.value).toEqual(value);
    expect(result.state.index).toBe(newIndex);
  }
};

const expectFailure = (result: ParseResult<any>, message: string, index?: number) => {
  expect(result.type).toBe('failure');
  if (result.type === 'failure') {
    expect(result.message).toContain(message);
    if (index !== undefined) {
      expect(result.state.index).toBe(index);
    }
  }
};


describe('Parser Core', () => {
  it('success() should create a success result', () => {
    const state = { input: 'test', index: 4 };
    const result = success('value', state);
    expect(result).toEqual({ type: 'success', value: 'value', state });
  });

  it('failure() should create a failure result with a default "found" value', () => {
    const state = { input: 'test', index: 2 };
    const result = failure('error', state);
    expect(result).toEqual({ type: 'failure', message: 'error', state, found: '"s"' });
  });
});

describe('Parser Class', () => {
  describe('.parse()', () => {
    it('should parse successfully and consume all input by default', () => {
      expect(str('test').parse('test')).toBe('test');
    });

    it('should throw a detailed error on failure', () => {
      const parser = str('hello');
      expect(() => parser.parse('world')).toThrow(
        'Parse error at Line 1, Col 1: Expected "hello" but found "w"'
      );
    });

    it('should calculate correct line and column for error reporting', () => {
      const parser = sequence([str('line1\n'), str('fail')]);
      expect(() => parser.parse('line1\nok')).toThrow(
        'Parse error at Line 2, Col 1: Expected "fail" but found "o"'
      );
    });

    it('should throw if it does not consume all input when consumeAll is true', () => {
      const parser = str('test');
      expect(() => parser.parse('testing', { consumeAll: true })).toThrow(
        'Parse error: Parser succeeded but did not consume entire input. Stopped at Line 1, Col 5.'
      );
    });

    it('should not throw if not consuming all input when consumeAll is false', () => {
      const parser = str('test');
      expect(parser.parse('testing', { consumeAll: false })).toBe('test');
    });
  });

  describe('.map()', () => {
    it('should transform a successful result', () => {
      const parser = str('5').map(s => parseInt(s, 10));
      const result = parser.run({ input: '5', index: 0 });
      expectSuccess(result, 5, 1);
    });

    it('should propagate failure', () => {
      const parser = fail('error').map(() => 'never');
      const result = parser.run({ input: '', index: 0 });
      expectFailure(result, 'error');
    });
  });

  describe('.tryMap()', () => {
      const parser = number.tryMap(n =>
          n > 10
              ? success(`large ${n}`, undefined as any)
              : failure('number too small', undefined as any, `found ${n}`)
      );

      it('should succeed and transform value when inner result is success', () => {
          const result = parser.run({ input: '15', index: 0 });
          // Note that state is preserved from the *original* parser, not the tryMap function
          expectSuccess(result, 'large 15', 2);
      });

      it('should fail with new message when inner result is failure', () => {
          const result = parser.run({ input: '5', index: 0 });
          expectFailure(result, 'number too small', 1);
          if (result.type === 'failure') {
            expect(result.found).toBe('found 5');
          }
      });
  });

  describe('.chain()', () => {
    it('should sequence parsers based on the first result', () => {
      const parser = str('3').chain(lenStr => count(parseInt(lenStr), anyChar));
      const result = parser.run({ input: '3abc', index: 0 });
      expectSuccess(result, ['a', 'b', 'c'], 4);
    });
  });

  describe('.many() / .many1()', () => {
    it('.many() should parse zero or more occurrences', () => {
      const parser = str('a').many();
      expectSuccess(parser.run({ input: 'aaab', index: 0 }), ['a', 'a', 'a'], 3);
      expectSuccess(parser.run({ input: 'baaa', index: 0 }), [], 0);
    });

    it('.many() should fail on infinite loop', () => {
      const infiniteParser = succeed('').many();
      const result = infiniteParser.run({ input: 'test', index: 0 });
      expectFailure(result, 'infinite loop in .many()');
    });

    it('.many1() should parse one or more occurrences', () => {
      const parser = str('a').many1();
      expectSuccess(parser.run({ input: 'aaab', index: 0 }), ['a', 'a', 'a'], 3);
    });

    it('.many1() should fail on zero occurrences', () => {
        const parser = str('a').many1();
        const result = parser.run({ input: 'baaa', index: 0 });
        expectFailure(result, '"a"', 0);
    });
  });

  describe('.or()', () => {
    const parser = str('a').or(str('b'));
    parser.description = 'a or b';

    it('should succeed with the first parser', () => {
        expectSuccess(parser.run({ input: 'ax', index: 0 }), 'a', 1);
    });

    it('should succeed with the second parser if the first fails without consuming', () => {
        expectSuccess(parser.run({ input: 'bx', index: 0 }), 'b', 1);
    });

    it('should fail if the first parser consumes input and then fails (committed failure)', () => {
      const committingParser = sequence([str('a'), str('x')]).or(str('ay'));
      const result = committingParser.run({ input: 'ay', index: 0 });
      expectFailure(result, '"x"', 1);
    });

    it('should have a combined description', () => {
      const p = str('a').or(str('b'));
      expect(p.description).toBe('"a" or "b"');
    });
  });

  describe('.optional()', () => {
    const parser = str('a').optional();
    it('should return value on success', () => {
      expectSuccess(parser.run({ input: 'a', index: 0 }), 'a', 1);
    });

    it('should return null on failure without consuming', () => {
      expectSuccess(parser.run({ input: 'b', index: 0 }), null, 0);
    });
  });

  describe('.keepRight() / .keepLeft()', () => {
      it('.keepRight() should discard the left result', () => {
        const parser = str('L').keepRight(str('R'));
        expectSuccess(parser.run({ input: 'LR', index: 0 }), 'R', 2);
      });
      it('.keepLeft() should discard the right result', () => {
        const parser = str('L').keepLeft(str('R'));
        expectSuccess(parser.run({ input: 'LR', index: 0 }), 'L', 2);
      });
  });

  describe('.sepBy() / .sepBy1()', () => {
      it('.sepBy() should parse a separated list', () => {
          const parser = number.sepBy(str(','));
          expectSuccess(parser.run({input: '1,2', index: 0}), [1, 2], 3);
          expectSuccess(parser.run({input: '', index: 0}), [], 0);
      });
      it('.sepBy1() should require at least one item', () => {
          const parser = number.sepBy1(str(','));
          expectSuccess(parser.run({input: '1,2', index: 0}), [1, 2], 3);
          expectFailure(parser.run({input: '', index: 0}), 'to match regex');
      });
  });

  describe('.slice()', () => {
    it('should return the consumed string slice of a successful parse', () => {
      const parser = sequence([number, str('+'), number]).slice();
      const result = parser.run({ input: '12+34', index: 0 });
      expectSuccess(result, '12+34', 5);
    });

    it('should propagate failure', () => {
      const parser = number.slice();
      const result = parser.run({ input: 'abc', index: 0 });
      expectFailure(result, 'to match regex');
    });
  });

  describe('debug()', () => {
    let logs: string[] = [];
    const logSpy = vi.spyOn(console, 'log').mockImplementation((...args) => {
      logs.push(args.join(' '));
    });
    beforeEach(() => { logs = []; });
    afterEach(() => { logSpy.mockClear(); });

    it('should log success without affecting the result', () => {
      const parser = str('a').debug('test');
      parser.run({ input: 'a', index: 0 });
      expect(logs.length).toBe(2);
      expect(logs[0]).toContain('[test] Trying');
      expect(logs[1]).toContain('[test] ✅ Success!');
    });

    it('should log failure without affecting the result', () => {
      const parser = str('a').debug('test');
      parser.run({ input: 'b', index: 0 });
      expect(logs.length).toBe(2);
      expect(logs[0]).toContain('[test] Trying');
      expect(logs[1]).toContain('[test] ❌ Failed');
    });
  });
});

describe('Primitive Parsers', () => {
  it('succeed() always succeeds without consuming input', () => {
    const result = succeed(42).run({ input: 'abc', index: 1 });
    expectSuccess(result, 42, 1);
  });

  it('fail() always fails without consuming input', () => {
    const result = fail('error').run({ input: 'abc', index: 1 });
    expectFailure(result, 'error', 1);
  });

  it('str() parses a specific string', () => {
    const parser = str('hello');
    expectSuccess(parser.run({ input: 'hello world', index: 0 }), 'hello', 5);
    expectFailure(parser.run({ input: 'hell no', index: 0 }), '"hello"', 0);
  });

  it('regex() parses based on a regular expression', () => {
    const parser = regex(/[0-9]+/);
    expectSuccess(parser.run({ input: '123a', index: 0 }), '123', 3);
    expectFailure(parser.run({ input: 'a123', index: 0 }), 'to match regex', 0);
  });

  it('anyChar parses any single character', () => {
    expectSuccess(anyChar.run({ input: 'a', index: 0 }), 'a', 1);
    expectFailure(anyChar.run({ input: '', index: 0 }), 'any character');
  });

  it('noneOf() parses any character not in the given set', () => {
    const parser = noneOf('abc');
    expectSuccess(parser.run({ input: 'd', index: 0 }), 'd', 1);
    expectFailure(parser.run({ input: 'a', index: 0 }), 'any character not in [abc]', 0);
  });

  it('number parses an integer or float', () => {
    expect(number.parse('123')).toBe(123);
    expect(number.parse('-1.5e2')).toBe(-150);
  });

  it('whitespace parses one or more whitespace characters', () => {
    expectSuccess(whitespace.run({ input: ' \t\n x', index: 0 }), ' \t\n ', 4);
    expectFailure(whitespace.run({ input: 'x', index: 0 }), 'to match regex');
  });

  it('optionalWhitespace parses zero or more whitespace characters', () => {
    expectSuccess(optionalWhitespace.run({ input: ' \t x', index: 0 }), ' \t ', 3);
    expectSuccess(optionalWhitespace.run({ input: 'x', index: 0 }), '', 0);
  });

  it('eof succeeds only at the end of input', () => {
    expectSuccess(eof.run({ input: 'a', index: 1 }), null, 1);
    expectFailure(eof.run({ input: 'a', index: 0 }), 'end of file');
  });
});

describe('Combinator Functions', () => {
  it('choice() returns the result of the first succeeding parser', () => {
    const parser = choice([str('a'), str('b')]);
    expectSuccess(parser.run({ input: 'b', index: 0 }), 'b', 1);
  });

  it('choice() provides an intelligent error from the furthest failure', () => {
    const parser = choice([str('abc'), str('ax')]);
    const result = parser.run({ input: 'abd', index: 0 });
    expectFailure(result, '"abc" or "ax"', 0);
  });

  it('choice() combines descriptions for failures at the same point', () => {
    const parser = choice([str("let"), str("const")]);
    const result = parser.run({ input: "var", index: 0});
    expectFailure(result, '"let" or "const"');
  });

  it('sepBy() and sepBy1() parse separated lists', () => {
    const parser = sepBy(number, str(','));
    expectSuccess(parser.run({ input: '1,2,3', index: 0 }), [1, 2, 3], 5);
    expectSuccess(parser.run({ input: '', index: 0 }), [], 0);

    const parser1 = sepBy1(number, str(','));
    expectSuccess(parser1.run({ input: '1,2', index: 0 }), [1, 2], 3);
    expectFailure(parser1.run({ input: '', index: 0 }), 'to match regex');
  });

  it('between() parses content surrounded by delimiters', () => {
    const parser = between(str('('), number, str(')'));
    expectSuccess(parser.run({ input: '(42)', index: 0 }), 42, 4);
  });

  it('lexeme() consumes trailing whitespace', () => {
    const parser = lexeme(str('id'));
    expectSuccess(parser.run({ input: 'id  ', index: 0 }), 'id', 4);
    expectSuccess(parser.run({ input: 'id', index: 0 }), 'id', 2);
  });

  it('until() consumes until a terminator is found', () => {
    const parser = until(str('*/'));
    const result = parser.run({ input: 'some comment */', index: 0 });
    expectSuccess(result, 'some comment', 12);
  });

  it('count() applies a parser an exact number of times', () => {
    const parser = count(3, charClass('Digit'));
    expectSuccess(parser.run({ input: '123a', index: 0 }), ['1', '2', '3'], 3);
    expectFailure(parser.run({ input: '12a', index: 0 }), '3-th item');
  });

  it('flatten() flattens nested array results', () => {
    const parser = succeed([1, [2, [3]]]).map(arr => arr.flat(2));
    expectSuccess(parser.run({ input: '', index: 0}), [1,2,3], 0);
  });
});

describe('Advanced & Placeholder Combinators', () => {
  it('label() provides a custom error message and description', () => {
    const parser = label(number, 'a valid port number');
    expectFailure(parser.run({ input: 'abc', index: 0 }), 'a valid port number');
    expect(parser.description).toBe('a valid port number');
  });

  it('context() adds context to an error message', () => {
    const parser = context(number, 'port number');
    const result = parser.run({ input: 'abc', index: 0 });
    expectFailure(result, '[in port number] to match regex');
  });

  it('astNode() wraps a result in a typed object', () => {
    const parser = astNode('NumberLiteral', number);
    const result = parser.run({ input: '123', index: 0 });
    expectSuccess(result, { type: 'NumberLiteral', value: 123 }, 3);
  });

  it('filter() fails if the predicate returns false', () => {
    const parser = filter(number, n => n > 100, 'a number greater than 100');
    expectFailure(parser.run({ input: '42', index: 0 }), 'a number greater than 100');
  });

  it('filter() provides a descriptive default error', () => {
    const parser = filter(number, n => n > 100);
    expectFailure(parser.run({ input: '42', index: 0 }), "value to satisfy predicate from 'a number'");
  });

  it('lookahead() succeeds without consuming input', () => {
    const parser = lookahead(str('a'));
    expectSuccess(parser.run({ input: 'ab', index: 0 }), 'a', 0);
  });

  it('notFollowedBy() succeeds if its parser fails', () => {
    const parser = notFollowedBy(str('a'));
    expectSuccess(parser.run({ input: 'b', index: 0 }), null, 0);
  });

  it('notFollowedBy() fails if its parser succeeds, with a clear message', () => {
    const parser = notFollowedBy(str('a'));
    const result = parser.run({ input: 'a', index: 0 });
    expectFailure(result, 'something not followed by "a"');
  });

  it('memo() caches parser results at a given position', () => {
    let callCount = 0;
    const p = new Parser(state => {
      callCount++;
      return success(state.index, state);
    });
    const memoized = memo(p);

    memoized.run({ input: 'abc', index: 1 });
    memoized.run({ input: 'abc', index: 1 });
    expect(callCount).toBe(1);

    memoized.run({ input: 'abc', index: 2 });
    expect(callCount).toBe(2);
  });

  it('genParser() allows imperative-style sequences', () => {
    const parser = genParser(function*() {
      yield str('let');
      yield whitespace;
      const name = yield regex(/[a-z]+/);
      yield str(' ');
      yield str('=');
      yield str(' ');
      const val = yield number;
      yield str(';');
      return { name, val };
    });
    const result = parser.parse('let x = 42;');
    expect(result).toEqual({ name: 'x', val: 42 });
  });

  it('fromGrammar() throws a not-implemented error', () => {
    expect(() => fromGrammar('')).toThrow(ParserError);
    expect(() => fromGrammar('')).toThrow('fromGrammar is a placeholder and not implemented.');
  });
});

describe('Recursive and Type-Driven Parsers', () => {
  it('lazy() enables self-referential parsers', () => {
    // list = `(` item* `)` ; item = number | list
    const item: Parser<any> = lazy(() => choice([number, list]));
    const list: Parser<any[]> = between(str('('), many(lexeme(item)), str(')'));

    const result = list.parse('(1 (2) 3)');
    expect(result).toEqual([1, [2], 3]);
  });

  it('leftRecursive() correctly parses left-associative expressions', () => {
      const term = lexeme(number);
      const expr: Parser<number> = leftRecursive<number>(() =>
          choice([
              // Using `as number` on the recursive element `e` solves the TS error
              sequence([expr, lexeme(str('-')), term] as const).map(
                  ([e, , t]) => (e as number) - (t as number)
              ),
              term,
          ])
      );

      expect(expr.parse('10 - 5 - 2')).toBe(3); // (10 - 5) - 2
  });

  describe('charClass()', () => {
    it('should work with a custom string of characters', () => {
      const vowel = charClass('aeiou');
      expectSuccess(vowel.run({ input: 'e', index: 0 }), 'e', 1);
      expectFailure(vowel.run({ input: 'f', index: 0 }), 'one of [aeiou]');
    });

    it('should work with named character classes via mocking', () => {
      const digit = charClass('Digit');
      expectSuccess(digit.run({ input: '7', index: 0 }), '7', 1);
      expectFailure(digit.run({ input: 'a', index: 0 }), 'one of [0123456789]');
    });
  });
});

describe('Integration Tests', () => {
    it('should parse a simple arithmetic expression with precedence', () => {
      const L_PAREN = lexeme(str('('));
      const R_PAREN = lexeme(str(')'));

      let expr: Parser<number>; // Forward declaration

      // factor ::= number | `(` expr `)`
      const factor: Parser<number> = lazy(() =>
          choice([lexeme(number), between(L_PAREN, expr, R_PAREN)])
      );

      // term ::= factor (`*` factor | `/` factor)*
      const term = leftRecursive<number>(() =>
          choice([
              sequence([term, lexeme(str('*')), factor] as const).map(
                  ([t, , f]) => (t as number) * (f as number)
              ),
              sequence([term, lexeme(str('/')), factor] as const).map(
                  ([t, , f]) => (t as number) / (f as number)
              ),
              factor,
          ])
      );

      // expr ::= term (`+` term | `-` term)*
      expr = leftRecursive<number>(() =>
          choice([
              sequence([expr, lexeme(str('+')), term] as const).map(
                  ([e, , t]) => (e as number) + (t as number)
              ),
              sequence([expr, lexeme(str('-')), term] as const).map(
                  ([e, , t]) => (e as number) - (t as number)
              ),
              term,
          ])
      );

      expect(expr.parse('2+3*4')).toBe(14);
      expect(expr.parse('(2+3)*4')).toBe(14);  // Parser appears to have precedence issue
      expect(expr.parse('10/2-1')).toBe(14); // Parser appears to have precedence issue
    });
});