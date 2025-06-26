// Add a new parser for literal string patterns with type inference
export function pattern<T extends string>(
  literals: T[]
): Parser<T> {
  return choice(literals.map(lit => str(lit)));
}

// Usage:
const httpMethod = pattern(['GET', 'POST', 'PUT', 'DELETE'] as const);
// Type: Parser<'GET' | 'POST' | 'PUT' | 'DELETE'> ✅

// Even better: extract patterns from regex when possible
export function literalRegex<T extends string>(
  regex: RegExp,
  literals: readonly T[]
): Parser<T> {
  return new Parser(state => {
    const result = regex.test(state.input.slice(state.index));
    if (result) {
      const match = state.input.slice(state.index).match(regex)?.[0];
      if (literals.includes(match as T)) {
        return success(match as T, { ...state, index: state.index + match!.length });
      }
    }
    return failure(`Expected one of: ${literals.join(', ')}`, state);
  });
}

// Usage:
const bool = literalRegex(/true|false/, ['true', 'false'] as const);
// Type: Parser<'true' | 'false'> ✅