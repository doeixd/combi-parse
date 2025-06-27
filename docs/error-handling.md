# Error Handling & Debugging

This guide covers advanced techniques for handling errors and debugging parsers in Combi-Parse.

## Understanding Parser Errors

### Error Types

Parser errors in Combi-Parse fall into several categories:

1. **Syntax Errors**: Input doesn't match expected grammar
2. **Semantic Errors**: Input is syntactically valid but semantically incorrect
3. **Runtime Errors**: Errors during transformation or validation
4. **Resource Errors**: Memory or time limits exceeded

```typescript
import { str, regex, number, genParser, fail } from 'combi-parse';

// Syntax error - input doesn't match
try {
  str("hello").parse("goodbye");
} catch (error) {
  console.log(error.message); // → Parse error at line 1, col 1: Expected "hello"
}

// Semantic error - valid syntax, invalid meaning
const positiveNumber = number.chain(n =>
  n > 0 ? succeed(n) : fail(`Expected positive number, got ${n}`)
);
```

### Error Context and Location

Combi-Parse provides detailed location information:

```typescript
const multilineInput = `
line 1
line 2 with error here
line 3
`;

try {
  someParser.parse(multilineInput);
} catch (error) {
  // Error includes line and column information
  console.log(error.message); // → Parse error at line 3, col 15: ...
}
```

## Improving Error Messages

### Custom Error Messages with `label`

Replace generic error messages with user-friendly ones:

```typescript
import { label } from 'combi-parse';

// Generic error message
const genericEmail = regex(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);

// User-friendly error message
const friendlyEmail = label(
  regex(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/),
  "a valid email address (user@domain.com)"
);

try {
  friendlyEmail.parse("invalid-email");
} catch (error) {
  console.log(error.message); // → Parse error at line 1, col 1: a valid email address (user@domain.com)
}
```

### Contextual Errors with `context`

Add context to understand what the parser was trying to do:

```typescript
import { context } from 'combi-parse';

const userProfile = context(
  genParser(function* () {
    yield str("{");
    yield whitespace.optional();
    
    const name = yield context(
      str('"name":').keepRight(whitespace.optional()).keepRight(jsonString),
      "parsing name field"
    );
    
    yield str(",");
    yield whitespace.optional();
    
    const email = yield context(
      str('"email":').keepRight(whitespace.optional()).keepRight(friendlyEmail),
      "parsing email field"
    );
    
    yield whitespace.optional();
    yield str("}");
    
    return { name, email };
  }),
  "parsing user profile"
);

try {
  userProfile.parse('{"name": "John", "email": "invalid"}');
} catch (error) {
  console.log(error.message);
  // → Parse error at line 1, col 27: [parsing user profile] [parsing email field] a valid email address (user@domain.com)
}
```

### Hierarchical Error Messages

Build error message hierarchies for complex parsers:

```typescript
const buildContextualParser = <T>(
  parser: Parser<T>,
  contextStack: string[]
): Parser<T> => {
  const contextString = contextStack.join(' → ');
  return context(parser, contextString);
};

const jsonValue = buildContextualParser(
  choice([
    buildContextualParser(jsonString, ['JSON', 'string']),
    buildContextualParser(jsonNumber, ['JSON', 'number']),
    buildContextualParser(jsonObject, ['JSON', 'object']),
    buildContextualParser(jsonArray, ['JSON', 'array'])
  ]),
  ['JSON', 'value']
);
```

## Error Recovery Strategies

### Panic Mode Recovery

Continue parsing after errors by skipping to synchronization points:

```typescript
const panicRecover = <T>(syncPoints: Parser<any>[]): Parser<null> =>
  genParser(function* () {
    while (true) {
      // Check if we've reached a synchronization point
      for (const syncPoint of syncPoints) {
        const found = yield lookahead(syncPoint).optional();
        if (found) return null;
      }
      
      // Check for end of input
      if (yield lookahead(eof).optional()) return null;
      
      // Skip one character and continue
      yield regex(/./);
    }
  });

const statement = choice([
  variableDeclaration,
  assignment,
  functionCall,
  // Recovery: skip to next semicolon or closing brace
  panicRecover([str(';'), str('}'), str('\n')]).map(() => ({
    type: 'error',
    message: 'Skipped invalid statement'
  }))
]);
```

