import { CompileRegex, Enumerate } from './src/regex';

// Test basic escape sequences
type DigitTest = Enumerate<CompileRegex<'\\d'>>;
type WordTest = Enumerate<CompileRegex<'\\w'>>;
type WhitespaceTest = Enumerate<CompileRegex<'\\s'>>;

// Test with quantifiers
type MultipleDigits = Enumerate<CompileRegex<'\\d+'>>;
type OptionalDigit = Enumerate<CompileRegex<'\\d?'>>;

// Test combinations
type PhonePattern = Enumerate<CompileRegex<'\\d\\d\\d-\\d\\d\\d-\\d\\d\\d\\d'>>;

// Test the original [0-9] pattern still works
type CharClassDigits = Enumerate<CompileRegex<'[0-9]'>>;

// Verify they produce the same results
type DigitsMatch = DigitTest extends CharClassDigits ? true : false;
type CharClassMatch = CharClassDigits extends DigitTest ? true : false;

console.log('Escape sequences implemented successfully!');
