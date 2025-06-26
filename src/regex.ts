// // =================================================================
// // TYPE-LEVEL REGEX ENGINE V5 - CLEAN IMPLEMENTATION
// // =================================================================

// // Core types
// type StateId = number;

// // NFA State
// type State = {
//   id: StateId;
//   transitions: Transition[];
//   isAccepting: boolean;
// };

// // Transition in NFA
// type Transition = {
//   match: string | '.' | 'ε';  // 'ε' for epsilon transitions
//   to: StateId;
// };

// // Compiled Regex type - this is what gets stored
// type CompiledRegex<NFA extends State[]> = {
//   __brand: 'CompiledRegex';
//   nfa: NFA;
//   start: 0;
// };

// // =================================================================
// // HELPERS
// // =================================================================

// // Increment number
// type Inc<N extends number, A extends 1[] = []> = 
//   A['length'] extends N ? [...A, 1]['length'] : Inc<N, [...A, 1]>;

// // Array operations
// type Push<A extends readonly any[], E> = [...A, E];
// type Concat<A extends readonly any[], B extends readonly any[]> = [...A, ...B];
// type Has<A extends readonly any[], E> = E extends A[number] ? true : false;

// // String to character union
// type CharUnion<S extends string> = S extends `${infer C}${infer R}` ? C | CharUnion<R> : never;

// // Character classes
// type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
// type Lower = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j' | 'k' | 'l' | 'm' | 'n' | 'o' | 'p' | 'q' | 'r' | 's' | 't' | 'u' | 'v' | 'w' | 'x' | 'y' | 'z';
// type Upper = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M' | 'N' | 'O' | 'P' | 'Q' | 'R' | 'S' | 'T' | 'U' | 'V' | 'W' | 'X' | 'Y' | 'Z';
// type Alpha = Lower | Upper;
// type AlphaNum = Alpha | Digit;
// type Printable = AlphaNum | ' ' | '!' | '@' | '#' | '$' | '%' | '^' | '&' | '*' | '(' | ')' | '-' | '_' | '=' | '+' | '[' | ']' | '{' | '}' | ';' | ':' | '"' | "'" | ',' | '.' | '<' | '>' | '/' | '?' | '\\' | '|' | '`' | '~';

// // Parse character class
// type ParseCharClass<S extends string> = 
//   S extends `^${infer Rest}` ? Exclude<Printable, ParsePosClass<Rest>> :
//   ParsePosClass<S>;

// type ParsePosClass<S extends string> = 
//   S extends 'a-z' ? Lower :
//   S extends 'A-Z' ? Upper :
//   S extends '0-9' ? Digit :
//   S extends `${infer C}${infer Rest}` ? C | ParsePosClass<Rest> :
//   never;

// // =================================================================
// // NFA BUILDER - SIMPLE VERSION
// // =================================================================

// // Build a simple NFA from pattern (no alternation for now)
// type BuildNFA<Pattern extends string, Id extends number = 0> = 
//   BuildFragment<Pattern, Id> extends [infer States, infer End] ?
//     States extends State[] ? End extends number ?
//       // Add accepting state
//       Push<States, { id: End; transitions: []; isAccepting: true }> :
//     never : never : never;

// // Build NFA fragment, returns [states, endId]
// type BuildFragment<P extends string, Id extends number> = 
//   // Character class with quantifiers
//   P extends `[${infer Class}]+${infer Rest}` ?
//     BuildPlus<ParseCharClass<Class>, Rest, Id> :
//   P extends `[${infer Class}]*${infer Rest}` ?
//     BuildStar<ParseCharClass<Class>, Rest, Id> :
//   P extends `[${infer Class}]?${infer Rest}` ?
//     BuildOptional<ParseCharClass<Class>, Rest, Id> :
//   P extends `[${infer Class}]${infer Rest}` ?
//     BuildChar<ParseCharClass<Class>, Rest, Id> :
  
