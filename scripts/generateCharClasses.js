// A script to generate the ultimate, comprehensive TypeScript module of
// character classes, combining ASCII-level functional groups with
// Unicode-range-based language and symbol blocks.

const fs = require('fs');
const path = require('path');

console.log('Generating the master character class types module...');

// =================================================================
// SECTION A: DATA SOURCES
// =================================================================

// --- Part 1: ASCII Character String Constants ---
const DIGITS_BINARY = '01';
const DIGITS_OCTAL = '01234567';
const DIGITS_DECIMAL = '0123456789';
const LOWER_HEX_LETTERS = 'abcdef';
const UPPER_HEX_LETTERS = 'ABCDEF';
const LOWER_ALPHA = 'abcdefghijklmnopqrstuvwxyz';
const UPPER_ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const VOWELS_LOWER = 'aeiou';
const CONSONANTS_LOWER = [...LOWER_ALPHA].filter(c => !VOWELS_LOWER.includes(c)).join('');
const ROMAN_NUMERALS = 'IVXLCDM';
const SENTENCE_TERMINATORS = '.!?';
const CLAUSE_SEPARATORS = ',;:';
const BRACKETS = '[]{}()';
const QUOTES = `'"\``;
const DASHES = '-_—–';
const MATH_OPERATORS_ASCII = '+*/%=';
const LOGICAL_OPERATORS_ASCII = '<>&|^';
const SYMBOLS_ASCII = '#@$&';
const OTHER_PUNCTUATION_ASCII = `\\~`;
const ALL_PUNCTUATION_ASCII = SENTENCE_TERMINATORS + CLAUSE_SEPARATORS + BRACKETS + QUOTES + DASHES + MATH_OPERATORS_ASCII + LOGICAL_OPERATORS_ASCII + SYMBOLS_ASCII + OTHER_PUNCTUATION_ASCII;
const BLANK_WS = ' \t';
const LINE_END_WS = '\n\r';
const OTHER_WS = '\f\v';
const WHITESPACE = BLANK_WS + LINE_END_WS + OTHER_WS;
const C_IDENTIFIER_START = LOWER_ALPHA + UPPER_ALPHA + '_';
const C_IDENTIFIER_PART = C_IDENTIFIER_START + DIGITS_DECIMAL;
const URL_UNRESERVED = LOWER_ALPHA + UPPER_ALPHA + DIGITS_DECIMAL + '-._~';
const BASE64 = LOWER_ALPHA + UPPER_ALPHA + DIGITS_DECIMAL + '+/';
const BASE64_URL_SAFE = LOWER_ALPHA + UPPER_ALPHA + DIGITS_DECIMAL + '-_';

