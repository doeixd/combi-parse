import { describe, it, expect } from 'vitest';
import {
  ContextualParser,
  contextualSuccess,
  contextualFailure,
  lift,
  getContext,
  setContext,
  updateContext,
  withIndentation,
  withIncreasedIndentation,
  withScope,
  ContextualParserState,
  ParserContext, // For creating initial contexts
  Scope,         // For testing withScope
} from '../../src/parsers/contextual';
import { str, regex, number, Parser, ParserError, anyChar } from '../../src/';

// --- Test Setup ---

// Define a simple context for most tests
interface TestContext {
  count: number;
  mode: 'a' | 'b';
}

const initialTestContext: TestContext = {
  count: 0,
  mode: 'a',
};

// --- Helper Functions for Assertions ---

const expectContextualSuccess = <T, C>(
  result: any,
  value: T,
  newIndex: number,
  finalContext?: C
) => {
  expect(result.type).toBe('success');
  if (result.type === 'success') {
    expect(result.value).toEqual(value);
    expect(result.state.index).toBe(newIndex);
    if (finalContext) {
      expect(result.state.context).toEqual(finalContext);
    }
  }
};

const expectContextualFailure = <C>(
  result: any,
  errorMessage: string,
  failureIndex: number
) => {
  expect(result.type).toBe('failure');
  if (result.type === 'failure') {
    expect(result.error).toContain(errorMessage);
    expect(result.state.index).toBe(failureIndex);
  }
};


describe('ContextualParser Core', () => {

  describe('ContextualParser Class', () => {
    it('.parse() should succeed on valid input', () => {
      const parser = new ContextualParser<string, TestContext>(state =>
        contextualSuccess('ok', { ...state, index: 2 })
      );
      const result = parser.parse('ok', initialTestContext);
      expect(result).toBe('ok');
    });

    it('.parse() should throw ParserError on failure', () => {
      const parser = new ContextualParser<string, TestContext>(state =>
        contextualFailure('test error', state)
      );
      expect(() => parser.parse('input', initialTestContext)).toThrow(ParserError);
      expect(() => parser.parse('input', initialTestContext)).toThrow(
        'Parse error at line 1, col 1: test error'
      );
    });

    it('.parse() should throw if entire input is not consumed', () => {
      const parser = new ContextualParser<string, TestContext>(state =>
        contextualSuccess('ok', { ...state, index: 1 })
      );
      expect(() => parser.parse('input', initialTestContext)).toThrow(
        'Parser did not consume entire input'
      );
    });

    it('.map() should transform the success value without changing context', () => {
      const parser = lift<string, TestContext>(str('hello')).map(s => s.length);
      const result = parser.run({ input: 'hello', index: 0, context: initialTestContext });
      expectContextualSuccess(result, 5, 5, initialTestContext);
    });
    
    it('.chain() should sequence parsers and thread context', () => {
      const parser = lift<string, TestContext>(str('a')).chain(valA =>
        updateContext<TestContext>(ctx => ({ ...ctx, count: ctx.count + 1 })).chain(() =>
          lift<string, TestContext>(str('b')).map(valB => valA + valB)
        )
      );
      const result = parser.run({ input: 'ab', index: 0, context: initialTestContext });
      const expectedContext: TestContext = { count: 1, mode: 'a' };
      expectContextualSuccess(result, 'ab', 2, expectedContext);
    });
    
    it('.many() should apply a parser multiple times', () => {
      const parser = updateContext<TestContext>(ctx => ({ ...ctx, count: ctx.count + 1 }))
        .chain(() => lift(str('a')))
        .many();
        
      const result = parser.run({ input: 'aaa', index: 0, context: initialTestContext });
      
      // The context update should run 3 times
      const expectedContext: TestContext = { count: 3, mode: 'a' };
      expectContextualSuccess(result, ['a', 'a', 'a'], 3, expectedContext);
    });

    it('.many() should stop on failure and return collected results', () => {
        const parser = lift<string, TestContext>(str('a')).many();
        const result = parser.run({ input: 'aab', index: 0, context: initialTestContext });
        expectContextualSuccess(result, ['a', 'a'], 2, initialTestContext);
    });

    it('.many() should fail on infinite loop', () => {
        // A parser that succeeds without consuming input
        const emptySucceed = new ContextualParser<string, TestContext>(state => contextualSuccess('', state));
        const parser = emptySucceed.many();
        const result = parser.run({ input: 'a', index: 0, context: initialTestContext });
        expectContextualFailure(result, 'Infinite loop in .many()', 0);
    });
  });

});


