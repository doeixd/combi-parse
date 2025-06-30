# Guide: Error Handling & Debugging in Combi-Parse

This guide covers advanced techniques for handling errors, implementing recovery strategies, and debugging parsers in Combi-Parse. Moving beyond simple pass/fail, these patterns are essential for building robust, user-friendly applications.

## 1. Understanding Parser Errors

Combi-Parse provides detailed errors that you can use to give users precise feedback.

### Error Structure

When a parser fails, the top-level `.parse()` method throws a `ParserError` that contains a human-readable message with line and column information.

```typescript
import { str, succeed, fail, number } from 'combi-parse';

// A simple syntax error when the input doesn't match the grammar.
try {
  str("hello").parse("goodbye");
} catch (error) {
  console.log(error.message); 
  // → Parse error at Line 1, Col 1: Expected "hello" but found "g"
}
```

### Semantic vs. Syntax Errors

It's crucial to distinguish between syntax (the grammar is wrong) and semantics (the grammar is right, but the meaning is wrong). You can create semantic errors using the `fail` combinator.

```typescript
// Semantic error: the input " -5" is a valid number, but it's not positive.
const positiveNumber = number.chain(n =>
  n > 0 ? succeed(n) : fail(`Expected a positive number, but got ${n}`)
);

try {
  positiveNumber.parse("-5");
} catch (error) {
  console.error(error.message);
  // → Parse error at Line 1, Col 1: Expected a positive number, but got -5
}
```

## 2. Improving Error Messages

Clear error messages are key to a good user experience.

### Custom Error Messages with `label`

Use `label` to replace a parser's default error message with something more descriptive.

```typescript
import { label, regex } from 'combi-parse';

const friendlyEmail = label(
  regex(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/),
  "a valid email address (e.g., user@domain.com)"
);

try {
  friendlyEmail.parse("invalid-email");
} catch (error) {
  console.log(error.message);
  // → Parse error at Line 1, Col 1: Expected a valid email address (e.g., user@domain.com)
}
```

### Adding Context with `context`

Use `context` to show *what* the parser was trying to do when it failed. This is invaluable for complex, nested grammars.

```typescript
import { context, genParser, whitespace } from 'combi-parse';

const userProfileParser = context(
  genParser(function* () {
    // ... setup for jsonString, friendlyEmail
    const jsonString = str("dummy");

    yield str("{");
    // ...
    const email = yield context(
      str('"email":').keepRight(whitespace).keepRight(friendlyEmail),
      "parsing user's email"
    );
    // ...
    yield str("}");
  }),
  "parsing user profile"
);

try {
  userProfileParser.parse('{"email": invalid}');
} catch (error) {
  console.log(error.message);
  // → Parse error at Line 1, Col 11: [in parsing user profile] [in parsing user's email] Expected a valid email address...
}
```

## 3. Error Recovery Strategies

For tools like IDEs or linters, stopping at the first error is not enough. Error recovery attempts to continue parsing to find more errors.

### Panic Mode Recovery

The simplest recovery strategy is "panic mode," where upon an error, the parser skips input until it finds a known synchronization point (like a semicolon, newline, or closing brace).

```typescript
import { choice, lookahead, eof, str, many1, Parser } from 'combi-parse';

// A parser that skips input until it sees a sync point, but does not consume it.
const recover = (syncPoints: Parser<any>[]) =>
  many1(choice(syncPoints).keepLeft(lookahead(anyChar)).not()).slice();


const statement = choice([
  // variableDeclaration,
  // assignment,
  // functionCall,
  // Recovery Rule: If no valid statement is found, trigger recovery.
  recover([str(';'), str('}')]).map(skipped => ({
    type: 'ParseError',
    message: 'Skipped invalid statement.',
    skippedText: skipped,
  })),
]);
```

### Error Production Rules

A more advanced technique is to add explicit rules to your grammar that match common mistakes. This lets you provide highly specific feedback.

```typescript
// A parser for a correct assignment statement.
const correctAssignment = genParser(function* () {
    const name = yield identifier;
    yield lexeme(str('='));
    const value = yield expression;
    yield str(';');
    return { type: 'Assignment', name, value };
});

// An error production that matches the common mistake of using `==` for assignment.
const equalityAsAssignmentError = genParser(function* () {
    const name = yield identifier;
    yield lexeme(str('==')); // Matches the common error
    const value = yield expression;
    // Instead of failing, this parser *succeeds* with an error object.
    return fail(`Assignment uses '=', not '=='. Did you mean to write '${name} = ...'?`);
});

// By ordering the `choice` carefully, we try the error production first.
const assignment = choice([
    equalityAsAssignmentError,
    correctAssignment,
]);
```

### Partial Parsing and Continuation

This pattern allows a parser to *always succeed*, returning a structured result that contains either the parsed value or a list of errors. This is ideal for interactive applications.

**Note:** This pattern cannot use `yield` from `genParser`, as it requires direct inspection of the `ParseResult`.

```typescript
interface PartialResult<T> {
  result: T | null;
  errors: { message: string, index: number }[];
  remainingInput: string;
}

const createPartialParser = <T>(parser: Parser<T>): Parser<PartialResult<T>> =>
  new Parser(state => {
    // Run the underlying parser.
    const result = parser.run(state);
    
    // If the main parser succeeded, wrap it in a successful PartialResult.
    if (result.type === 'success') {
      const partialResult: PartialResult<T> = {
        result: result.value,
        errors: [],
        remainingInput: state.input.slice(result.state.index),
      };
      return success(partialResult, result.state);
    }
    
    // If the main parser failed, create a successful PartialResult containing the error.
    const partialResult: PartialResult<T> = {
      result: null,
      errors: [{ message: result.message, index: result.state.index }],
      remainingInput: state.input.slice(state.index), // No input was consumed on failure
    };
    // This parser itself succeeds, allowing processing to continue.
    return success(partialResult, state);
  });

// Usage
const partialNumberParser = createPartialParser(number);
const result = partialNumberParser.parse("abc");
console.log(result.errors[0].message); // -> "Expected a number"
console.log(result.result);            // -> null
```

