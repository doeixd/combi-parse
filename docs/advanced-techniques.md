# Advanced Techniques

This guide covers sophisticated parsing techniques for complex scenarios using Combi-Parse.

## Left Recursion and Complex Grammars

### Handling Left-Recursive Grammars

Traditional parser combinators struggle with left-recursive grammars. Combi-Parse provides tools to handle these cases:

```typescript
import { lazy, choice, genParser } from 'combi-parse';

// Expression grammar with left-associative operators
// expr = expr '+' term | expr '-' term | term
// term = term '*' factor | term '/' factor | factor
// factor = '(' expr ')' | number

const expr: Parser<any> = lazy(() => choice([
  genParser(function* () {
    const left = yield term;
    const ops = yield many(genParser(function* () {
      const op = yield choice([str('+'), str('-')]);
      const right = yield term;
      return { op, right };
    }));
    return ops.reduce((acc, { op, right }) => ({ op, left: acc, right }), left);
  }),
  term
]));

const term: Parser<any> = lazy(() => choice([
  genParser(function* () {
    const left = yield factor;
    const ops = yield many(genParser(function* () {
      const op = yield choice([str('*'), str('/')]);
      const right = yield factor;
      return { op, right };
    }));
    return ops.reduce((acc, { op, right }) => ({ op, left: acc, right }), left);
  }),
  factor
]));

const factor: Parser<any> = lazy(() => choice([
  between(str('('), expr, str(')')),
  number
]));
```

### Operator Precedence Parsing

Build precedence parsers for mathematical expressions:

```typescript
interface BinaryOp {
  operator: string;
  precedence: number;
  associativity: 'left' | 'right';
}

const operators: BinaryOp[] = [
  { operator: '^', precedence: 4, associativity: 'right' },
  { operator: '*', precedence: 3, associativity: 'left' },
  { operator: '/', precedence: 3, associativity: 'left' },
  { operator: '+', precedence: 2, associativity: 'left' },
  { operator: '-', precedence: 2, associativity: 'left' }
];

const buildPrecedenceParser = (operators: BinaryOp[], atom: Parser<any>) => {
  const sortedOps = operators.sort((a, b) => a.precedence - b.precedence);
  
  return sortedOps.reduce((currentParser, op) => {
    const opParser = lexeme(str(op.operator));
    
    if (op.associativity === 'left') {
      return genParser(function* () {
        const left = yield currentParser;
        const rest = yield many(genParser(function* () {
          const operator = yield opParser;
          const right = yield currentParser;
          return { operator, right };
        }));
        return rest.reduce((acc, { operator, right }) => 
          ({ type: 'binary', operator, left: acc, right }), left);
      });
    } else {
      // Right associative
      return genParser(function* () {
        const left = yield currentParser;
        const maybeRest = yield (genParser(function* () {
          const operator = yield opParser;
          const right = yield buildPrecedenceParser([op], currentParser);
          return { operator, right };
        })).optional();
        
        return maybeRest 
          ? { type: 'binary', operator: maybeRest.operator, left, right: maybeRest.right }
          : left;
      });
    }
  }, atom);
};

const mathExpression = buildPrecedenceParser(operators, 
  choice([number, between(str('('), lazy(() => mathExpression), str(')'))]));
```

## Stateful Parsing

### Context-Sensitive Parsing

Handle indentation-sensitive languages:

```typescript
interface ParseContext {
  indentStack: number[];
  currentIndent: number;
}

const withContext = <T>(parser: Parser<T>, updateContext: (ctx: ParseContext) => ParseContext) =>
  genParser(function* () {
    // This would require extending the Parser class to support context
    // For now, we show the pattern
    const result = yield parser;
    return result;
  });

const indentedBlock = genParser(function* () {
  const currentIndent = yield regex(/^ */);
  const content = yield many(genParser(function* () {
    const lineIndent = yield regex(/^ */);
    if (lineIndent.length <= currentIndent.length) {
      // Dedent detected
      return null;
    }
    const line = yield regex(/[^\n]*/);
    yield str('\n').optional();
    return line;
  }));
  
  return content.filter(line => line !== null);
});
```

### Scoped Parsing

Track variable scopes in language parsing:

```typescript
interface Scope {
  variables: Set<string>;
  parent?: Scope;
}

const createScope = (parent?: Scope): Scope => ({
  variables: new Set(),
  parent
});

const withScope = <T>(parser: Parser<T>) => 
  genParser(function* () {
    // Enter new scope
    const result = yield parser;
    // Exit scope
    return result;
  });

const variableDeclaration = genParser(function* () {
  yield str('let');
  yield whitespace;
  const name = yield identifier;
  yield lexeme(str('='));
  const value = yield expression;
  
  // Add to current scope
  return { type: 'declaration', name, value };
});
```