// --- Part 2: The Master Definition List ---
// This array is the single source of truth for the entire generated file.
// Each object can have one of three forms:
// 1. { name, ..., chars } -> Creates a union from a predefined string.
// 2. { name, ..., type } -> Creates a simple type alias.
// 3. { name, ..., ranges, threshold } -> Generates from Unicode ranges, using the threshold.
const MASTER_DEFINITIONS = [
  // --- 1. Core Digital & Alphabetic Types (ASCII) ---
  { name: 'BinaryDigit',        category: 'Core Digital & Alphabetic (ASCII)', doc: "A binary digit ('0' or '1').", chars: DIGITS_BINARY },
  { name: 'OctalDigit',         category: 'Core Digital & Alphabetic (ASCII)', doc: "An octal digit ('0' through '7').", chars: DIGITS_OCTAL },
  { name: 'Digit',              category: 'Core Digital & Alphabetic (ASCII)', doc: "A standard decimal digit ('0' through '9'). Corresponds to POSIX `[:digit:]`.", chars: DIGITS_DECIMAL },
  { name: 'LowerHexLetter',     category: 'Core Digital & Alphabetic (ASCII)', doc: "A lowercase hexadecimal letter ('a' through 'f').", chars: LOWER_HEX_LETTERS },
  { name: 'UpperHexLetter',     category: 'Core Digital & Alphabetic (ASCII)', doc: "An uppercase hexadecimal letter ('A' through 'F').", chars: UPPER_HEX_LETTERS },
  { name: 'HexLetter',          category: 'Core Digital & Alphabetic (ASCII)', doc: "Any hexadecimal letter, case-insensitive.", type: 'LowerHexLetter | UpperHexLetter' },
  { name: 'HexDigit',           category: 'Core Digital & Alphabetic (ASCII)', doc: "Any hexadecimal digit, case-insensitive. Corresponds to POSIX `[:xdigit:]`.", type: 'Digit | HexLetter' },
  { name: 'Lower',              category: 'Core Digital & Alphabetic (ASCII)', doc: "A lowercase ASCII letter ('a' through 'z'). Corresponds to POSIX `[:lower:]`.", chars: LOWER_ALPHA },
  { name: 'Upper',              category: 'Core Digital & Alphabetic (ASCII)', doc: "An uppercase ASCII letter ('A' through 'Z'). Corresponds to POSIX `[:upper:]`.", chars: UPPER_ALPHA },
  { name: 'Alpha',              category: 'Core Digital & Alphabetic (ASCII)', doc: "Any ASCII letter, case-insensitive. Corresponds to POSIX `[:alpha:]`.", type: 'Lower | Upper' },
  { name: 'Alnum',              category: 'Core Digital & Alphabetic (ASCII)', doc: "Any ASCII alphanumeric character. Corresponds to POSIX `[:alnum:]`.", type: 'Alpha | Digit' },

  // --- 2. Logical Letter Groupings (ASCII) ---
  { name: 'VowelLower',         category: 'Logical Letter Groupings (ASCII)', doc: 'A lowercase ASCII vowel.', chars: VOWELS_LOWER },
  { name: 'ConsonantLower',     category: 'Logical Letter Groupings (ASCII)', doc: 'A lowercase ASCII consonant.', chars: CONSONANTS_LOWER },
  { name: 'Vowel',              category: 'Logical Letter Groupings (ASCII)', doc: 'Any ASCII vowel, case-insensitive.', type: 'VowelLower | Upper' },
  { name: 'Consonant',          category: 'Logical Letter Groupings (ASCII)', doc: 'Any ASCII consonant, case-insensitive.', type: 'ConsonantLower | Upper' },
  { name: 'RomanNumeral',       category: 'Logical Letter Groupings (ASCII)', doc: 'A character used in Roman numerals (case-sensitive uppercase).', chars: ROMAN_NUMERALS },

  // --- 3. Punctuation & Symbols (ASCII) ---
  { name: 'SentenceTerminator', category: 'Punctuation & Symbols (ASCII)', doc: 'A character that typically ends a sentence.', chars: SENTENCE_TERMINATORS },
  { name: 'ClauseSeparator',    category: 'Punctuation & Symbols (ASCII)', doc: 'A character that typically separates clauses within a sentence.', chars: CLAUSE_SEPARATORS },
  { name: 'Bracket',            category: 'Punctuation & Symbols (ASCII)', doc: 'A bracket, brace, or parenthesis character.', chars: BRACKETS },
  { name: 'Quote',              category: 'Punctuation & Symbols (ASCII)', doc: 'A single quote, double quote, or backtick.', chars: QUOTES },
  { name: 'Dash',               category: 'Punctuation & Symbols (ASCII)', doc: 'A dash or underscore character.', chars: DASHES },
  { name: 'AsciiMathOperator',  category: 'Punctuation & Symbols (ASCII)', doc: 'A common ASCII mathematical operator.', chars: MATH_OPERATORS_ASCII },
  { name: 'AsciiPunctuation',   category: 'Punctuation & Symbols (ASCII)', doc: "All common ASCII punctuation. Corresponds to POSIX `[:punct:]`.", chars: ALL_PUNCTUATION_ASCII },

  // --- 4. Whitespace Categories ---
  { name: 'Blank',              category: 'Whitespace Categories', doc: "A space or a tab. Corresponds to POSIX `[:blank:]`.", chars: BLANK_WS },
  { name: 'LineEnd',            category: 'Whitespace Categories', doc: 'A line-ending character (newline or carriage return).', chars: LINE_END_WS },
  { name: 'Whitespace',         category: 'Whitespace Categories', doc: "Any common whitespace character. Corresponds to POSIX `[:space:]`.", chars: WHITESPACE },

  // --- 5. Protocol & Language Specific Classes ---
  { name: 'CIdentifierStart',   category: 'Protocol & Language Specifics', doc: 'A character that can start an identifier in C-like languages.', chars: C_IDENTIFIER_START },
  { name: 'CIdentifierPart',    category: 'Protocol & Language Specifics', doc: 'A character that can be part of an identifier in C-like languages.', chars: C_IDENTIFIER_PART },
  { name: 'UrlUnreserved',      category: 'Protocol & Language Specifics', doc: 'An unreserved character in a URI, per RFC 3986. These do not require percent-encoding.', chars: URL_UNRESERVED },
  { name: 'Base64Char',         category: 'Protocol & Language Specifics', doc: 'A character from the standard Base64 alphabet.', chars: BASE64 },
  { name: 'Base64UrlSafeChar',  category: 'Protocol & Language Specifics', doc: 'A character from the URL-safe Base64 alphabet.', chars: BASE64_URL_SAFE },
  { name: 'Base64Pad',          category: 'Protocol & Language Specifics', doc: "The padding character ('=') used in Base64 encoding.", type: "'='" },

  // --- 6. POSIX-Style & Composite Types ---
  { name: 'PrintableAscii',     category: 'POSIX-Style & Composite Types', doc: 'A broad "universe" of all printable ASCII characters, used for creating robust exclusion types.', type: 'Alnum | AsciiPunctuation | " "' },
  { name: 'Graph',              category: 'POSIX-Style & Composite Types', doc: "A visible character that takes up space (excludes all whitespace). Corresponds to POSIX `[:graph:]`.", type: 'Alnum | AsciiPunctuation' },
  { name: 'Print',              category: 'POSIX-Style & Composite Types', doc: "A printable character (graphical characters plus space). Corresponds to POSIX `[:print:]`.", type: 'Graph | " "' },
  { name: 'Control',            category: 'POSIX-Style & Composite Types', doc: "A control character from the common whitespace set. Corresponds to POSIX `[:cntrl:]`.", type: "Exclude<Whitespace, ' '>" },

  // --- 7. Unicode Blocks: European & Middle Eastern ---
  { name: 'LatinSupplement',    category: 'Unicode Blocks: European & Middle Eastern', doc: 'The Latin-1 Supplement block, containing common accented letters like ä, é, ñ.', ranges: [[0x00C0, 0x00FF]], threshold: 256 },
  { name: 'LatinExtendedA',     category: 'Unicode Blocks: European & Middle Eastern', doc: 'The Latin Extended-A block for European languages like Polish, Czech, and Croatian.', ranges: [[0x0100, 0x017F]], threshold: 256 },
  { name: 'GreekAndCoptic',     category: 'Unicode Blocks: European & Middle Eastern', doc: 'Characters for the Greek and Coptic scripts.', ranges: [[0x0370, 0x03FF]], threshold: 256 },
  { name: 'Cyrillic',           category: 'Unicode Blocks: European & Middle Eastern', doc: 'Characters for Cyrillic-based scripts like Russian, Bulgarian, and Serbian.', ranges: [[0x0400, 0x04FF], [0x0500, 0x052F]], threshold: 512 },
  { name: 'Hebrew',             category: 'Unicode Blocks: European & Middle Eastern', doc: 'Characters for the Hebrew script.', ranges: [[0x0590, 0x05FF]], threshold: 256 },
  { name: 'Arabic',             category: 'Unicode Blocks: European & Middle Eastern', doc: 'Characters for scripts like Arabic, Persian, and Urdu.', ranges: [[0x0600, 0x06FF], [0x0750, 0x077F]], threshold: 512 },

  // --- 8. Unicode Blocks: Asian Scripts ---
  { name: 'Devanagari',         category: 'Unicode Blocks: Asian Scripts', doc: 'Characters for Hindi, Marathi, and Nepali (Devanagari script).', ranges: [[0x0900, 0x097F]], threshold: 256 },
  { name: 'Thai',               category: 'Unicode Blocks: Asian Scripts', doc: 'Characters for the Thai language.', ranges: [[0x0E00, 0x0E7F]], threshold: 256 },
  { name: 'Hiragana',           category: 'Unicode Blocks: Asian Scripts', doc: 'The Japanese Hiragana syllabary.', ranges: [[0x3040, 0x309F]], threshold: 256 },
  { name: 'Katakana',           category: 'Unicode Blocks: Asian Scripts', doc: 'The Japanese Katakana syllabary.', ranges: [[0x30A0, 0x30FF]], threshold: 256 },
  { name: 'HangulSyllables',    category: 'Unicode Blocks: Asian Scripts', doc: 'The vast block of pre-composed Korean Hangul syllables.', ranges: [[0xAC00, 0xD7A3]], threshold: 1024 },
  { name: 'CjkUnifiedIdeographs', category: 'Unicode Blocks: Asian Scripts', doc: 'The most common Chinese, Japanese, and Korean characters.', ranges: [[0x4E00, 0x9FFF]], threshold: 1024 },

  // --- 9. Unicode Blocks: Symbols & Punctuation ---
  { name: 'GeneralPunctuation', category: 'Unicode Blocks: Symbols & Punctuation', doc: 'A block of general-purpose punctuation, including various dashes, quotes, and the ellipsis.', ranges: [[0x2000, 0x206F]], threshold: 256 },
  { name: 'CurrencySymbols',    category: 'Unicode Blocks: Symbols & Punctuation', doc: 'A block containing currency symbols like the Euro, Rupee, and Yen.', ranges: [[0x20A0, 0x20CF]], threshold: 256 },
  { name: 'BoxDrawing',         category: 'Unicode Blocks: Symbols & Punctuation', doc: 'Characters for creating text-based boxes and borders in terminals.', ranges: [[0x2500, 0x257F]], threshold: 256 },
  { name: 'GeometricShapes',    category: 'Unicode Blocks: Symbols & Punctuation', doc: 'A block of geometric shapes like circles, squares, and triangles.', ranges: [[0x25A0, 0x25FF]], threshold: 256 },
  { name: 'Arrows',             category: 'Unicode Blocks: Symbols & Punctuation', doc: 'A block of various arrow symbols.', ranges: [[0x2190, 0x21FF]], threshold: 256 },
  { name: 'MathematicalOperators', category: 'Unicode Blocks: Symbols & Punctuation', doc: 'A block of advanced mathematical operators beyond basic ASCII.', ranges: [[0x2200, 0x22FF]], threshold: 256 },

  // --- 10. Conceptual Unicode Property Types ---
  { name: 'UnicodeLetter',      category: 'Conceptual Unicode Property Types', doc: "A conceptual type for any Unicode letter. WARNING: This is an alias for `string` and is not an exhaustive union. Use with a parser that supports Unicode property escapes like `\\p{L}`.", type: 'string' },
  { name: 'UnicodeNumber',      category: 'Conceptual Unicode Property Types', doc: "A conceptual type for any Unicode number character. WARNING: An alias for `string`. Use with a `\\p{N}`-aware parser.", type: 'string' },
  { name: 'UnicodePunctuation', category: 'Conceptual Unicode Property Types', doc: "A conceptual type for any Unicode punctuation. WARNING: An alias for `string`. Use with a `\\p{P}`-aware parser.", type: 'string' },
  { name: 'Emoji',              category: 'Conceptual Unicode Property Types', doc: "A conceptual type for an emoji. WARNING: An alias for `string`. Use with a `\\p{Emoji}`-aware parser.", type: 'string' },
];