describe('Core Contextual Combinators', () => {

  it('lift() should turn a base Parser into a ContextualParser', () => {
    const baseParser: Parser<string> = str('test');
    const contextualParser: ContextualParser<string, TestContext> = lift(baseParser);
    
    const result = contextualParser.run({ input: 'test', index: 0, context: initialTestContext });
    
    // Context should be unchanged
    expectContextualSuccess(result, 'test', 4, initialTestContext);
  });
  
  it('lift() should propagate failure from the base parser', () => {
    const baseParser: Parser<string> = str('test');
    const contextualParser: ContextualParser<string, TestContext> = lift(baseParser);
    
    const result = contextualParser.run({ input: 'fail', index: 0, context: initialTestContext });
    expectContextualFailure(result, '"test"', 0);
  });

  it('getContext() should succeed with the current context', () => {
    const parser = getContext<TestContext>();
    const result = parser.run({ input: '', index: 0, context: initialTestContext });
    expectContextualSuccess(result, initialTestContext, 0, initialTestContext);
  });
  
  it('setContext() should replace the context entirely', () => {
    const newContext: TestContext = { count: 99, mode: 'b' };
    const parser = setContext(newContext);
    const result = parser.run({ input: '', index: 0, context: initialTestContext });
    expectContextualSuccess(result, null, 0, newContext);
  });
  
  it('updateContext() should modify the context with a function', () => {
    const parser = updateContext<TestContext>(ctx => ({ ...ctx, count: ctx.count + 5 }));
    const result = parser.run({ input: '', index: 0, context: initialTestContext });
    const expectedContext: TestContext = { count: 5, mode: 'a' };
    expectContextualSuccess(result, null, 0, expectedContext);
  });

});


describe('High-Level Context Helpers', () => {

  describe('withIndentation', () => {
    interface IndentContext {
        indentLevel: number;
        indentationSize: number;
    }

    const initialIndentContext: IndentContext = { indentLevel: 1, indentationSize: 2 };
    const contentParser = lift<string, IndentContext>(str('content'));
    const indentedContentParser = withIndentation(contentParser);

    it('should succeed if indentation is correct', () => {
      // Input has 2 spaces, matching indentLevel 1 * indentationSize 2
      const result = indentedContentParser.run({ input: '  content', index: 0, context: initialIndentContext });
      expectContextualSuccess(result, 'content', 9, initialIndentContext);
    });

    it('should fail if indentation is insufficient', () => {
        const result = indentedContentParser.run({ input: ' content', index: 0, context: initialIndentContext });
        expectContextualFailure(result, 'Expected indentation of 2 spaces, but found 1', 0);
    });

    it('should fail if indentation is excessive', () => {
        const initialContext: IndentContext = { indentLevel: 0, indentationSize: 4 };
        const result = indentedContentParser.run({ input: '  content', index: 0, context: initialContext });
        // It fails because it expects 0 spaces, but finds 2
        expectContextualFailure(result, 'Expected indentation of 0 spaces, but found 2', 0);
    });
  });
  
  describe('withIncreasedIndentation', () => {
    interface IndentContext {
      indentLevel: number;
    }

    it('should run a parser with an increased indent level and restore it after', () => {
      let innerLevel = -1;
      const innerParser = getContext<IndentContext>().map(ctx => {
        innerLevel = ctx.indentLevel;
        return 'parsed';
      });
      
      const parser = withIncreasedIndentation(innerParser);
      const initialContext: IndentContext = { indentLevel: 5 };
      const result = parser.run({ input: '', index: 0, context: initialContext });

      // Check that the inner parser saw the incremented level
      expect(innerLevel).toBe(6);

      // Check that the final context has the original indent level restored
      const expectedContext: IndentContext = { indentLevel: 5 };
      expectContextualSuccess(result, 'parsed', 0, expectedContext);
    });
  });
  
  describe('withScope', () => {
    // Define a context that matches the `withScope` constraint
    interface ScopeContext {
      scopes: Scope[];
      currentScope: Scope;
      data: string;
    }
    
    it('should run a parser within a new scope and restore it after', () => {
      let innerScopeName: string | undefined = '';
      
      const initialScope: Scope = { type: 'module', variables: new Map() };
      const initialContext: ScopeContext = { scopes: [initialScope], currentScope: initialScope, data: 'original' };
      
      // An inner parser that modifies the context and checks the scope
      const innerParser = updateContext<ScopeContext>(ctx => ({ ...ctx, data: 'modified' })).chain(() => 
        getContext<ScopeContext>().map(ctx => {
          innerScopeName = ctx.currentScope.name;
          return 'inner result';
        })
      );
        
      const parser = withScope(innerParser, { type: 'function', name: 'myFunc' });
      const result = parser.run({ input: '', index: 0, context: initialContext });

      // 1. Check that the inner parser ran inside the new scope
      expect(innerScopeName).toBe('myFunc');
      
      // 2. Check that the final result is correct
      expectContextualSuccess(result, 'inner result', 0, undefined);
      
      // 3. Check that the final context has the original scope restored,
      //    but retains other modifications made by the inner parser.
      if (result.type === 'success') {
          const finalContext = result.state.context;
          expect(finalContext.scopes).toEqual([initialScope]);
          expect(finalContext.currentScope).toBe(initialScope);
          expect(finalContext.data).toBe('modified'); // Other changes are preserved
      }
    });
  });

});