//   // Single char with quantifiers  
//   P extends `${infer C}+${infer Rest}` ?
//     C extends '.' | '(' | ')' | '[' | ']' | '*' | '+' | '?' | '|' ? BuildFragment<P, Id> :
//     BuildPlus<C, Rest, Id> :
//   P extends `${infer C}*${infer Rest}` ?
//     C extends '.' | '(' | ')' | '[' | ']' | '*' | '+' | '?' | '|' ? BuildFragment<P, Id> :
//     BuildStar<C, Rest, Id> :
//   P extends `${infer C}?${infer Rest}` ?
//     C extends '.' | '(' | ')' | '[' | ']' | '*' | '+' | '?' | '|' ? BuildFragment<P, Id> :
//     BuildOptional<C, Rest, Id> :
    
//   // Dot
//   P extends `.${infer Rest}` ?
//     BuildChar<'.', Rest, Id> :
    
//   // Groups
//   P extends `(${infer Group})${infer Rest}` ?
//     BuildGroup<Group, Rest, Id, false> :
//   P extends `(${infer Group})?${infer Rest}` ?
//     BuildGroup<Group, Rest, Id, true> :
//   P extends `(${infer Group})*${infer Rest}` ?
//     BuildGroupStar<Group, Rest, Id> :
//   P extends `(${infer Group})+${infer Rest}` ?
//     BuildGroupPlus<Group, Rest, Id> :
    
//   // Alternation
//   P extends `${infer Left}|${infer Right}` ?
//     SplitAlternation<P> extends [infer L, infer R] ?
//       L extends string ? R extends string ?
//         BuildAlternation<L, R, Id> :
//       BuildChar<P extends `${infer C}${any}` ? C : never, P extends `${any}${infer Rest}` ? Rest : '', Id> :
//     BuildChar<P extends `${infer C}${any}` ? C : never, P extends `${any}${infer Rest}` ? Rest : '', Id> :
//     BuildChar<P extends `${infer C}${any}` ? C : never, P extends `${any}${infer Rest}` ? Rest : '', Id> :
    
//   // Regular character
//   P extends `${infer C}${infer Rest}` ?
//     BuildChar<C, Rest, Id> :
    
//   // Empty
//   [[], Id];

// // Build single character transition
// type BuildChar<C extends string, Rest extends string, Id extends number> = 
//   BuildFragment<Rest, Inc<Id>> extends [infer RestStates, infer RestEnd] ?
//     RestStates extends State[] ? RestEnd extends number ?
//       [[
//         { id: Id; transitions: [{ match: C; to: Inc<Id> }]; isAccepting: false },
//         ...RestStates
//       ], RestEnd] :
//     never : never : never;

// // Build a+ (one or more)
// type BuildPlus<C extends string, Rest extends string, Id extends number> = 
//   // First occurrence is required
//   // Then epsilon back for more
//   BuildFragment<Rest, Inc<Inc<Id>>> extends [infer RestStates, infer RestEnd] ?
//     RestStates extends State[] ? RestEnd extends number ?
//       [[
//         { id: Id; transitions: [{ match: C; to: Inc<Id> }]; isAccepting: false },
//         { id: Inc<Id>; transitions: [{ match: 'ε'; to: Id }, { match: 'ε'; to: Inc<Inc<Id>> }]; isAccepting: false },
//         ...RestStates
//       ], RestEnd] :
//     never : never : never;

// // Build a* (zero or more)
// type BuildStar<C extends string, Rest extends string, Id extends number> = 
//   BuildFragment<Rest, Inc<Inc<Id>>> extends [infer RestStates, infer RestEnd] ?
//     RestStates extends State[] ? RestEnd extends number ?
//       [[
//         { id: Id; transitions: [{ match: 'ε'; to: Inc<Id> }, { match: 'ε'; to: Inc<Inc<Id>> }]; isAccepting: false },
//         { id: Inc<Id>; transitions: [{ match: C; to: Id }]; isAccepting: false },
//         ...RestStates
//       ], RestEnd] :
//     never : never : never;

// // Build a? (zero or one)
// type BuildOptional<C extends string, Rest extends string, Id extends number> = 
//   BuildFragment<Rest, Inc<Inc<Id>>> extends [infer RestStates, infer RestEnd] ?
//     RestStates extends State[] ? RestEnd extends number ?
//       [[
//         { id: Id; transitions: [{ match: 'ε'; to: Inc<Id> }, { match: 'ε'; to: Inc<Inc<Id>> }]; isAccepting: false },
//         { id: Inc<Id>; transitions: [{ match: C; to: Inc<Inc<Id>> }]; isAccepting: false },
//         ...RestStates
//       ], RestEnd] :
//     never : never : never;

