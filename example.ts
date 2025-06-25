import {
  Parser,
  str,
  number,
  regex,
  choice,
  sequence,
  sepBy,
  sepBy1,
  between,
  lazy,
  lexeme,
  succeed,
  eof,
} from './parser';

console.log("--- Running Parser Examples ---");

// =================================================================
// Example 1: Basic Parsers and Literals
// =================================================================
console.log("\n--- Example 1: Basic Parsers ---");

// `str` infers the literal type. Hover over `helloParser` in your IDE.
// It knows the type is `Parser<"hello">`.
const helloParser = str("hello");

// `choice` creates a parser whose result type is a union of its children.
// Hover over `protocolParser`. The type is `Parser<"http" | "https">`.
const protocolParser = choice([str("http"), str("https")]);

try {
  const result1 = helloParser.parse("hello");
  console.log('✅ Parsed "hello":', result1); // Type of result1 is "hello"

  const result2 = protocolParser.parse("https");
  console.log('✅ Parsed protocol:', result2); // Type of result2 is "http" | "https"

  // This would be a compile-time error if uncommented:
  // if (result2 === "ftp") { console.log("error"); }

} catch (e: any) {
  console.error("❌ " + e.message);
}


// =================================================================
// Example 2: Parsing a Comma-Separated List with `lexeme`
// =================================================================
console.log("\n--- Example 2: Comma-Separated List ---");

// The `lexeme` combinator is the key to handling whitespace easily.
// It wraps another parser and consumes any trailing whitespace,
// while preserving the original parser's result type.
const lexemeNumber = lexeme(number); // Type: Parser<number>
const comma = lexeme(str(","));      // Type: Parser<",">

// `sepBy1` parses one or more items separated by a separator.
// The use of `lexeme` means we don't have to worry about whitespace
// between numbers and commas.
const csvParser = sepBy1(lexemeNumber, comma);

try {
  const input = "  1,  2, 3,4,   5  ";
  const result = csvParser.parse(input);
  console.log(`✅ Parsed CSV "${input}":`, result); // Type of result is number[]

} catch (e: any) {
  console.error("❌ " + e.message);
}


// =================================================================
// Example 3: Parsing a Key-Value Configuration Format
// =================================================================
console.log("\n--- Example 3: Key-Value Pairs ---");

// Let's parse something like: `timeout = 100; user = "admin";`

// Primitives with whitespace handling
const equals = lexeme(str("="));
const semicolon = lexeme(str(";"));
const identifier = lexeme(regex(/[a-zA-Z_]+/));
const quotedString = lexeme(between(str('"'), choice([str('a'), str('b'), str('c'), str('d'), str('e'), str('f'), str('g')]), str('"')));
const numericValue = lexeme(number);

// A value can be a string or a number. Type is `Parser<string | number>`.
const valueParser = choice([quotedString, numericValue]);

// A single key-value assignment.
const assignmentParser = sequence([
  identifier,
  equals,
  valueParser,
  semicolon
])
// .map(([key, _eq, value, _semi]) => ({ [key]: value }));

// The full config parser is many assignments, combined into one object.
const configParser: Parser<Record<string, string | number>> = assignmentParser
  .many()
  .map(pairs => Object.assign({}, ...pairs));

try {
  const configInput = `
    retries = 3;
    user = "root";
    host = "127.0.0.1";
  `;
  const result = configParser.parse(configInput);
  console.log('✅ Parsed config object:', result);
  // The type of result is `Record<string, string | number>`

} catch (e: any) {
  console.error("❌ " + e.message);
}


// =================================================================
// Example 4: Recursive Parsing (Simple JSON)
// =================================================================
console.log("\n--- Example 4: Recursive JSON Parser ---");

type JsonValue = string | number | null | JsonValue[] | { [key: string]: JsonValue };

// We need `lazy` to define parsers that refer to themselves.
let jsonValueParser: Parser<JsonValue>;