### Error Production Rules

Add explicit error productions to handle common mistakes:

```typescript
const assignment = choice([
  // Correct assignment
  genParser(function* () {
    const name = yield identifier;
    yield lexeme(str('='));
    const value = yield expression;
    yield str(';');
    return { type: 'assignment', name, value };
  }),
  
  // Common error: missing semicolon
  genParser(function* () {
    const name = yield identifier;
    yield lexeme(str('='));
    const value = yield expression;
    // No semicolon - this is an error production
    return {
      type: 'assignment',
      name,
      value,
      error: 'Missing semicolon'
    };
  }),
  
  // Common error: wrong operator
  genParser(function* () {
    const name = yield identifier;
    yield lexeme(str('=='));  // Wrong operator
    const value = yield expression;
    return {
      type: 'error',
      message: 'Did you mean = instead of ==?',
      suggestion: { type: 'assignment', name, value }
    };
  })
]);
```

### Partial Parsing and Continuation

Allow parsing to continue with partial results:

```typescript
interface PartialResult<T> {
  result: T | null;
  errors: ParseError[];
  remaining: string;
}

const partialParser = <T>(parser: Parser<T>) =>
  genParser(function* () {
    const errors: ParseError[] = [];
    let result: T | null = null;
    
    try {
      result = yield parser;
    } catch (error) {
      errors.push({
        message: error.message,
        location: getCurrentLocation(),
        severity: 'error'
      });
    }
    
    const remaining = yield getRemainingInput;
    
    return { result, errors, remaining };
  });
```

## Debugging Techniques

### Parser Debugging with `.debug()`

Add debug output to understand parser behavior:

```typescript
const debuggedParser = genParser(function* () {
  const keyword = yield str("function").debug("keyword");
  yield whitespace.debug("whitespace");
  const name = yield identifier.debug("function-name");
  yield str("(").debug("open-paren");
  const params = yield parameterList.debug("parameters");
  yield str(")").debug("close-paren");
  
  return { type: 'function', name, params };
});

// When run, this will output:
// [keyword] Trying at position 0: "function hello(a, b) {...}"
// [keyword] ✅ Success! Consumed: "function"
// [whitespace] Trying at position 8: " hello(a, b) {..."
// [whitespace] ✅ Success! Consumed: " "
// [function-name] Trying at position 9: "hello(a, b) {..."
// [function-name] ✅ Success! Consumed: "hello"
// ...
```

### Custom Debug Logging

Create more sophisticated debugging tools:

```typescript
interface DebugInfo {
  parserName: string;
  input: string;
  position: number;
  success: boolean;
  consumed: string;
  result?: any;
  error?: string;
}

const createDebugLogger = () => {
  const logs: DebugInfo[] = [];
  
  const debugLog = <T>(parser: Parser<T>, name: string): Parser<T> =>
    new Parser(state => {
      const startPos = state.index;
      const preview = state.input.slice(state.index, state.index + 20);
      
      const result = parser.run(state);
      
      const debugInfo: DebugInfo = {
        parserName: name,
        input: preview,
        position: startPos,
        success: result.type === 'success',
        consumed: result.type === 'success' 
          ? state.input.slice(startPos, result.state.index)
          : '',
        result: result.type === 'success' ? result.value : undefined,
        error: result.type === 'failure' ? result.message : undefined
      };
      
      logs.push(debugInfo);
      return result;
    });
  
  return {
    debug: debugLog,
    getLogs: () => [...logs],
    clearLogs: () => logs.length = 0,
    printLogs: () => {
      logs.forEach(log => {
        const status = log.success ? '✅' : '❌';
        console.log(`${status} ${log.parserName} @${log.position}: "${log.input}"`);
        if (log.consumed) console.log(`   Consumed: "${log.consumed}"`);
        if (log.error) console.log(`   Error: ${log.error}`);
      });
    }
  };
};

// Usage
const logger = createDebugLogger();
const parser = genParser(function* () {
  const a = yield logger.debug(str("hello"), "greeting");
  const b = yield logger.debug(whitespace, "space");
  const c = yield logger.debug(str("world"), "target");
  return [a, b, c];
});

try {
  parser.parse("hello world");
  logger.printLogs();
} catch (error) {
  logger.printLogs();
  console.error("Parse failed:", error.message);
}
```