// // Build group
// type BuildGroup<Group extends string, Rest extends string, Id extends number, IsOptional extends boolean> = 
//   BuildFragment<Group, Inc<Id>> extends [infer GroupStates, infer GroupEnd] ?
//     GroupStates extends State[] ? GroupEnd extends number ?
//       BuildFragment<Rest, Inc<GroupEnd>> extends [infer RestStates, infer RestEnd] ?
//         RestStates extends State[] ? RestEnd extends number ?
//           IsOptional extends true ?
//             // Optional group - add epsilon to skip
//             [[
//               { id: Id; transitions: [{ match: 'ε'; to: Inc<Id> }, { match: 'ε'; to: Inc<GroupEnd> }]; isAccepting: false },
//               ...GroupStates,
//               { id: GroupEnd; transitions: [{ match: 'ε'; to: Inc<GroupEnd> }]; isAccepting: false },
//               ...RestStates
//             ], RestEnd] :
//             // Regular group
//             [[
//               { id: Id; transitions: [{ match: 'ε'; to: Inc<Id> }]; isAccepting: false },
//               ...GroupStates,
//               { id: GroupEnd; transitions: [{ match: 'ε'; to: Inc<GroupEnd> }]; isAccepting: false },
//               ...RestStates
//             ], RestEnd] :
//         never : never : never : never :
//     never : never : never;

// // Build group*
// type BuildGroupStar<Group extends string, Rest extends string, Id extends number> = 
//   BuildFragment<Group, Inc<Inc<Id>>> extends [infer GroupStates, infer GroupEnd] ?
//     GroupStates extends State[] ? GroupEnd extends number ?
//       BuildFragment<Rest, Inc<Inc<GroupEnd>>> extends [infer RestStates, infer RestEnd] ?
//         RestStates extends State[] ? RestEnd extends number ?
//           [[
//             { id: Id; transitions: [{ match: 'ε'; to: Inc<Id> }, { match: 'ε'; to: Inc<Inc<GroupEnd>> }]; isAccepting: false },
//             { id: Inc<Id>; transitions: [{ match: 'ε'; to: Inc<Inc<Id>> }]; isAccepting: false },
//             ...GroupStates,
//             { id: GroupEnd; transitions: [{ match: 'ε'; to: Inc<GroupEnd> }]; isAccepting: false },
//             { id: Inc<GroupEnd>; transitions: [{ match: 'ε'; to: Inc<Id> }]; isAccepting: false },
//             ...RestStates
//           ], RestEnd] :
//         never : never : never : never :
//     never : never : never;

// // Build group+
// type BuildGroupPlus<Group extends string, Rest extends string, Id extends number> = 
//   BuildFragment<Group, Inc<Id>> extends [infer GroupStates, infer GroupEnd] ?
//     GroupStates extends State[] ? GroupEnd extends number ?
//       BuildFragment<Rest, Inc<Inc<GroupEnd>>> extends [infer RestStates, infer RestEnd] ?
//         RestStates extends State[] ? RestEnd extends number ?
//           [[
//             { id: Id; transitions: [{ match: 'ε'; to: Inc<Id> }]; isAccepting: false },
//             ...GroupStates,
//             { id: GroupEnd; transitions: [{ match: 'ε'; to: Inc<GroupEnd> }]; isAccepting: false },
//             { id: Inc<GroupEnd>; transitions: [{ match: 'ε'; to: Inc<Id> }, { match: 'ε'; to: Inc<Inc<GroupEnd>> }]; isAccepting: false },
//             ...RestStates
//           ], RestEnd] :
//         never : never : never : never :
//     never : never : never;

// // Split alternation (simplified)
// type SplitAlternation<P extends string, Depth extends 1[] = [], Acc extends string = ''> = 
//   P extends `${infer C}${infer Rest}` ?
//     C extends '(' ? SplitAlternation<Rest, [...Depth, 1], `${Acc}${C}`> :
//     C extends ')' ? 
//       Depth extends [1, ...infer D] ? D extends 1[] ?
//         SplitAlternation<Rest, D, `${Acc}${C}`> :
//       SplitAlternation<Rest, [], `${Acc}${C}`> :
//     SplitAlternation<Rest, [], `${Acc}${C}`> :
//     C extends '|' ? Depth extends [] ? [Acc, Rest] :
//       SplitAlternation<Rest, Depth, `${Acc}${C}`> :
//     SplitAlternation<Rest, Depth, `${Acc}${C}`> :
//   never;

