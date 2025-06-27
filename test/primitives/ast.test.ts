import { describe, it, expect } from 'vitest';
import { ast, Expression, Statement } from '../../src/primitives/ast';
import { str, regex, sequence, choice, whitespace, number, sepBy } from '../../src/parser';

describe('AST Construction Utilities', () => {
  describe('ast function', () => {
    it('should create AST nodes with correct type field', () => {
      interface NumberLiteral {
        type: 'number';
        value: number;
      }

      const numberLiteral = ast<NumberLiteral>('number')(
        number.map(value => ({ value }))
      );

      const result = numberLiteral.parse('123');
      expect(result).toEqual({
        type: 'number',
        value: 123
      });
    });

    it('should work with string literal nodes', () => {
      interface StringLiteral {
        type: 'string';
        value: string;
      }

      const stringLiteral = ast<StringLiteral>('string')(
        str('"').keepRight(regex(/[^"]*/)).keepLeft(str('"')).map(value => ({ value }))
      );

      const result = stringLiteral.parse('"hello world"');
      expect(result).toEqual({
        type: 'string',
        value: 'hello world'
      });
    });

    it('should handle complex AST nodes with multiple properties', () => {
      interface BinaryExpression {
        type: 'binary';
        operator: string;
        left: number;
        right: number;
      }

      const binaryExpr = ast<BinaryExpression>('binary')(
        sequence([
          number,
          regex(/\s*[+\-*/]\s*/),
          number
        ], ([left, operator, right]) => ({
          operator: operator.trim(),
          left,
          right
        }))
      );

      const result = binaryExpr.parse('10 + 20');
      expect(result).toEqual({
        type: 'binary',
        operator: '+',
        left: 10,
        right: 20
      });
    });

    it('should work with nested AST structures', () => {
      interface Identifier {
        type: 'identifier';
        name: string;
      }

      interface CallExpression {
        type: 'call';
        callee: Identifier;
        arguments: number[];
      }

      const identifier = ast<Identifier>('identifier')(
        regex(/[a-zA-Z_][a-zA-Z0-9_]*/).map(name => ({ name }))
      );

      const callExpr = ast<CallExpression>('call')(
      sequence([
      identifier,
      str('('),
      sepBy(number, str(',').keepLeft(regex(/\s*/))),
      str(')')
      ], ([callee, , args]) => ({
      callee,
      arguments: args
      }))
      );

      const result = callExpr.parse('func(1,2,3)');
      expect(result).toEqual({
        type: 'call',
        callee: {
          type: 'identifier',
          name: 'func'
        },
        arguments: [1, 2, 3]
      });
    });

    it('should work with statement nodes', () => {
      interface VariableDeclaration extends Statement {
        type: 'variable';
        name: string;
        value: number;
      }

      const varDecl = ast<VariableDeclaration>('variable')(
        sequence([
          str('let').keepRight(regex(/\s+/)),
          regex(/[a-z]+/),
          regex(/\s*=\s*/),
          number
        ], ([, name, , value]) => ({ name, value }))
      );

      const result = varDecl.parse('let x = 42');
      expect(result).toEqual({
        type: 'variable',
        name: 'x',
        value: 42
      });
    });

    it('should work with optional properties', () => {
      interface IfStatement extends Statement {
        type: 'if';
        condition: string;
        then: string;
        else?: string;
      }

      const ifStmt = ast<IfStatement>('if')(
        sequence([
          str('if').keepRight(whitespace),
          regex(/[a-z]+/),
          whitespace.keepRight(str('then')).keepRight(whitespace),
          regex(/[a-z]+/),
          str(' else ').keepRight(regex(/[a-z]+/)).optional()
        ], ([, condition, , then, else_]) => ({
          condition,
          then,
          ...(else_ && { else: else_ })
        }))
      );

      const resultWithElse = ifStmt.parse('if condition then action else alternative');
      expect(resultWithElse).toEqual({
        type: 'if',
        condition: 'condition',
        then: 'action',
        else: 'alternative'
      });

      const resultWithoutElse = ifStmt.parse('if condition then action');
      expect(resultWithoutElse).toEqual({
        type: 'if',
        condition: 'condition',
        then: 'action'
      });
    });

    it('should work with array properties', () => {
      interface BlockStatement extends Statement {
        type: 'block';
        statements: Expression[];
      }

      interface SimpleExpression extends Expression {
        type: 'simple';
        value: string;
      }

      const simpleExpr = ast<SimpleExpression>('simple')(
        regex(/[a-z]+/).map(value => ({ value }))
      );

      const blockStmt = ast<BlockStatement>('block')(
        str('{').keepRight(simpleExpr.sepBy(str(';'))).keepLeft(str('}'))
          .map(statements => ({ statements }))
      );

      const result = blockStmt.parse('{foo;bar;baz}');
      expect(result).toEqual({
        type: 'block',
        statements: [
          { type: 'simple', value: 'foo' },
          { type: 'simple', value: 'bar' },
          { type: 'simple', value: 'baz' }
        ]
      });
    });

    it('should preserve type safety', () => {
      interface TypedNode {
        type: 'typed';
        stringProp: string;
        numberProp: number;
        booleanProp: boolean;
      }

      const typedNode = ast<TypedNode>('typed')(
        sequence([
          str('"').keepRight(regex(/[^"]*/)).keepLeft(str('"')),
          str(','),
          number,
          str(','),
          choice([str('true').map(() => true), str('false').map(() => false)])
        ], ([stringProp, , numberProp, , booleanProp]) => ({
          stringProp,
          numberProp,
          booleanProp
        }))
      );

      const result = typedNode.parse('"test",123,true');
      
      // TypeScript should infer the correct types
      expect(typeof result.stringProp).toBe('string');
      expect(typeof result.numberProp).toBe('number');
      expect(typeof result.booleanProp).toBe('boolean');
      expect(result.type).toBe('typed');

      expect(result).toEqual({
        type: 'typed',
        stringProp: 'test',
        numberProp: 123,
        booleanProp: true
      });
    });

    it('should work with union types', () => {
      interface NumberNode extends Expression {
        type: 'number';
        value: number;
      }

      interface StringNode extends Expression {
        type: 'string';
        value: string;
      }

      type Literal = NumberNode | StringNode;

      const numberNode = ast<NumberNode>('number')(
        number.map(value => ({ value }))
      );

      const stringNode = ast<StringNode>('string')(
        str('"').keepRight(regex(/[^"]*/)).keepLeft(str('"')).map(value => ({ value }))
      );

      const literal = choice([numberNode, stringNode]);

      const numberResult = literal.parse('123');
      expect(numberResult.type).toBe('number');
      if (numberResult.type === 'number') {
        expect(numberResult.value).toBe(123);
      }

      const stringResult = literal.parse('"hello"');
      expect(stringResult.type).toBe('string');
      if (stringResult.type === 'string') {
        expect(stringResult.value).toBe('hello');
      }
    });

    it('should handle empty properties object', () => {
      interface SimpleNode {
        type: 'simple';
      }

      const simpleNode = ast<SimpleNode>('simple')(
        str('simple').map(() => ({}))
      );

      const result = simpleNode.parse('simple');
      expect(result).toEqual({
        type: 'simple'
      });
    });

    it('should work with computed properties', () => {
      interface ComputedNode {
        type: 'computed';
        original: string;
        length: number;
        uppercase: string;
      }

      const computedNode = ast<ComputedNode>('computed')(
        regex(/[a-z]+/).map(original => ({
          original,
          length: original.length,
          uppercase: original.toUpperCase()
        }))
      );

      const result = computedNode.parse('hello');
      expect(result).toEqual({
        type: 'computed',
        original: 'hello',
        length: 5,
        uppercase: 'HELLO'
      });
    });
  });

  describe('Expression and Statement interfaces', () => {
    it('should work as base types for AST nodes', () => {
      interface MyExpression extends Expression {
        type: 'my-expr';
        value: string;
      }

      interface MyStatement extends Statement {
        type: 'my-stmt';
        expr: MyExpression;
      }

      const myExpr = ast<MyExpression>('my-expr')(
        regex(/[a-z]+/).map(value => ({ value }))
      );

      const myStmt = ast<MyStatement>('my-stmt')(
        myExpr.map(expr => ({ expr }))
      );

      const result = myStmt.parse('test');
      expect(result).toEqual({
        type: 'my-stmt',
        expr: {
          type: 'my-expr',
          value: 'test'
        }
      });

      // Should satisfy Expression and Statement interfaces
      const expr: Expression = result.expr;
      const stmt: Statement = result;
      expect(expr.type).toBe('my-expr');
      expect(stmt.type).toBe('my-stmt');
    });
  });

  describe('integration with complex grammars', () => {
    it('should work with a mini programming language', () => {
      interface Identifier extends Expression {
        type: 'identifier';
        name: string;
      }

      interface NumberLiteral extends Expression {
        type: 'number';
        value: number;
      }

      interface BinaryExpression extends Expression {
        type: 'binary';
        operator: '+' | '-' | '*' | '/';
        left: Expression;
        right: Expression;
      }

      interface Assignment extends Statement {
        type: 'assignment';
        variable: string;
        value: Expression;
      }

      const identifier = ast<Identifier>('identifier')(
        regex(/[a-zA-Z_][a-zA-Z0-9_]*/).map(name => ({ name }))
      );

      const numberLiteral = ast<NumberLiteral>('number')(
        number.map(value => ({ value }))
      );

      const expression: any = choice([
        identifier,
        numberLiteral
      ]);

      const binaryExpression = ast<BinaryExpression>('binary')(
        sequence([
          expression,
          regex(/\s*[+\-*/]\s*/),
          expression
        ], ([left, op, right]) => ({
          operator: op.trim() as '+' | '-' | '*' | '/',
          left,
          right
        }))
      );

      const assignment = ast<Assignment>('assignment')(
        sequence([
          regex(/[a-zA-Z_][a-zA-Z0-9_]*/),
          regex(/\s*=\s*/),
          choice([binaryExpression, expression])
        ], ([variable, , value]) => ({
          variable,
          value
        }))
      );

      const result = assignment.parse('x = y + 42');
      expect(result).toEqual({
        type: 'assignment',
        variable: 'x',
        value: {
          type: 'binary',
          operator: '+',
          left: {
            type: 'identifier',
            name: 'y'
          },
          right: {
            type: 'number',
            value: 42
          }
        }
      });
    });
  });
});
