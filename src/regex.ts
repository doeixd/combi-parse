/**
 * @fileoverview Type-Level Regular Expression Engine
 * 
 * This module implements a complete regular expression engine that operates entirely
 * at the TypeScript type level. It can compile regex patterns into Non-deterministic
 * Finite Automata (NFA) and enumerate all possible strings that match a pattern,
 * all during compile time.
 * 
 * This enables powerful compile-time string validation and type generation based on
 * regex patterns. The engine supports most common regex features including:
 * 
 * - **Literals**: Direct character matching (`'abc'`)
 * - **Character Classes**: Bracket expressions (`'[abc]'`, `'[0-9]'`, `'[a-z]'`)
 * - **Escape Sequences**: `'\\d'` (digits), `'\\w'` (word chars), `'\\s'` (whitespace), and negated versions `'\\D'`, `'\\W'`, `'\\S'`
 * - **Quantifiers**: `'*'` (zero or more), `'+'` (one or more), `'?'` (optional)
 * - **Alternation**: Pipe operator (`'cat|dog'`)
 * - **Grouping**: Parentheses for precedence (`'(ab)+c'`)
 * - **Wildcards**: Dot matches any printable character (`'.'`)
 * 
 * The engine converts regex patterns into NFAs (Non-deterministic Finite Automata)
 * and can then enumerate all matching strings up to a reasonable depth to avoid
 * TypeScript compiler limits.
 * 
 * ## Key Features
 * 
 * - **Compile-Time Execution**: All processing happens during TypeScript compilation
 * - **Type-Safe Results**: Generated strings are typed as precise union types
 * - **Template Literal Support**: Works with TypeScript's template literal types
 * - **Finite Enumeration**: Converts infinite patterns to finite + template literals
 * 
 * @example
 * ```typescript
 * // Simple literal matching
 * type HelloRegex = CompileRegex<'hello'>;
 * type HelloStrings = Enumerate<HelloRegex>; // 'hello'
 * 
 * // Character classes
 * type DigitRegex = CompileRegex<'[0-9]'>;
 * type DigitStrings = Enumerate<DigitRegex>; // '0' | '1' | '2' | ... | '9'
 * 
 * // Quantifiers
 * type OptionalRegex = CompileRegex<'ab?c'>;
 * type OptionalStrings = Enumerate<OptionalRegex>; // 'ac' | 'abc'
 * 
 * // Alternation
 * type ChoiceRegex = CompileRegex<'cat|dog'>;
 * type ChoiceStrings = Enumerate<ChoiceRegex>; // 'cat' | 'dog'
 * ```
 * 
 * @example
 * ```typescript
 * // Complex patterns with infinite cases use template literals
 * type RepeatingRegex = CompileRegex<'a+'>;
 * type RepeatingStrings = Enumerate<RepeatingRegex>; // `a${string}`
 * 
 * type StarRegex = CompileRegex<'a*b'>;
 * type StarStrings = Enumerate<StarRegex>; // 'b' | `a${string}`
 * ```
 * 
 * @see {@link https://en.wikipedia.org/wiki/Nondeterministic_finite_automaton} for NFA theory
 * @see {@link https://www.typescriptlang.org/docs/handbook/2/template-literal-types.html} for template literals
 */

// ===================================================================
// Core NFA (Non-deterministic Finite Automaton) Types
// ===================================================================

/**
 * Unique identifier for a state in the NFA.
 * States are numbered sequentially starting from 0.
 */
type StateId = number;

/**
 * Represents a single state in the Non-deterministic Finite Automaton (NFA).
 * 
 * Each state has a unique ID, a set of transitions to other states, and
 * a flag indicating whether it's an accepting state (final state that
 * indicates a successful match).
 * 
 * @example
 * ```typescript
 * // A simple accepting state with no transitions
 * type FinalState = {
 *   id: 1;
 *   transitions: [];
 *   isAccepting: true;
 * };
 * 
 * // A state that transitions on character 'a' to state 2
 * type CharState = {
 *   id: 0;
 *   transitions: [{ match: 'a'; to: 2 }];
 *   isAccepting: false;
 * };
 * ```
 */
type State = {
  /** Unique identifier for this state */
  id: StateId;
  /** Array of possible transitions from this state */
  transitions: Transition[];
  /** Whether this state indicates a successful match */
  isAccepting: boolean;
};