// // Build alternation
// type BuildAlternation<Left extends string, Right extends string, Id extends number> = 
//   BuildFragment<Left, Inc<Id>> extends [infer LeftStates, infer LeftEnd] ?
//     LeftStates extends State[] ? LeftEnd extends number ?
//       BuildFragment<Right, Inc<LeftEnd>> extends [infer RightStates, infer RightEnd] ?
//         RightStates extends State[] ? RightEnd extends number ?
//           [[
//             { id: Id; transitions: [{ match: 'ε'; to: Inc<Id> }, { match: 'ε'; to: Inc<LeftEnd> }]; isAccepting: false },
//             ...LeftStates,
//             { id: LeftEnd; transitions: [{ match: 'ε'; to: Inc<RightEnd> }]; isAccepting: false },
//             ...RightStates,
//             { id: RightEnd; transitions: [{ match: 'ε'; to: Inc<Inc<RightEnd>> }]; isAccepting: false }
//           ], Inc<Inc<RightEnd>>] :
//         never : never : never : never :
//     never : never : never;

// // =================================================================
// // NFA SIMULATION
// // =================================================================

// // Get state by ID
// type GetState<NFA extends State[], Id extends StateId> = 
//   NFA extends readonly [...any, infer S] ?
//     S extends State ?
//       S['id'] extends Id ? S :
//       NFA extends readonly [any, ...infer Rest] ?
//         Rest extends State[] ? GetState<Rest, Id> :
//         never :
//       never :
//     never :
//   never;

// // Get epsilon closure
// type EpsilonClosure<NFA extends State[], Ids extends StateId[], Visited extends StateId[] = []> = 
//   Ids extends readonly [infer Id, ...infer Rest] ?
//     Id extends StateId ?
//       Has<Visited, Id> extends true ?
//         Rest extends StateId[] ? EpsilonClosure<NFA, Rest, Visited> : Visited :
//       GetState<NFA, Id> extends State ?
//         GetEpsilonTransitions<GetState<NFA, Id>['transitions']> extends StateId[] ?
//           Rest extends StateId[] ?
//             EpsilonClosure<NFA, Concat<Rest, GetEpsilonTransitions<GetState<NFA, Id>['transitions']>>, Push<Visited, Id>> :
//           Push<Visited, Id> :
//         Rest extends StateId[] ?
//           EpsilonClosure<NFA, Rest, Push<Visited, Id>> :
//         Push<Visited, Id> :
//       Visited :
//     Visited :
//   Concat<Visited, Ids>;

// // Get epsilon transitions from transition list
// type GetEpsilonTransitions<Trans extends Transition[], Acc extends StateId[] = []> = 
//   Trans extends readonly [infer T, ...infer Rest] ?
//     T extends Transition ?
//       T['match'] extends 'ε' ?
//         Rest extends Transition[] ?
//           GetEpsilonTransitions<Rest, Push<Acc, T['to']>> :
//         Push<Acc, T['to']> :
//       Rest extends Transition[] ?
//         GetEpsilonTransitions<Rest, Acc> :
//       Acc :
//     Acc :
//   Acc;

// // Process character
// type ProcessChar<NFA extends State[], ActiveIds extends StateId[], Char extends string> = 
//   GetNextStates<NFA, ActiveIds, Char, []>;

// type GetNextStates<NFA extends State[], Ids extends StateId[], Char extends string, Acc extends StateId[]> = 
//   Ids extends readonly [infer Id, ...infer Rest] ?
//     Id extends StateId ?
//       GetState<NFA, Id> extends State ?
//         MatchingTransitions<GetState<NFA, Id>['transitions'], Char> extends StateId[] ?
//           Rest extends StateId[] ?
//             GetNextStates<NFA, Rest, Char, Concat<Acc, MatchingTransitions<GetState<NFA, Id>['transitions'], Char>>> :
//           Concat<Acc, MatchingTransitions<GetState<NFA, Id>['transitions'], Char>> :
//         Rest extends StateId[] ?
//           GetNextStates<NFA, Rest, Char, Acc> :
//         Acc :
//       Acc :
//     Acc :
//   Acc;

