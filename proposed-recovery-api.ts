// Proposed better recovery API design

/**
 * For parsing with required terminators (success case)
 * Always consumes the terminator when primary parser succeeds
 */
export function terminated<T>(
  parser: Parser<T>, 
  terminator: Parser<any>
): Parser<T>

/**
 * For error recovery with explicit consumption control
 */
export function recover<T>(
  parser: Parser<T>,
  config: {
    // What to look for when recovering
    patterns: Parser<any> | Parser<any>[],
    
    // What to return on recovery
    fallback: T,
    
    // How to handle the recovery pattern
    strategy: 'consume' | 'position' | 'optional',
    
    // What to do when primary parser succeeds
    onSuccess?: 'ignore' | 'requirePattern' | 'optionalPattern'
  }
): Parser<T>

/**
 * For building complex recovery scenarios
 */
export function recoverWithContext<T>(
  parser: Parser<T>,
  local: { pattern: Parser<any>, fallback: T, consume?: boolean },
  global?: { pattern: Parser<any>, fallback: T, consume?: boolean }
): Parser<T>

// Usage examples:

// 1. CSS properties with required semicolons
const cssProperty = terminated(
  sequence([identifier, str(':'), cssValue]),
  str(';')
);

// 2. Simple error recovery that consumes delimiter
const arrayElement = recover(numberParser, {
  patterns: str(','),
  fallback: null,
  strategy: 'consume'  // Consume comma for next element
});

// 3. Nested recovery that doesn't interfere with outer parsers
const nestedParser = recover(innerParser, {
  patterns: str(')'),
  fallback: 'error',
  strategy: 'position',  // Position at ) but don't consume
  onSuccess: 'ignore'    // Don't look for ) when successful
});

// 4. Complex contextual recovery
const complexNested = recoverWithContext(
  innerParser,
  { pattern: str(')'), fallback: 'inner_error', consume: false },
  { pattern: str(';'), fallback: 'outer_error', consume: true }
);