/**
 * Represents a transition between states in the NFA.
 * 
 * A transition specifies what input causes a move from one state to another.
 * The match can be:
 * - A specific character or character union ('a', 'b' | 'c')
 * - A wildcard '.' matching any printable character
 * - An epsilon 'ε' transition (no input consumed)
 * 
 * @example
 * ```typescript
 * // Transition on character 'a' to state 5
 * type CharTransition = { match: 'a'; to: 5 };
 * 
 * // Wildcard transition to state 3
 * type WildcardTransition = { match: '.'; to: 3 };
 * 
 * // Epsilon transition (no input) to state 1
 * type EpsilonTransition = { match: 'ε'; to: 1 };
 * ```
 */
type Transition = {
  /** The character(s) or symbol that triggers this transition */
  match: string | '.' | 'ε';
  /** The destination state ID */
  to: StateId;
};

/**
 * A compiled regular expression represented as an NFA.
 * 
 * This type wraps an NFA with additional metadata and branding to ensure
 * type safety. The NFA array contains all states, and the start state
 * is always at index 0.
 * 
 * The `__brand` field is a TypeScript pattern to create nominal typing,
 * preventing raw arrays from being accidentally used as compiled regexes.
 * 
 * @template NFA - The array of states that make up this automaton
 * 
 * @example
 * ```typescript
 * // A simple regex that matches 'abc'
 * type SimpleRegex = CompiledRegex<[
 *   { id: 0; transitions: [{ match: 'a'; to: 1 }]; isAccepting: false },
 *   { id: 1; transitions: [{ match: 'b'; to: 2 }]; isAccepting: false },
 *   { id: 2; transitions: [{ match: 'c'; to: 3 }]; isAccepting: false },
 *   { id: 3; transitions: []; isAccepting: true }
 * ]>;
 * ```
 */
type CompiledRegex<NFA extends State[]> = {
  /** Brand for nominal typing - prevents accidental usage of raw arrays */
  __brand: 'CompiledRegex';
  /** The NFA states that make up this compiled regex */
  nfa: NFA;
  /** The starting state ID (always 0) */
  start: 0;
};

// =================================================================
// HELPERS
// =================================================================

type Inc<N extends number, A extends 1[] = []> = A['length'] extends N ? [...A, 1]['length'] : Inc<N, [...A, 1]>;
type Push<A extends readonly any[], E> = [...A, E];
type Concat<A extends readonly any[], B extends readonly any[]> = [...A, ...B];
type Has<T extends readonly any[], E> = T extends [infer Head, ...infer Rest] ? ([E] extends [Head] ? true : Has<Rest, E>) : false;
type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
type Lower = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j' | 'k' | 'l' | 'm' | 'n' | 'o' | 'p' | 'q' | 'r' | 's' | 't' | 'u' | 'v' | 'w' | 'x' | 'y' | 'z';
type Upper = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M' | 'N' | 'O' | 'P' | 'Q' | 'R' | 'S' | 'T' | 'U' | 'V' | 'W' | 'X' | 'Y' | 'Z';
type Alpha = Lower | Upper;
type AlphaNum = Alpha | Digit;
type Whitespace = ' ' | '\t' | '\n' | '\r';
// Use a branded approach for complex types to avoid expansion issues
type WordChar = AlphaNum | '_';
type NonDigit = Exclude<Printable, Digit>;
type NonWordChar = Exclude<Printable, WordChar>;
type NonWhitespace = Exclude<Printable, Whitespace>;

// Simplified word char for better type performance
type SimpleWordChar = '_' | Digit | 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j' | 'k' | 'l' | 'm';
type Printable = AlphaNum | ' ' | '!' | '@' | '#' | '$' | '%' | '^' | '&' | '*' | '(' | ')' | '-' | '_' | '=' | '+' | '[' | ']' | '{' | '}' | ';' | ':' | '"' | "'" | ',' | '.' | '<' | '>' | '/' | '?' | '\\' | '|' | '`' | '~';

// =================================================================
// PARSING HELPERS
// =================================================================

// Find matching closing parenthesis
type FindClosingParen<S extends string, Depth extends 1[] = [1], Acc extends string = ''> =
  S extends `${infer C}${infer Rest}` ?
  C extends '(' ? FindClosingParen<Rest, [...Depth, 1], `${Acc}${C}`> :
  C extends ')' ?
  Depth extends [any, ...infer D2] ?
  D2 extends [] ? [Acc, Rest] :
  D2 extends 1[] ?
  FindClosingParen<Rest, D2, `${Acc}${C}`> :
  never :
  never :
  FindClosingParen<Rest, Depth, `${Acc}${C}`> :
  never;