### Visual Parse Tree Generation

Generate visual representations of parse trees:

```typescript
interface ParseNode {
  name: string;
  value?: any;
  children: ParseNode[];
  start: number;
  end: number;
}

const createTreeBuilder = () => {
  const stack: ParseNode[] = [];
  
  const withTree = <T>(parser: Parser<T>, name: string): Parser<T> =>
    new Parser(state => {
      const startPos = state.index;
      const node: ParseNode = {
        name,
        children: [],
        start: startPos,
        end: startPos
      };
      
      stack.push(node);
      
      const result = parser.run(state);
      
      const currentNode = stack.pop()!;
      currentNode.end = result.type === 'success' ? result.state.index : state.index;
      
      if (result.type === 'success') {
        currentNode.value = result.value;
      }
      
      if (stack.length > 0) {
        stack[stack.length - 1].children.push(currentNode);
      }
      
      return result;
    });
  
  const printTree = (node: ParseNode, depth = 0): void => {
    const indent = '  '.repeat(depth);
    const valueStr = node.value !== undefined ? ` = ${JSON.stringify(node.value)}` : '';
    console.log(`${indent}${node.name}[${node.start}-${node.end}]${valueStr}`);
    node.children.forEach(child => printTree(child, depth + 1));
  };
  
  return { withTree, printTree };
};

// Usage
const treeBuilder = createTreeBuilder();
const { withTree, printTree } = treeBuilder;

const expressionParser = withTree(
  genParser(function* () {
    const left = yield withTree(number, 'number');
    const op = yield withTree(str('+'), 'operator');
    const right = yield withTree(number, 'number');
    return { left, op, right };
  }),
  'expression'
);

const result = expressionParser.parse("5 + 3");
// This would print:
// expression[0-5] = {"left":5,"op":"+","right":3}
//   number[0-1] = 5
//   operator[2-3] = "+"  
//   number[4-5] = 3
```

## Error Aggregation and Reporting

### Collecting Multiple Errors

Don't stop at the first error - collect all errors for better feedback:

```typescript
interface ValidationError {
  path: string[];
  message: string;
  location: { line: number; column: number };
}

const validateAndParse = <T>(
  parser: Parser<T>,
  validators: Array<(value: T) => ValidationError[]>
) =>
  genParser(function* () {
    const result = yield parser;
    
    const allErrors: ValidationError[] = [];
    
    validators.forEach(validator => {
      allErrors.push(...validator(result));
    });
    
    if (allErrors.length > 0) {
      throw new ValidationErrors(allErrors);
    }
    
    return result;
  });

// Usage for form validation
const userFormParser = validateAndParse(
  userObjectParser,
  [
    (user) => user.email.includes('@') ? [] : [{ 
      path: ['email'], 
      message: 'Email must contain @', 
      location: getEmailLocation(user) 
    }],
    (user) => user.age >= 0 ? [] : [{ 
      path: ['age'], 
      message: 'Age must be non-negative', 
      location: getAgeLocation(user) 
    }]
  ]
);
```

### Error Severity Levels

Classify errors by severity for better user experience:

```typescript
enum ErrorSeverity {
  Error = 'error',
  Warning = 'warning', 
  Info = 'info',
  Hint = 'hint'
}

interface ParseDiagnostic {
  severity: ErrorSeverity;
  message: string;
  location: { start: number; end: number };
  code?: string;
  fix?: string;
}

const lintingParser = <T>(parser: Parser<T>, rules: LintRule<T>[]) =>
  genParser(function* () {
    const result = yield parser;
    const diagnostics: ParseDiagnostic[] = [];
    
    rules.forEach(rule => {
      const violations = rule.check(result);
      diagnostics.push(...violations);
    });
    
    return { result, diagnostics };
  });

// Example linting rules
const jsLintRules: LintRule<any>[] = [
  {
    name: 'no-var',
    check: (ast) => ast.type === 'VariableDeclaration' && ast.kind === 'var' 
      ? [{ 
          severity: ErrorSeverity.Warning,
          message: 'Use let/const instead of var',
          code: 'no-var',
          fix: 'Replace var with let or const'
        }] 
      : []
  }
];
```