## Advanced Error Recovery

### Error Recovery Strategies

Implement error recovery for better IDE integration:

```typescript
const recoverUntil = <T>(terminator: Parser<any>) =>
  genParser(function* () {
    const recovered: string[] = [];
    
    while (true) {
      const isEnd = yield lookahead(choice([terminator, eof])).optional();
      if (isEnd) break;
      
      const char = yield regex(/./);
      recovered.push(char);
    }
    
    return { type: 'error', recovered: recovered.join('') };
  });

const statement = choice([
  variableDeclaration,
  assignment,
  recoverUntil(str(';'))
]);

const program = genParser(function* () {
  const statements = [];
  
  while (!(yield lookahead(eof).optional())) {
    const stmt = yield statement;
    statements.push(stmt);
    
    // Try to consume semicolon, recover if missing
    const semicolon = yield str(';').or(succeed(null));
    if (!semicolon) {
      // Semicolon missing, but continue parsing
    }
    
    yield whitespace.optional();
  }
  
  return statements;
});
```

### Incremental Parsing

For editor integration, implement incremental reparsing:

```typescript
interface ParseTree {
  type: string;
  start: number;
  end: number;
  children?: ParseTree[];
  value?: any;
}

const incrementalParser = (oldTree: ParseTree, change: TextChange) => {
  // Find nodes that need reparsing
  const affectedNodes = findAffectedNodes(oldTree, change);
  
  // Reparse only affected portions
  const newNodes = affectedNodes.map(node => 
    reparseNode(node, change));
  
  // Merge with unchanged nodes
  return mergeParseTree(oldTree, newNodes);
};
```

## Streaming and Async Parsing

### Streaming Parser

Parse data as it arrives:

```typescript
import { createStreamParser } from 'combi-parse';

const csvRecord = genParser(function* () {
  const fields = yield regex(/[^,\n]*/).sepBy(str(','));
  yield choice([str('\n'), eof]);
  return fields;
});

const streamParser = createStreamParser(csvRecord);

// Process data chunks
streamParser.onData('name,age\n');
streamParser.onData('John,25\n');
streamParser.onData('Jane,');
streamParser.onData('30\n');

const results = streamParser.getResults();
// → [['name', 'age'], ['John', '25'], ['Jane', '30']]
```

### Async Parser with Backpressure

Handle large datasets with memory management:

```typescript
const asyncBatchParser = async function* (
  parser: Parser<any>, 
  input: AsyncIterable<string>,
  batchSize = 1000
) {
  let buffer = '';
  let parsed = [];
  
  for await (const chunk of input) {
    buffer += chunk;
    
    while (buffer.length > 0) {
      try {
        const result = parser.run({ input: buffer, index: 0 });
        if (result.type === 'success') {
          parsed.push(result.value);
          buffer = buffer.slice(result.state.index);
          
          if (parsed.length >= batchSize) {
            yield parsed;
            parsed = [];
          }
        } else {
          // Wait for more input
          break;
        }
      } catch (error) {
        // Handle parse errors
        break;
      }
    }
  }
  
  if (parsed.length > 0) {
    yield parsed;
  }
};
```

## Performance Optimization

### Memoization

Cache parser results for better performance:

```typescript
const memoize = <T>(parser: Parser<T>) => {
  const cache = new Map<string, ParseResult<T>>();
  
  return new Parser(state => {
    const key = `${state.index}:${state.input.length}`;
    
    if (cache.has(key)) {
      return cache.get(key)!;
    }
    
    const result = parser.run(state);
    cache.set(key, result);
    return result;
  });
};

const expensiveParser = memoize(complexGrammarRule);
```

### Lookahead Optimization

Use lookahead to avoid expensive backtracking:

```typescript
const optimizedChoice = <T>(...parsers: Parser<T>[]) => {
  // Group parsers by their first character/token
  const groups = new Map<string, Parser<T>[]>();
  
  parsers.forEach(parser => {
    const firstChars = getFirstChars(parser);
    firstChars.forEach(char => {
      if (!groups.has(char)) groups.set(char, []);
      groups.get(char)!.push(parser);
    });
  });
  
  return genParser(function* () {
    const nextChar = yield lookahead(regex(/./));
    const candidates = groups.get(nextChar) || [];
    
    for (const candidate of candidates) {
      const result = yield candidate.or(fail(''));
      if (result) return result;
    }
    
    throw new Error('No matching parser');
  });
};
```

## Domain-Specific Languages

### Building a Query Language

Create parsers for custom DSLs:

```typescript
// SQL-like query language
const queryParser = genParser(function* () {
  yield str('SELECT').keepRight(whitespace);
  
  const fields = yield choice([
    str('*'),
    identifier.sepBy1(lexeme(str(',')))
  ]);
  
  yield lexeme(str('FROM'));
  const table = yield identifier;
  
  const whereClause = yield (
    lexeme(str('WHERE')).keepRight(condition)
  ).optional();
  
  const orderClause = yield (
    lexeme(str('ORDER')).keepRight(
      lexeme(str('BY')).keepRight(
        identifier.sepBy1(lexeme(str(',')))
      )
    )
  ).optional();
  
  return {
    type: 'select',
    fields,
    table,
    where: whereClause,
    orderBy: orderClause
  };
});

const condition = genParser(function* () {
  const left = yield identifier;
  yield whitespace.optional();
  const op = yield choice([str('='), str('!='), str('<'), str('>')]);
  yield whitespace.optional();
  const right = yield choice([number, stringLiteral]);
  
  return { left, op, right };
});
```

### Template Language Parser

Parse template languages with embedded expressions:

```typescript
const templateParser = genParser(function* () {
  const parts = [];
  
  while (!(yield lookahead(eof).optional())) {
    const part = yield choice([
      // Template expression
      genParser(function* () {
        yield str('{{');
        yield whitespace.optional();
        const expr = yield expression;
        yield whitespace.optional();
        yield str('}}');
        return { type: 'expression', value: expr };
      }),
      // Plain text
      genParser(function* () {
        const text = yield regex(/[^{]+/);
        return { type: 'text', value: text };
      })
    ]);
    
    parts.push(part);
  }
  
  return { type: 'template', parts };
});
```

## Testing and Debugging

### Parser Testing Utilities

Create utilities for testing parsers:

```typescript
const testParser = <T>(
  parser: Parser<T>,
  cases: Array<{ input: string; expected: T | 'error' }>
) => {
  cases.forEach(({ input, expected }, index) => {
    try {
      const result = parser.parse(input);
      if (expected === 'error') {
        throw new Error(`Test ${index}: Expected error but got: ${JSON.stringify(result)}`);
      }
      if (!deepEqual(result, expected)) {
        throw new Error(`Test ${index}: Expected ${JSON.stringify(expected)} but got ${JSON.stringify(result)}`);
      }
    } catch (error) {
      if (expected !== 'error') {
        throw new Error(`Test ${index}: Expected ${JSON.stringify(expected)} but got error: ${error.message}`);
      }
    }
  });
};

// Usage
testParser(mathExpression, [
  { input: '2 + 3 * 4', expected: { type: 'binary', op: '+', left: 2, right: { type: 'binary', op: '*', left: 3, right: 4 } } },
  { input: '(2 + 3) * 4', expected: { type: 'binary', op: '*', left: { type: 'binary', op: '+', left: 2, right: 3 }, right: 4 } },
  { input: '2 +', expected: 'error' }
]);
```

### Visual Parser Debugging

Create visual debugging tools:

```typescript
const visualizeParseTree = (result: any, depth = 0): string => {
  const indent = '  '.repeat(depth);
  
  if (typeof result === 'object' && result.type) {
    let output = `${indent}${result.type}\n`;
    Object.entries(result).forEach(([key, value]) => {
      if (key !== 'type') {
        output += `${indent}  ${key}: ${visualizeParseTree(value, depth + 1)}\n`;
      }
    });
    return output;
  }
  
  return `${indent}${JSON.stringify(result)}`;
};

const debugParser = <T>(parser: Parser<T>, label?: string) =>
  parser.debug(label).map(result => {
    console.log(`Parse tree for ${label}:`);
    console.log(visualizeParseTree(result));
    return result;
  });
```

## Integration Patterns

### Language Server Integration

Integrate parsers with language servers:

```typescript
interface ParseDiagnostic {
  range: { start: number; end: number };
  message: string;
  severity: 'error' | 'warning' | 'info';
}

const diagnosticParser = (input: string): ParseDiagnostic[] => {
  const diagnostics: ParseDiagnostic[] = [];
  
  try {
    languageParser.parse(input);
  } catch (error) {
    if (error instanceof ParserError) {
      diagnostics.push({
        range: { start: error.index, end: error.index + 1 },
        message: error.message,
        severity: 'error'
      });
    }
  }
  
  return diagnostics;
};
```

### AST Transformation

Transform parsed results into different representations:

```typescript
interface ASTNode {
  type: string;
  location: { start: number; end: number };
  [key: string]: any;
}

const withLocation = <T>(parser: Parser<T>) =>
  genParser(function* () {
    const start = yield getPosition;
    const result = yield parser;
    const end = yield getPosition;
    
    return {
      ...result,
      location: { start, end }
    };
  });

const getPosition = new Parser(state => 
  success(state.index, state));
```

These advanced techniques enable you to handle complex parsing scenarios, from building full programming language parsers to creating sophisticated domain-specific languages with excellent error handling and performance characteristics.