// =================================================================
// SECTION C: UTILITY FUNCTIONS
// =================================================================

/**
 * Convert a string of characters into a TypeScript union type.
 * @param {string} chars - The string of characters.
 * @returns {string} A TypeScript union type.
 */
function toUnionType(chars) {
  if (!chars) return 'never';
  return [...new Set(chars)].map(c => {
    if (c === "'") return `'\\''`;
    if (c === "\\") return `'\\\\'`;
    if (c === "\n") return `'\\n'`;
    if (c === "\r") return `'\\r'`;
    if (c === "\t") return `'\\t'`;
    if (c === "\f") return `'\\f'`;
    if (c === "\v") return `'\\v'`;
    if (c.charCodeAt(0) < 32) return `'\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}'`;
    return `'${c}'`;
  }).join(' | ');
}

/**
 * Count the total number of characters in the given Unicode ranges.
 * @param {Array<Array<number>>} ranges - Array of [start, end] ranges.
 * @returns {number} Total character count.
 */
function countCharsInRanges(ranges) {
  return ranges.reduce((total, [start, end]) => total + (end - start + 1), 0);
}

/**
 * Generate a string of characters from Unicode ranges.
 * @param {Array<Array<number>>} ranges - Array of [start, end] ranges.
 * @returns {string} A string containing all characters in the ranges.
 */