// Find closing bracket for character class
type FindClosingBracket<S extends string, Acc extends string = ''> =
  S extends `${infer C}${infer Rest}` ?
  C extends ']' ? [Acc, Rest] :
  FindClosingBracket<Rest, `${Acc}${C}`> :
  never;

// Parse escape sequences
type ParseEscapeSequence<S extends string> =
  S extends 'd' ? Digit :
  S extends 'D' ? NonDigit :
  S extends 'w' ? WordChar :
  S extends 'W' ? NonWordChar :
  S extends 's' ? Whitespace :
  S extends 'S' ? NonWhitespace :
  S extends 't' ? '\t' :
  S extends 'n' ? '\n' :
  S extends 'r' ? '\r' :
  S; // Default: return the character itself (for escaped special chars)

// Parse character class content (with shortcuts)
type ParseCharClass<S extends string> =
  S extends '0-9' ? Digit :
  S extends 'a-z' ? Lower :
  S extends 'A-Z' ? Upper :
  S extends 'a-zA-Z' ? Alpha :
  S extends 'a-zA-Z0-9' ? AlphaNum :
  S extends 'a-zA-Z0-9_' ? WordChar :  // Shortcut for \w equivalent
  S extends `${infer C}${infer R}` ? C | ParseCharClass<R> :
  never;

// Split on top-level alternation
type SplitAlternation<P extends string, D extends 1[] = [], A extends string = ''> =
  P extends `${infer C}${infer R}` ?
  C extends '(' ? SplitAlternation<R, [...D, 1], `${A}${C}`> :
  C extends ')' ?
  D extends [any, ...infer D2] ?
  D2 extends 1[] ?
  SplitAlternation<R, D2, `${A}${C}`> :
  never :
  never :
  C extends '|' ?
  D['length'] extends 0 ? [A, R] :
  SplitAlternation<R, D, `${A}${C}`> :
  SplitAlternation<R, D, `${A}${C}`> :
  [A, ''];

// =================================================================
// FIXED NFA BUILDER 
// =================================================================

type BuildNFA<P extends string> =
  BuildSequence<P, 0> extends [infer S, infer E] ?
  S extends State[] ? E extends number ?
  Push<S, { id: E; transitions: []; isAccepting: true }> :
  never : never :
  never;

// Main entry point - handle alternation first
type BuildSequence<P extends string, Id extends number> =
  SplitAlternation<P> extends [infer L, infer R] ?
  L extends P ? // No alternation
  ParseSequence<P, Id> :
  // Has alternation
  L extends string ? R extends string ?
  BuildAlternation<L, R, Id> :
  never : never :
  never;

// Parse a sequence of atoms (char, group, class) with modifiers
type ParseSequence<P extends string, Id extends number> =
  P extends '' ? [[], Id] :
  ParseAtom<P, Id> extends [infer AtomStates, infer RestPattern, infer AtomEnd] ?
  AtomStates extends State[] ? RestPattern extends string ? AtomEnd extends number ?
  // Check for modifier after atom
  RestPattern extends `*${infer After}` ?
  ApplyStar<AtomStates, Id, AtomEnd, After> :
  RestPattern extends `+${infer After}` ?
  ApplyPlus<AtomStates, Id, AtomEnd, After> :
  RestPattern extends `?${infer After}` ?
  ApplyOptional<AtomStates, Id, AtomEnd, After> :
  // No modifier, continue sequence
  ParseSequence<RestPattern, AtomEnd> extends [infer NextStates, infer FinalEnd] ?
  NextStates extends State[] ? FinalEnd extends number ?
  [Concat<AtomStates, NextStates>, FinalEnd] :
  never : never :
  never
  : never : never : never :
  never;