const jsonStringParser = lexeme(between(str('"'), regex(/[^"]*/), str('"')));
const jsonNumberParser = lexeme(number);
const jsonNullParser = lexeme(str("null")).map(() => null);

// An array is a comma-separated list of JSON values between brackets.
const jsonArrayParser = lazy(() =>
  between(
    lexeme(str("[")),
    sepBy(jsonValueParser, lexeme(str(","))),
    lexeme(str("]"))
  )
);

// An object member is "key": value
const memberParser = lazy(() =>
  sequence([
    jsonStringParser,
    lexeme(str(":")),
    jsonValueParser
  ])
);

// An object is a comma-separated list of members between braces.
const jsonObjectParser = lazy(() =>
  between(
    lexeme(str("{")),
    sepBy(memberParser, lexeme(str(","))),
    lexeme(str("}"))
  ).map(pairs => {
    const obj: { [key: string]: JsonValue } = {};
    pairs.forEach(([key, _, value]) => {
      obj[key] = value;
    });
    return obj;
  })
);

// A JSON value is one of the above. This is where the recursion is tied together.
jsonValueParser = choice([
  jsonStringParser,
  jsonNumberParser,
  jsonNullParser,
  jsonArrayParser,
  jsonObjectParser
]);

// The final parser must parse a value and then hit the end of the file.
const fullJsonParser = jsonValueParser.skip(eof);

try {
  const jsonInput = `
    {
      "name": "type-safe-parser",
      "version": 1,
      "features": ["recursive", "type-safe", null],
      "owner": { "name": "You" }
    }
  `;
  const result = fullJsonParser.parse(jsonInput);
  console.log('✅ Parsed JSON object:', JSON.stringify(result, null, 2));

  // --- Test a failure case ---
  console.log('\nTesting an invalid JSON input...');
  const badJsonInput = `{ "key": "value", }`; // Trailing comma
  fullJsonParser.parse(badJsonInput);

} catch (e: any) {
  console.error("❌ " + e.message);
}


// =================================================================
// Example 5: Generator-Based Parser and Advanced Combinators
// =================================================================
console.log("\n--- Example 5: Generator-Based Parser & Advanced Combinators ---");

import { genParser, lookahead, negativeLookahead, notFollowedBy } from "./parser";

// --- Generator-based parser example ---
const genExample = genParser(function* () {
  const a: "a" = yield str("a");
  const n: number = yield number;
  return { a, n };
});

try {
  const result = genExample.parse("a123");
  console.log("✅ genParser parsed:", result); // { a: "a", n: 123 }
} catch (e: any) {
  console.error("❌ " + e.message);
}

// --- Lookahead example ---
const helloLookahead = lookahead(str("hello"));
try {
  // Lookahead succeeds but does not consume input
  const result = helloLookahead.and(str("hello2")).parse("hello2");
  console.log("✅ lookahead succeeded, input consumed by second parser:", result);
} catch (e: any) {
  console.error("❌ " + e.message);
}

// --- Negative lookahead example ---
const notHello = negativeLookahead(str("hello"));
try {
  // Succeeds because input does not start with "hello"
  const result = notHello.and(str("world")).parse("world");
  console.log("✅ negativeLookahead succeeded:", result);
  // Fails if input starts with "hello"
  notHello.parse("hello");
} catch (e: any) {
  console.error("❌ " + e.message);
}

// --- notFollowedBy example ---
const fooNotFollowedByBar = sequence([
  str("foo"),
  notFollowedBy(str("bar"))
]);
try {
  // Succeeds: "foo" not followed by "bar"
  const result = fooNotFollowedByBar.parse("foo!");
  console.log("✅ notFollowedBy succeeded:", result);
  // Fails: "foo" followed by "bar"
  fooNotFollowedByBar.parse("foobar");
} catch (e: any) {
  console.error("❌ " + e.message);
}

// =================================================================
// Example 6: Character Classes and Type-Safe Utilities
// =================================================================
console.log("\n--- Example 6: Character Classes & Type-Safe Utilities ---");

import { anyOf, charClass, astNode, regexp, recoverWith, tryCatch, skipUntil, label, context, memo, flatten, node, betweenMap, drop, pick, filter, optionalMap, ignore, leftRecursive } from "./parser";

// --- anyOf overloads ---
const digitParser = anyOf("0123456789"); // Parser<Digit>
const lowerParser = anyOf("abcdefghijklmnopqrstuvwxyz"); // Parser<Lower>
const customParser = anyOf("abc"); // Parser<"a"|"b"|"c">
console.log("anyOf('0123456789') parses:", digitParser.parse("5"));
console.log("anyOf('abc') parses:", customParser.parse("b"));

// --- charClass ---
const alphaParser = charClass("alpha"); // Parser<Alpha>
const whitespaceParser = charClass("whitespace"); // Parser<WhitespaceChar>
console.log("charClass('alpha') parses:", alphaParser.parse("Z"));
console.log("charClass('whitespace') parses:", whitespaceParser.parse("\n"));

// --- astNode ---
const numNodeParser = astNode("num", digitParser);
console.log("astNode('num', digitParser) parses:", numNodeParser.parse("7"));

// --- tagged template regex ---
const floatParser = regexp`[0-9]+\.[0-9]+`;
console.log("regexp`[0-9]+\\.[0-9]+` parses:", floatParser.parse("12.34"));

// --- error recovery: recoverWith ---
const fooOrBar = recoverWith(str("foo"), str("bar"));
console.log("recoverWith parses 'foo':", fooOrBar.parse("foo"));
console.log("recoverWith parses 'bar':", fooOrBar.parse("bar"));

// --- error recovery: tryCatch ---
const tryCatchParser = tryCatch(str("foo"), err => str("baz"));
console.log("tryCatch parses 'baz':", tryCatchParser.parse("baz"));

// --- error recovery: skipUntil ---
const skipUntilParser = skipUntil(str(";"));
console.log("skipUntil parses:", skipUntilParser.parse("abc;"));

// --- label/context ---
const labeled = label(str("x"), "Expected an 'x'");
try { labeled.parse("y"); } catch (e: any) { console.log("label error:", e.message); }
const contexted = context(str("y"), "Parsing y");
try { contexted.parse("z"); } catch (e: any) { console.log("context error:", e.message); }

// --- memo ---
const memoParser = memo(str("memo"));
console.log("memo parses:", memoParser.parse("memo"));

// --- flatten ---
const flatParser = flatten(sequence([str("a"), sequence([str("b"), str("c")])]));
console.log("flatten parses:", flatParser.parse("abc"));

// --- node ---
const nodeParser = node("id", str("id"));
console.log("node parses:", nodeParser.parse("id"));

// --- betweenMap ---
const betweenMapParser = betweenMap(str("["), number, str("]"), n => n * 2);
console.log("betweenMap parses:", betweenMapParser.parse("[42]"));

// --- drop ---
const dropParser = drop(str("!"));
console.log("drop parses:", dropParser.parse("!"));

// --- pick ---
const pickParser = pick(1)(sequence([str("a"), number]));
console.log("pick parses:", pickParser.parse("a123"));

// --- filter ---
const filterParser = filter(number, n => n > 0, "Must be positive");
console.log("filter parses:", filterParser.parse("42"));
try { filterParser.parse("-1"); } catch (e: any) { console.log("filter error:", e.message); }

// --- optionalMap ---
const evenParser = optionalMap(number, n => n % 2 === 0 ? n : null, "Must be even");
console.log("optionalMap parses:", evenParser.parse("24"));
try { evenParser.parse("13"); } catch (e: any) { console.log("optionalMap error:", e.message); }

// --- ignore ---
const ignoreParser = ignore(str(";"));
console.log("ignore parses:", ignoreParser.parse(";"));

// --- leftRecursive (demo: parses left-associative addition) ---
const leftRecExpr: Parser<number> = leftRecursive(() =>
  choice([
    sequence([leftRecExpr, str("+"), number]).map(([left, _, right]) => left + right),
    number
  ])
);
console.log("leftRecursive parses:", leftRecExpr.parse("1+2+3"));

// --- fromGrammar (stub) ---
import { fromGrammar } from "./parser";
try { fromGrammar("expr = number | '(' expr ')'"); } catch (e: any) { console.log("fromGrammar stub error:", e.message); }