function generateCharsFromRanges(ranges) {
  let result = '';
  for (const [start, end] of ranges) {
    for (let i = start; i <= end; i++) {
      result += String.fromCharCode(i);
    }
  }
  return result;
}

// =================================================================
// SECTION D: NEW - PRE-CALCULATE DATA FOR GENERATION
// =================================================================

// Process all definitions to prepare them for generation
const processedDefinitions = MASTER_DEFINITIONS.map(def => {
  let typeDefinition;
  let charString = null;

  if (def.type) {
    typeDefinition = def.type;
  } else if (def.chars) {
    typeDefinition = toUnionType(def.chars);
    charString = def.chars;
  } else if (def.ranges) {
    const charCount = countCharsInRanges(def.ranges);
    if (charCount > def.threshold) {
      typeDefinition = 'string';
      // charString remains null for conceptual types
    } else {
      const chars = generateCharsFromRanges(def.ranges);
      typeDefinition = toUnionType(chars);
      charString = chars;
    }
  }
  return { ...def, generatedType: typeDefinition, charString };
});

// =================================================================
// SECTION E: SCRIPT EXECUTION (ENHANCED)
// =================================================================

function main() {
  let fileContent = `
// =================================================================
//
//      MASTER CHARACTER CLASSES - AUTO-GENERATED
//
//      This file was generated by: generate-master-char-classes.js
//      It contains the ultimate, unified collection of character class
//      types and the necessary mappings to make them work with a
//      type-safe \`charClass\` factory function.
//
// =================================================================
`;

  // --- Generate the Type Aliases by Category ---
  const categorized = processedDefinitions.reduce((acc, def) => {
    if (!acc[def.category]) acc[def.category] = [];
    acc[def.category].push(def);
    return acc;
  }, {});

  for (const category of Object.keys(categorized).sort()) {
    fileContent += `\n// --- ${category} ---\n`;
    for (const def of categorized[category]) {
      const doc = def.generatedType === 'string' && !def.type
        ? `${def.doc}\n * @warning This is a conceptual type alias for \`string\` because the character set is too large to be represented as a union type. Use it with a Unicode-aware regex (e.g., \`new RegExp("\\\\p{Script=${def.name}}", "u")\`).`
        : def.doc;
      fileContent += `\n/** ${doc} */\n`;
      fileContent += `export type ${def.name} = ${def.generatedType};\n`;
    }
  }

  // --- NEW: Generate the Scaffolding for charClass ---
  fileContent += `\n// =================================================================\n`;
  fileContent += `// Mappings for the type-safe charClass factory function\n`;
  fileContent += `// =================================================================\n`;

  // Filter for classes that have a concrete set of characters
  const concreteClasses = processedDefinitions.filter(def => def.charString !== null);

  // 1. Generate the union type of all valid class names
  const classNames = concreteClasses.map(def => `'${def.name}'`).join(' | ');
  fileContent += `\n/** A union of all concrete, named character classes available. */\n`;
  fileContent += `export type CharClassName = ${classNames};\n`;

  // 2. Generate the Type Map interface
  fileContent += `\n/** A map from the string name of a class to its corresponding TypeScript type. */\n`;
  fileContent += `export interface CharClassTypeMap {\n`;
  for (const def of concreteClasses) {
    fileContent += `  ${def.name}: ${def.name};\n`;
  }
  fileContent += `}\n`;

  // 3. Generate the runtime strings object
  fileContent += `\n/** A runtime map from the name of a class to its string of characters. */\n`;
  fileContent += `export const CHAR_CLASS_STRINGS: { [K in CharClassName]: string } = {\n`;
  for (const def of concreteClasses) {
    // Escape special characters in the JS string
    const safeString = def.charString
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t')
      .replace(/\f/g, '\\f')
      .replace(/\v/g, '\\v')
      .replace(/[\x00-\x1F]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
    fileContent += `  ${def.name}: '${safeString}',\n`;
  }
  fileContent += `};\n`;


  const outputPath = path.join(process.cwd(), 'src', 'master-char-classes.ts');
  fs.writeFileSync(outputPath, fileContent.trim());

  console.log(`✅ Successfully generated the master types module with factory mappings: ${outputPath}`);
}



main();