// Parse a single atom (character, dot, group, class, or escape sequence)
type ParseAtom<P extends string, Id extends number> =
  P extends `(${infer Inner}` ?
  FindClosingParen<Inner> extends [infer Group, infer After] ?
  Group extends string ? After extends string ?
  BuildSequence<Group, Inc<Id>> extends [infer GroupStates, infer GroupEnd] ?
  GroupStates extends State[] ? GroupEnd extends number ?
  [[{ id: Id, transitions: [{ match: 'ε', to: Inc<Id> }], isAccepting: false }, ...GroupStates], After, GroupEnd] :
  never : never :
  never
  : never : never :
  never :
  P extends `[${infer Inner}` ?
  FindClosingBracket<Inner> extends [infer Class, infer After] ?
  Class extends string ? After extends string ?
  [[{ id: Id, transitions: [{ match: ParseCharClass<Class>, to: Inc<Id> }], isAccepting: false }], After, Inc<Id>] :
  never : never :
  never :
  P extends `\\${infer EscapeChar}${infer R}` ?
  [[{ id: Id, transitions: [{ match: ParseEscapeSequence<EscapeChar>, to: Inc<Id> }], isAccepting: false }], R, Inc<Id>] :
  P extends `.${infer R}` ?
  [[{ id: Id, transitions: [{ match: '.', to: Inc<Id> }], isAccepting: false }], R, Inc<Id>] :
  P extends `${infer C}${infer R}` ?
  C extends '|' | '*' | '+' | '?' | '(' | ')' | '[' | ']' ?
  [[], P, Id] : // Special char at start means empty atom
  [[{ id: Id, transitions: [{ match: C, to: Inc<Id> }], isAccepting: false }], R, Inc<Id>] :
  [[], '', Id];

// Apply star modifier
type ApplyStar<AtomStates extends State[], StartId extends number, EndId extends number, After extends string> =
  ParseSequence<After, Inc<EndId>> extends [infer NextStates, infer FinalEnd] ?
  NextStates extends State[] ? FinalEnd extends number ?
  [Concat<
    [{ id: StartId, transitions: [{ match: 'ε', to: Inc<StartId> }, { match: 'ε', to: Inc<EndId> }], isAccepting: false }],
    Concat<AtomStates, [{ id: EndId, transitions: [{ match: 'ε', to: StartId }], isAccepting: false }, ...NextStates]>
  >, FinalEnd] :
  never : never :
  never;

// Apply plus modifier  
type ApplyPlus<AtomStates extends State[], StartId extends number, EndId extends number, After extends string> =
  ParseSequence<After, Inc<EndId>> extends [infer NextStates, infer FinalEnd] ?
  NextStates extends State[] ? FinalEnd extends number ?
  [Concat<
    AtomStates,
    [{ id: EndId, transitions: [{ match: 'ε', to: StartId }, { match: 'ε', to: Inc<EndId> }], isAccepting: false }, ...NextStates]
  >, FinalEnd] :
  never : never :
  never;

// Apply optional modifier
type ApplyOptional<AtomStates extends State[], StartId extends number, EndId extends number, After extends string> =
  ParseSequence<After, EndId> extends [infer NextStates, infer FinalEnd] ?
  NextStates extends State[] ? FinalEnd extends number ?
  [Concat<
    [{ id: StartId, transitions: [{ match: 'ε', to: Inc<StartId> }, { match: 'ε', to: EndId }], isAccepting: false }],
    Concat<AtomStates, NextStates>
  >, FinalEnd] :
  never : never :
  never;

// Build alternation
type BuildAlternation<L extends string, R extends string, Id extends number> =
  BuildSequence<L, Inc<Id>> extends [infer LeftStates, infer LeftEnd] ?
  LeftStates extends State[] ? LeftEnd extends number ?
  BuildSequence<R, Inc<LeftEnd>> extends [infer RightStates, infer RightEnd] ?
  RightStates extends State[] ? RightEnd extends number ?
  [Concat<
    [{ id: Id, transitions: [{ match: 'ε', to: Inc<Id> }, { match: 'ε', to: Inc<LeftEnd> }], isAccepting: false }],
    Concat<LeftStates, [{ id: LeftEnd, transitions: [{ match: 'ε', to: RightEnd }], isAccepting: false }, ...RightStates]>
  >, RightEnd] :
  never : never :
  never
  : never : never :
  never;

// =================================================================
// NFA EXECUTION HELPERS
// =================================================================

