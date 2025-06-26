// Type-safe AST builder
export function ast<T extends Record<string, any>>(
  type: T['type']
): <P extends Omit<T, 'type'>>(parser: Parser<P>) => Parser<T> {
  return (parser) => parser.map(props => ({ type, ...props } as T));
}

// Usage:
interface IfStatement {
  type: 'if';
  condition: Expression;
  then: Statement;
  else?: Statement;
}

const ifStatement = ast<IfStatement>('if')(
  sequence([
    str('if').keepRight(whitespace),
    expression,
    str('then').keepRight(whitespace),
    statement,
    optional(str('else').keepRight(whitespace).keepRight(statement))
  ] as const, ([condition, then, else_]) => ({ condition, then, else: else_ }))
);