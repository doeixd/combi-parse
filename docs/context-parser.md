# Context-Aware Parsing

This guide explains the concepts behind context-aware parsing and how to use the `ContextualParser` in Combi-Parse to build parsers for sophisticated, stateful languages like Python, YAML, or your own domain-specific language.

## Beyond Stateless Parsing

The core `Parser` is powerful, but it is fundamentally **stateless**. It knows its position in the input string, but it has no memory of what came before. This is perfect for many formats, but some languages have rules that depend on context:

-   In **Python**, the validity of an `if` statement depends on the surrounding indentation level.
-   In **YAML**, a key's meaning can change based on its nesting level.
-   In a programming language, `x = 5` is only valid if the variable `x` has been declared in the current **scope**.

To handle these, we need a parser that can maintain and react to a changing **context**.

## The Contextual Parser Approach

The `ContextualParser<T, C>` is a new type of parser designed specifically for this challenge.

> A `ContextualParser` is a parser that carries a custom, user-defined **context object** `C` throughout the entire parsing process. Every parser in the chain can read from, and write to, this shared context.

This turns parsing from a simple text-to-data transformation into a stateful analysis of the input.

## The Three Pillars of Contextual Parsing

### 1. 🏗️ The User-Defined Context: Your Parser's Brain

The context is a simple JavaScript object that you define. It acts as the short-term memory for your parser. It can hold anything you need to track.

```typescript
// For a Python-like language, the context needs to track indentation.
interface PythonContext {
  // A stack of indentation levels, e.g., [0, 4, 8]
  indentStack: number[]; 
}

// For a language with variables, the context needs a symbol table.
interface LanguageContext {
  // A stack of scopes, each containing defined variables.
  scopeStack: Map<string, 'variable' | 'function'>[];
}

// You pass an initial context when you start the parse.
const initialContext: PythonContext = { indentStack: [0] };
myPythonParser.parse(code, initialContext);
```

### 2. 🛗 Lifting: Entering the Contextual World

Your basic, stateless parsers (like `str`, `regex`, `number`) don't know anything about context. To use them in a contextual pipeline, you must "lift" them. The `lift` function wraps a base `Parser` to make it a `ContextualParser`. It runs the original parser but leaves the context untouched.

```typescript
import { lift } from '@combi-parse/parsers/contextual';
import { str } from 'combi-parse';

// `str('if')` is a base Parser<string>
// `lift(str('if'))` becomes a ContextualParser<string, MyContext>
const contextualIf = lift(str('if'));
```

Lifting is the bridge between the stateless and stateful worlds.

### 3. 🧠 Context-Aware Combinators: Reading and Writing State

Once you are in the contextual world, you can use a new set of powerful combinators to interact with the context.

```typescript
import { getContext, updateContext, withIndentation } from '@combi-parse/parsers/contextual';

// A parser that reads the current context and succeeds with it as its value.
const indentationLevel = getContext().map(ctx => ctx.indentStack.length);

// A parser that runs another parser, but modifies the context first.
const indentedBlock = withIncreasedIndentation(
  many(statementParser) // statementParser will run in a context where the indent level is +1
);

// A parser that modifies the context based on a parsed value.
const varDeclaration = lift(identifier).chain(varName => 
  // After parsing the name, update the context to include it.
  updateContext(ctx => {
    ctx.scopeStack.at(-1)!.set(varName, 'variable');
    return ctx;
  })
);
```

These combinators are the tools you use to encode the state-dependent rules of your language.

## A Practical Example: Indentation-Sensitive Parsing

Let's build a simple parser for a Python-like `if` statement. The rule is: the body of the `if` statement must be indented one level deeper than the `if` keyword itself.

#### 1. Define the Context

```typescript
// Our context needs to know the current indentation size and a stack of indent levels.
interface IndentContext {
  indentationSize: number;
  indentStack: number[];
}
```

#### 2. Create the Parser

We'll use high-level helpers like `withIndentation` and `withIncreasedIndentation` that are built from the core primitives (`getContext`, `updateContext`).

```typescript
import { lift, withIndentation, withIncreasedIndentation } from './contextual';
import { str, regex, newline, many, choice } from 'combi-parse';

// A forward-declaration for recursion
const statement: () => ContextualParser<any, IndentContext> = () => choice([
  ifStatement(),
  lift(str('pass')),
]);

// The parser for an `if` statement.
const ifStatement = (): ContextualParser<any, IndentContext> =>
  // Start with a lifted base parser for the 'if condition:' part.
  lift(
    str('if ').keepRight(regex(/.+/)).keepLeft(str(':')).keepLeft(newline)
  ).chain(condition =>
    // Now use a contextual combinator to handle the body.
    // This runs its inner parser in a context where the expected indent level is higher.
    withIncreasedIndentation(
      // The `many` combinator will now parse statements...
      many(
        // ...each of which must begin with the correct indentation.
        withIndentation(statement())
      )
    ).map(body => ({ type: 'if', condition, body }))
  );
```

#### 3. Run the Parser

```typescript
const pythonCode = `
if x > 10:
  pass
  if y < 5:
    pass
`.trim();

const initialContext: IndentContext = {
  indentationSize: 2,
  indentStack: [0], // Start at the root indentation level
};

// Running the parser
const ast = ifStatement().parse(pythonCode, initialContext);

console.log(JSON.stringify(ast, null, 2));
// Output:
// {
//   "type": "if",
//   "condition": "x > 10",
//   "body": [
//     "pass",
//     {
//       "type": "if",
//       "condition": "y < 5",
//       "body": [ "pass" ]
//     }
//   ]
// }
```

A parser written this way will automatically fail if the indentation is incorrect, because `withIndentation` checks the context's `indentStack` before attempting to parse.

## Summary: When to Use a Contextual Parser

-   **Stateless `Parser`**: Use for self-contained formats where the meaning of a token does not depend on its position or what came before. (e.g., JSON, CSV, arithmetic expressions).
-   **Stateful `ContextualParser`**: Use for complex languages where you need to track state across the parse, such as:
    -   Indentation levels.
    -   Variable scopes and symbol tables.
    -   Parser "modes" (e.g., inside a string vs. outside).

The `ContextualParser` unlocks the ability to parse a whole new class of complex, real-world languages with the same declarative and composable style you're used to from the core library.