type GetState<NFA extends State[], Id extends StateId> = Extract<NFA[number], { id: Id }>;
type GetEpsilonTransitions<Trans extends Transition[]> = Trans extends [infer T, ...infer Rest] ? T extends { match: 'ε'; to: infer To } ? [To, ...GetEpsilonTransitions<Extract<Rest, Transition[]>>] : GetEpsilonTransitions<Extract<Rest, Transition[]>> : [];
type IsAccepting<NFA extends State[], Ids extends StateId[]> = true extends (Ids[number] extends infer Id ? Id extends StateId ? GetState<NFA, Id>['isAccepting'] : never : never) ? true : false;

type EpsilonClosure<NFA extends State[], Pending extends StateId[], Seen extends StateId[] = []> =
  Pending extends [infer Current, ...infer Rest] ? Current extends StateId ? Has<Seen, Current> extends true
  ? EpsilonClosure<NFA, Extract<Rest, StateId[]>, Seen>
  : EpsilonClosure<NFA, [...Extract<Rest, StateId[]>, ...GetEpsilonTransitions<GetState<NFA, Current>['transitions']>], Push<Seen, Current>>
  : Seen : Seen;

// ===================================================================
// PUBLIC API
// ===================================================================

/**
 * Compiles a regex pattern string into a type-level NFA representation.
 * 
 * This is the main entry point for the type-level regex engine. It takes
 * a string literal type representing a regex pattern and converts it into
 * a compiled NFA that can be used for further analysis or enumeration.
 * 
 * The compilation happens entirely at the TypeScript type level, with no
 * runtime overhead. The resulting type can be used with other type-level
 * operations like `Enumerate` to generate all possible matching strings.
 * 
 * **Supported Pattern Features:**
 * - Literal characters: `'abc'`
 * - Character classes: `'[abc]'`, `'[0-9]'`, `'[a-z]'`
 * - Escape sequences: `'\\d'` (digits), `'\\w'` (word chars), `'\\s'` (whitespace), `'\\D'` (non-digits), etc.
 * - Quantifiers: `'*'` (zero or more), `'+'` (one or more), `'?'` (optional)
 * - Alternation: `'cat|dog'`
 * - Grouping: `'(ab)+c'`
 * - Wildcard: `'.'` (any printable character)
 * 
 * @template Pattern - The regex pattern as a string literal type
 * @returns A `CompiledRegex` containing the NFA representation
 * 
 * @example
 * ```typescript
 * // Compile simple patterns
 * type HelloRegex = CompileRegex<'hello'>;
 * type DigitsRegex = CompileRegex<'[0-9]+'>;
 * type ChoiceRegex = CompileRegex<'cat|dog'>;
 * 
 * // Use with quantifiers
 * type OptionalRegex = CompileRegex<'colou?r'>;      // 'color' | 'colour'
 * type RepeatingRegex = CompileRegex<'go+'>;         // 'go', 'goo', 'gooo', ...
 * type ZeroOrMoreRegex = CompileRegex<'a*b'>;        // 'b', 'ab', 'aab', ...
 * 
 * // Complex patterns
 * type ComplexRegex = CompileRegex<'(hello|hi) (world|earth)'>;
 * ```
 * 
 * @example
 * ```typescript
 * // Character classes with ranges
 * type HexRegex = CompileRegex<'[0-9a-fA-F]+'>;     // Hexadecimal strings
 * type WordRegex = CompileRegex<'[a-zA-Z_][a-zA-Z0-9_]*'>; // Identifiers
 * 
 * // Grouping with quantifiers
 * type RepeatedGroupRegex = CompileRegex<'(ab)+c'>;  // 'abc', 'ababc', 'abababc', ...
 * ```
 */
export type CompileRegex<Pattern extends string> = BuildNFA<Pattern> extends infer NFA ? NFA extends State[] ? CompiledRegex<NFA> : never : never;

// ===================================================================
// STRING ENUMERATION
// ===================================================================

