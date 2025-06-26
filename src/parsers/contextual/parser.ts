// Context-aware parsing
export interface ParserContext {
  indentLevel: number;
  inString: boolean;
  variables: Map<string, any>;
  scopes: Array<Map<string, any>>;
}

export class ContextualParser<T> extends Parser<T> {
  constructor(
    private baseRun: (state: ParserState, context: ParserContext) => ParseResult<T>,
    private defaultContext: Partial<ParserContext> = {}
  ) {
    super(state => {
      const context: ParserContext = {
        indentLevel: 0,
        inString: false,
        variables: new Map(),
        scopes: [],
        ...this.defaultContext
      };
      return this.baseRun(state, context);
    });
  }

  withContext(context: Partial<ParserContext>): ContextualParser<T> {
    return new ContextualParser(this.baseRun, { ...this.defaultContext, ...context });
  }
}

// Python-like indentation parsing
export const indent = new ContextualParser<string>((state, context) => {
  const expectedSpaces = context.indentLevel * 2;
  const spaces = ' '.repeat(expectedSpaces);

  if (state.input.startsWith(spaces, state.index)) {
    return success(spaces, { ...state, index: state.index + expectedSpaces });
  }

  return failure(`Expected ${expectedSpaces} spaces of indentation`, state);
});

export const indented = <T>(parser: Parser<T>): ContextualParser<T> =>
  new ContextualParser((state, context) => {
    const newContext = { ...context, indentLevel: context.indentLevel + 1 };
    return parser.run(state);
  });

// Usage: Python-like syntax
const pythonBlock = genParser(function* () {
  yield str('if');
  yield whitespace;
  const condition = yield expression;
  yield str(':');
  yield newline;

  const body = yield indented(
    many1(sequence([indent, statement, newline]))
  );

  return { type: 'if', condition, body };
});