// // Get transitions that match character
// type MatchingTransitions<Trans extends Transition[], Char extends string, Acc extends StateId[] = []> = 
//   Trans extends readonly [infer T, ...infer Rest] ?
//     T extends Transition ?
//       T['match'] extends '.' ? 
//         Rest extends Transition[] ?
//           MatchingTransitions<Rest, Char, Push<Acc, T['to']>> :
//         Push<Acc, T['to']> :
//       T['match'] extends 'ε' ?
//         Rest extends Transition[] ?
//           MatchingTransitions<Rest, Char, Acc> :
//         Acc :
//       Char extends T['match'] ?
//         Rest extends Transition[] ?
//           MatchingTransitions<Rest, Char, Push<Acc, T['to']>> :
//         Push<Acc, T['to']> :
//       Rest extends Transition[] ?
//         MatchingTransitions<Rest, Char, Acc> :
//       Acc :
//     Acc :
//   Acc;

// // Check if accepting
// type IsAccepting<NFA extends State[], Ids extends StateId[]> = 
//   Ids extends readonly [infer Id, ...infer Rest] ?
//     Id extends StateId ?
//       GetState<NFA, Id> extends State ?
//         GetState<NFA, Id>['isAccepting'] extends true ? true :
//         Rest extends StateId[] ? IsAccepting<NFA, Rest> : false :
//       false :
//     false :
//   false;

// // Simulate NFA
// type Simulate<NFA extends State[], Input extends string, Active extends StateId[] = [0]> = 
//   Input extends `${infer C}${infer Rest}` ?
//     EpsilonClosure<NFA, Active> extends infer Closure ?
//       Closure extends StateId[] ?
//         ProcessChar<NFA, Closure, C> extends infer Next ?
//           Next extends StateId[] ?
//             Simulate<NFA, Rest, Next> :
//           false :
//         false :
//       false :
//     false :
//   EpsilonClosure<NFA, Active> extends infer Final ?
//     Final extends StateId[] ?
//       IsAccepting<NFA, Final> :
//     false :
//   false;

// // =================================================================
// // PUBLIC API
// // =================================================================

// /**
//  * Compile a regex pattern into a reusable CompiledRegex type
//  */
// export type CompileRegex<Pattern extends string> = 
//   BuildNFA<Pattern> extends infer NFA ?
//     NFA extends State[] ?
//       CompiledRegex<NFA> :
//     never :
//   never;

// /**
//  * Match an input string against a compiled regex
//  */
// export type Match<R extends CompiledRegex<any>, Input extends string> = 
//   R extends CompiledRegex<infer NFA> ?
//     NFA extends State[] ?
//       Simulate<NFA, Input> :
//     false :
//   false;

// /**
//  * Legacy API - compile and match in one step
//  */
// export type Regex<Pattern extends string, Input extends string> = 
//   Match<CompileRegex<Pattern>, Input> extends true
//     ? { match: "true"; captures: [] }
//     : { match: "false"; captures: [] };

// // =================================================================
// // TESTS
// // =================================================================

// type AssertTrue<T extends true> = T;
// type AssertFalse<T extends false> = T;
// type AssertMatch<T extends { match: "true" }> = T;
// type AssertNoMatch<T extends { match: "false" }> = T;

// // Test new API
// type EmailPattern = Regex<'[a-z]+@[a-z]+\\.[a-z]+'>;
// type Test_Email1 = AssertTrue<Match<EmailPattern, 'test@example.com'>>;
// type Test_Email2 = AssertFalse<Match<EmailPattern, 'not-an-email'>>;

// // Basic tests
// type Test1 = AssertMatch<Regex<'hello', 'hello'>>;
// type Test2 = AssertNoMatch<Regex<'hello', 'world'>>;

// // Dot tests
// type Test3 = AssertMatch<Regex<'h.llo', 'hello'>>;
// type Test4 = AssertMatch<Regex<'h.llo', 'hallo'>>;