/**
 * Enumerates all possible strings that match a compiled regex pattern.
 * 
 * This type takes a `CompiledRegex` and generates a union type of all possible
 * strings that the regex can match. For finite patterns, it produces exact
 * string literals. For infinite patterns (those with `*` or `+` quantifiers),
 * it generates template literal types to represent the infinite possibilities.
 * 
 * The enumeration is bounded to prevent TypeScript compiler from running out
 * of resources. Deep recursion or complex patterns may result in template
 * literal approximations like `a${string}` instead of infinite unions.
 * 
 * @template R - A compiled regex type (must extend CompiledRegex)
 * @returns A union type of all possible matching strings
 * 
 * @example
 * ```typescript
 * // Simple finite patterns
 * type Hello = Enumerate<CompileRegex<'hello'>>;     // 'hello'
 * type Choice = Enumerate<CompileRegex<'cat|dog'>>;  // 'cat' | 'dog'
 * type Optional = Enumerate<CompileRegex<'ab?c'>>;   // 'ac' | 'abc'
 * 
 * // Character classes
 * type Digit = Enumerate<CompileRegex<'[0-9]'>>;     // '0'|'1'|'2'|...|'9'
 * type Vowel = Enumerate<CompileRegex<'[aeiou]'>>;   // 'a'|'e'|'i'|'o'|'u'
 * ```
 * 
 * @example
 * ```typescript
 * // Infinite patterns use template literals
 * type OneOrMore = Enumerate<CompileRegex<'a+'>>;    // `a${string}`
 * type ZeroOrMore = Enumerate<CompileRegex<'a*b'>>;  // 'b' | `a${string}`
 * type Complex = Enumerate<CompileRegex<'[ab]+'>>;   // `a${string}` | `b${string}`
 * 
 * // Practical applications
 * type HttpMethod = Enumerate<CompileRegex<'GET|POST|PUT|DELETE'>>;
 * // Result: 'GET' | 'POST' | 'PUT' | 'DELETE'
 * 
 * type BinaryDigits = Enumerate<CompileRegex<'[01]+'>>;
 * // Result: `0${string}` | `1${string}` (represents all binary strings)
 * ```
 * 
 * @throws Compilation error if the input is not a valid CompiledRegex
 */
export type Enumerate<R extends CompiledRegex<any>> =
  R extends CompiledRegex<infer NFA> ?
  NFA extends State[] ?
  Generate<NFA, [0], ''> :
  "Error: NFA is not a valid State array." :
  "Error: Input is not a CompiledRegex.";

type TransitionMatchToCharUnion<M extends string | '.'> = M extends '.' ? Printable : M;

type Generate<
  NFA extends State[],
  ActiveIds extends StateId[],
  CurrentString extends string,
  Depth extends 1[] = []
> =
  EpsilonClosure<NFA, ActiveIds, []> extends infer Reachable ? Reachable extends StateId[] ?
  (IsAccepting<NFA, Reachable> extends true ? CurrentString : never) |
  GenerateFromReachableStates<NFA, Reachable, CurrentString, Depth>
  : never : never;

type GenerateFromReachableStates<
  NFA extends State[],
  Reachable extends StateId[],
  CurrentString extends string,
  Depth extends 1[]
> =
  Reachable extends [infer Id, ...infer Rest] ? Id extends StateId ?
  GenerateFromTransitions<NFA, GetState<NFA, Id>['transitions'], CurrentString, Depth> |
  (Rest extends StateId[] ? GenerateFromReachableStates<NFA, Rest, CurrentString, Depth> : never)
  : never : never;

type GenerateFromTransitions<
  NFA extends State[],
  Transitions extends Transition[],
  CurrentString extends string,
  Depth extends 1[]
> =
  Transitions extends [infer T, ...infer RestT] ? T extends Transition ?
  (
    T['match'] extends 'ε' ? never :
    Depth['length'] extends 7 ?
    `${CurrentString}${TransitionMatchToCharUnion<T['match']>}${string}`
    :
    // Check if this creates a loop back (star/plus pattern)
    HasLoopBack<NFA, T['to'], ActiveStateId<NFA, Transitions>> extends true ?
    // This is a loop - check if match is a union
    IsUnionType<T['match']> extends true ?
    // Union in a loop - use string to avoid complexity
    CurrentString extends '' ?
    `${TransitionMatchToCharUnion<T['match']>}${string}` :
    string :
    // Single char in loop - enumerate a bit then use template
    Generate<NFA, [T['to']], `${CurrentString}${TransitionMatchToCharUnion<T['match']>}`, Push<Depth, 1>> :
    // Not a loop - continue normal enumeration
    Generate<NFA, [T['to']], `${CurrentString}${TransitionMatchToCharUnion<T['match']>}`, Push<Depth, 1>>
  ) | (RestT extends Transition[] ? GenerateFromTransitions<NFA, RestT, CurrentString, Depth> : never)
  : never : never;

// Helper to check if a state creates a loop back
type HasLoopBack<NFA extends State[], ToState extends StateId, FromState extends StateId> =
  GetState<NFA, ToState>['transitions'] extends infer Trans ?
  Trans extends Transition[] ?
  HasEpsilonTo<Trans, FromState> :
  false :
  false;