## 4. Debugging Techniques

### The `.debug()` Method

The easiest way to see what a parser is doing is with the `.debug()` method. It logs the parser's attempts, successes, and failures without changing its behavior.

```typescript
import { identifier } from 'combi-parse';

const debuggedParser = genParser(function* () {
  yield str("function").debug("keyword");
  yield whitespace.debug("whitespace");
  yield identifier.debug("function-name");
  // ...
});

debuggedParser.parse("function myFunc");
// Console Output:
// [keyword] Trying at pos 0: "function myFunc..."
// [keyword] ✅ Success! Value: "function", Consumed: "function"
// [whitespace] Trying at pos 8: " myFunc..."
// [whitespace] ✅ Success! Value: " ", Consumed: " "
// [function-name] Trying at pos 9: "myFunc..."
// [function-name] ✅ Success! Value: "myFunc", Consumed: "myFunc"
```

### Custom Debug Logger

For more structured analysis, you can build a custom debugging wrapper that collects log entries into an array.

```typescript
interface DebugInfo {
  name: string;
  success: boolean;
  consumed: string;
  result?: any;
  error?: string;
}

// Factory to create a logger and its associated debug combinator
const createDebugLogger = () => {
  const logs: DebugInfo[] = [];
  
  const debug = <T>(parser: Parser<T>, name: string): Parser<T> =>
    new Parser(state => {
      const result = parser.run(state);
      logs.push({
        name,
        success: result.type === 'success',
        consumed: result.type === 'success' ? state.input.slice(state.index, result.state.index) : '',
        result: result.type === 'success' ? result.value : undefined,
        error: result.type === 'failure' ? result.message : undefined
      });
      return result;
    });
  
  return { debug, getLogs: () => logs };
};

// Usage
const logger = createDebugLogger();
const parser = logger.debug(str('a'), 'parser-a').keepRight(logger.debug(str('b'), 'parser-b'));
parser.parse('ab');

console.log(logger.getLogs());
// → [ { name: 'parser-a', success: true, ... }, { name: 'parser-b', success: true, ... } ]
```

### Visualizing the Parse Tree

A powerful debugging technique is to visualize the parse tree to see how your combinators are nested. This utility wraps parsers to build a tree structure during the parse.

```typescript
interface ParseNode {
  name: string;
  value?: any;
  children: ParseNode[];
  start: number;
  end: number;
}

// A factory for the tree-building combinator and a printer.
const createTreeBuilder = () => {
  let root: ParseNode | null = null;
  const stack: ParseNode[] = [];

  const withTree = <T>(parser: Parser<T>, name: string): Parser<T> =>
    new Parser(state => {
      const node: ParseNode = { name, children: [], start: state.index, end: 0 };
      if (stack.length > 0) {
        stack[stack.length - 1].children.push(node);
      } else {
        root = node;
      }
      
      stack.push(node);
      const result = parser.run(state);
      stack.pop();
      
      node.end = result.type === 'success' ? result.state.index : state.index;
      if (result.type === 'success') node.value = result.value;
      
      return result;
    });

  const getTree = () => root;
  return { withTree, getTree };
};

// --- Usage ---
const { withTree, getTree } = createTreeBuilder();

const expression = withTree(
  sequence([
    withTree(number, 'operand'),
    withTree(str('+'), 'operator'),
    withTree(number, 'operand')
  ]),
  'expression'
);

expression.parse("5+3");
console.log(getTree());
// → { name: 'expression', start: 0, end: 3, children: [...] }
```

## 5. Aggregating and Reporting Multiple Errors

In applications like linters or validators, you want to collect all errors, not just the first one.

### Post-Parse Validation

The most straightforward approach is to parse successfully first, then run a series of validation functions on the result.

```typescript
// Assumes the existence of a parser `userObjectParser`
const validateUser = (user: User): ValidationError[] => {
  const errors: ValidationError[] = [];
  if (user.age < 0) {
    errors.push({ path: ['age'], message: 'Age cannot be negative.' });
  }
  if (!user.email.includes('@')) {
    errors.push({ path: ['email'], message: 'A valid email is required.' });
  }
  return errors;
};

// Run the parser, then the validator
const parsedUser = userObjectParser.parse(input);
const validationErrors = validateUser(parsedUser);

if (validationErrors.length > 0) {
  console.log("Validation failed:", validationErrors);
}
```

This approach separates parsing from validation, which is often the cleanest solution.

## 6. Testing Error Conditions

Your test suite should explicitly check that your parsers fail correctly on invalid input.

### Error Testing Utility

A simple helper function can make testing for specific errors much cleaner.

```typescript
const expectParseError = (parser: Parser<any>, input: string, expectedMessage: string | RegExp) => {
  expect(() => parser.parse(input)).toThrow(expectedMessage);
};

// Usage in Vitest/Jest tests
describe('Email parser', () => {
  it('should reject an email without a domain', () => {
    const parser = friendlyEmail; // from the 'label' example
    expectParseError(parser, 'user@', 'a valid email address');
  });
});
```