// // Character class tests (FIXED)
// type TestClass1 = AssertMatch<Regex<'[abc]+', 'abacaba'>>;
// type TestClass1d = Regex<'[abc]+', 'abacaba'>;
// type TestClass2 = AssertMatch<Regex<'[a-z]*', 'helloworld'>>;
// type TestClass3 = AssertMatch<Regex<'[^abc]+', 'xyz'>>;

// // Quantifier tests
// type Test9 = AssertMatch<Regex<'a*b', 'aaab'>>;
// type Test10 = AssertMatch<Regex<'a*b', 'b'>>;
// type Test11 = AssertMatch<Regex<'a+b', 'aaab'>>;
// type Test12 = AssertNoMatch<Regex<'a+b', 'b'>>;
// type Test13 = AssertMatch<Regex<'a?b', 'ab'>>;
// type Test14 = AssertMatch<Regex<'a?b', 'b'>>;

// // Alternation tests
// type TestAlt1 = AssertMatch<Regex<'cat|dog', 'cat'>>;
// type TestAlt2 = AssertMatch<Regex<'cat|dog', 'dog'>>;
// type TestAlt3 = AssertNoMatch<Regex<'cat|dog', 'fish'>>;

// // Capture group tests (FIXED)
// type TestCapture1 = AssertMatch<Regex<'a(b*)c', 'abbc'>>;
// type TestCapture2 = AssertMatch<Regex<'(hello)|(goodbye)', 'hello'>>;
// type TestCapture3 = AssertMatch<Regex<'([a-z]+)-([0-9]+)', 'typescript-2022'>>;

// // Optional group tests
// type Test23 = AssertMatch<Regex<'a(bc)?d', 'ad'>>;
// type Test24 = AssertMatch<Regex<'a(bc)?d', 'abcd'>>;

// // Complex patterns
// type Test25 = AssertMatch<Regex<'[a-z]+@[a-z]+\\.[a-z]+', 'user@example.com'>>;
// type Test26 = AssertMatch<Regex<'(\\d{3})-\\d{3}-\\d{4}', '123-456-7890'>>;

// // Final example
// const result: Regex<'(hello)|(goodbye)', 'hello'> = { match: "true", captures: [] };






// =================================================================
// TYPE-LEVEL REGEX ENGINE - FIXED VERSION
// =================================================================

// Core types
type StateId = number;

type State = {
  id: StateId;
  transitions: Transition[];
  isAccepting: boolean;
};

type Transition = {
  match: string | '.' | 'ε';
  to: StateId;
};

type CompiledRegex<NFA extends State[]> = {
  __brand: 'CompiledRegex';
  nfa: NFA;
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
  FindClosingParen<Rest, D2, `${Acc}${C}`> :
  never :
  FindClosingParen<Rest, Depth, `${Acc}${C}`> :
  never;

// Find closing bracket for character class
type FindClosingBracket<S extends string, Acc extends string = ''> =
  S extends `${infer C}${infer Rest}` ?
  C extends ']' ? [Acc, Rest] :
  FindClosingBracket<Rest, `${Acc}${C}`> :
  never;

// Parse character class content
type ParseCharClass<S extends string> =
  S extends '0-9' ? Digit :
  S extends 'a-z' ? Lower :
  S extends 'A-Z' ? Upper :
  S extends `${infer C}${infer R}` ? C | ParseCharClass<R> :
  never;

// Split on top-level alternation
type SplitAlternation<P extends string, D extends 1[] = [], A extends string = ''> =
  P extends `${infer C}${infer R}` ?
  C extends '(' ? SplitAlternation<R, [...D, 1], `${A}${C}`> :
  C extends ')' ?
  D extends [any, ...infer D2] ?
  SplitAlternation<R, D2, `${A}${C}`> :
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

// Parse a single atom (character, dot, group, or class)
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

// =================================================================
// PUBLIC API
// =================================================================

export type CompileRegex<Pattern extends string> = BuildNFA<Pattern> extends infer NFA ? NFA extends State[] ? CompiledRegex<NFA> : never : never;

// =================================================================
// ENUMERATION
// =================================================================

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
type TestEnum11 = AssertTrue<AssertEqual<Enum11, 'ad' | `a${'b' | 'c'}${string}`>>;