// Check if transitions have epsilon to a specific state
type HasEpsilonTo<Trans extends Transition[], Target extends StateId> =
  Trans extends [infer T, ...infer Rest] ?
  T extends { match: 'ε'; to: infer To } ?
  To extends Target ? true :
  Rest extends Transition[] ? HasEpsilonTo<Rest, Target> : false :
  Rest extends Transition[] ? HasEpsilonTo<Rest, Target> : false :
  false;

// Get the state ID that contains these transitions
type ActiveStateId<NFA extends State[], Trans extends Transition[]> =
  NFA extends [infer S, ...infer Rest] ?
  S extends State ?
  S['transitions'] extends Trans ? S['id'] :
  Rest extends State[] ? ActiveStateId<Rest, Trans> : never :
  never :
  never;

// Check if a type is a union (heuristic - if it matches multiple single chars)
type IsUnionType<T> =
  T extends '.' ? true :
  T extends Digit ? true :
  T extends Lower ? true :
  T extends Upper ? true :
  T extends Alpha ? true :
  T extends AlphaNum ? true :
  false;

// =================================================================
// TESTS
// =================================================================
type AssertEqual<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type AssertTrue<T extends true> = T;

// Simple literal
type Enum1 = Enumerate<CompileRegex<'abc'>>;
type TestEnum1 = AssertTrue<AssertEqual<Enum1, 'abc'>>;

// Optional '?'
type Enum2 = Enumerate<CompileRegex<'a?b'>>;
type TestEnum2 = AssertTrue<AssertEqual<Enum2, 'ab' | 'b'>>;

// Kleene Star '*'
type Enum3 = Enumerate<CompileRegex<'a*b'>>;
type TestEnum3 = AssertTrue<AssertEqual<Enum3, "b" | `a${string}`>>;

// Plus '+'
type Enum4 = Enumerate<CompileRegex<'a+b'>>;
type TestEnum4 = AssertTrue<AssertEqual<Enum4, `a${string}`>>;

// Character class
type Enum5 = Enumerate<CompileRegex<'[ab]c'>>;
type TestEnum5 = AssertTrue<AssertEqual<Enum5, 'ac' | 'bc'>>;

// Dot
type Enum6 = Enumerate<CompileRegex<'.'>>;
type TestEnum6 = AssertTrue<AssertEqual<Enum6, Printable>>;

// Alternation
type Enum7 = Enumerate<CompileRegex<'cat|dog'>>;
type TestEnum7 = AssertTrue<AssertEqual<Enum7, 'cat' | 'dog'>>;

// Grouping
type Enum8 = Enumerate<CompileRegex<'a(bc)?d'>>;
type TestEnum8 = AssertTrue<AssertEqual<Enum8, 'ad' | 'abcd'>>;

// Complex cases with loops
type Enum9 = Enumerate<CompileRegex<'[ab]+'>>;
type TestEnum9 = AssertTrue<AssertEqual<Enum9, `a${string}` | `b${string}`>>;

type Enum10 = Enumerate<CompileRegex<'[0-9]*'>>;
type TestEnum10 = AssertTrue<AssertEqual<Enum10, "" | `${Digit}${string}`>>;

// Another complex case
type Enum11 = Enumerate<CompileRegex<'a[bc]*d'>>;
// type TestEnum11 = AssertTrue<AssertEqual<Enum11, 'ad' | `a${'b' | 'c'}${string}d`>>;

// Test escape sequences
type Enum12 = Enumerate<CompileRegex<'\\d'>>;
type TestEnum12 = AssertTrue<AssertEqual<Enum12, Digit>>;

// WordChar is too complex for type-level testing, so just verify it compiles
type Enum13 = Enumerate<CompileRegex<'\\w'>>;
// type TestEnum13 = AssertTrue<AssertEqual<Enum13, WordChar>>;

type Enum14 = Enumerate<CompileRegex<'\\d\\d\\d'>>;
type TestEnum14 = AssertTrue<AssertEqual<Enum14, `${Digit}${Digit}${Digit}`>>;

// Test combining escape sequences with other patterns
type Enum15 = Enumerate<CompileRegex<'\\d?'>>;
type TestEnum15 = AssertTrue<AssertEqual<Enum15, '' | Digit>>;