## Testing Error Conditions

### Error Testing Utilities

Create utilities to test that parsers fail correctly:

```typescript
const expectParseError = <T>(
  parser: Parser<T>,
  input: string,
  expectedError?: string | RegExp
) => {
  try {
    const result = parser.parse(input);
    throw new Error(`Expected parse to fail, but got: ${JSON.stringify(result)}`);
  } catch (error) {
    if (expectedError) {
      if (typeof expectedError === 'string') {
        if (!error.message.includes(expectedError)) {
          throw new Error(`Expected error message to contain "${expectedError}", got: ${error.message}`);
        }
      } else {
        if (!expectedError.test(error.message)) {
          throw new Error(`Expected error message to match ${expectedError}, got: ${error.message}`);
        }
      }
    }
    // Error was expected and matches criteria
    return error;
  }
};

// Usage in tests
describe('Email parser', () => {
  it('should reject invalid emails', () => {
    expectParseError(emailParser, 'not-an-email', 'valid email address');
    expectParseError(emailParser, '@domain.com', /email address/i);
    expectParseError(emailParser, 'user@', 'valid email address');
  });
});
```

### Property-Based Error Testing

Use property-based testing to find edge cases:

```typescript
const generateInvalidEmails = () => [
  'no-at-symbol',
  '@no-local-part',
  'no-domain@',
  'multiple@@at.symbols',
  'spaces in@email.com',
  // ... more invalid patterns
];

const testEmailParserRobustness = () => {
  const invalidEmails = generateInvalidEmails();
  
  invalidEmails.forEach(invalid => {
    expectParseError(emailParser, invalid);
  });
  
  console.log(`✅ Email parser correctly rejected ${invalidEmails.length} invalid inputs`);
};
```

## Integration with Development Tools

### IDE Integration

Provide rich error information for IDE integration:

```typescript
interface LanguageServerDiagnostic {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  message: string;
  severity: 1 | 2 | 3 | 4; // Error, Warning, Information, Hint
  code?: string;
  source?: string;
}

const createLanguageServerDiagnostics = (
  input: string,
  parseErrors: ParseError[]
): LanguageServerDiagnostic[] => {
  return parseErrors.map(error => ({
    range: {
      start: indexToLineColumn(input, error.start),
      end: indexToLineColumn(input, error.end)
    },
    message: error.message,
    severity: error.severity === 'error' ? 1 : 2,
    code: error.code,
    source: 'combi-parse'
  }));
};
```

### Error Recovery for Interactive Parsing

Handle incomplete input in interactive environments:

```typescript
const interactiveParser = <T>(parser: Parser<T>) => {
  return (input: string) => {
    try {
      return {
        success: true,
        result: parser.parse(input),
        errors: []
      };
    } catch (error) {
      // Try to provide partial results and suggestions
      const partial = tryPartialParse(parser, input);
      const suggestions = generateSuggestions(parser, input, error);
      
      return {
        success: false,
        result: partial,
        errors: [error],
        suggestions
      };
    }
  };
};

const generateSuggestions = <T>(
  parser: Parser<T>,
  input: string,
  error: ParseError
): string[] => {
  // Analyze the error and input to generate helpful suggestions
  const suggestions = [];
  
  if (error.message.includes('Expected')) {
    suggestions.push(`Try adding the expected token`);
  }
  
  if (input.endsWith(' ')) {
    suggestions.push(`Remove trailing whitespace`);
  }
  
  return suggestions;
};
```

This comprehensive error handling approach makes your parsers more robust, user-friendly, and suitable for production use in development tools and user-facing applications.
