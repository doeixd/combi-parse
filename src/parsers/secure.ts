// Secure parsing with resource limits
export interface SecurityOptions {
  maxDepth?: number;          // Max recursion depth
  maxLength?: number;         // Max input length
  maxParseTime?: number;      // Max time in ms
  maxMemory?: number;         // Max memory usage
  maxBacktracks?: number;     // Max backtracking steps
}

export function secureParser<T>(
  parser: Parser<T>,
  options: SecurityOptions = {}
): Parser<T> {
  return new Parser(state => {
    const startTime = Date.now();
    const startMemory = performance.memory?.usedJSHeapSize || 0;
    let backtrackCount = 0;
    let depth = 0;
    const maxDepth = options.maxDepth || 1000;
    const maxTime = options.maxParseTime || 5000;

    // Wrap parser execution with security checks
    const secureRun = (p: Parser<any>, s: ParserState): ParseResult<any> => {
      // Check limits
      if (++depth > maxDepth) {
        throw new Error('Max recursion depth exceeded');
      }

      if (Date.now() - startTime > maxTime) {
        throw new Error('Parse timeout exceeded');
      }

      if (options.maxLength && s.input.length > options.maxLength) {
        throw new Error('Input too large');
      }

      if (options.maxMemory) {
        const currentMemory = performance.memory?.usedJSHeapSize || 0;
        if (currentMemory - startMemory > options.maxMemory) {
          throw new Error('Memory limit exceeded');
        }
      }

      // Track backtracking
      const beforeIndex = s.index;
      const result = p.run(s);

      if (result.type === 'failure' && result.state.index < beforeIndex) {
        if (++backtrackCount > (options.maxBacktracks || 10000)) {
          throw new Error('Excessive backtracking detected');
        }
      }

      depth--;
      return result;
    };

    try {
      return secureRun(parser, state);
    } catch (e) {
      return failure(`Security violation: ${e.message}`, state);
    }
  });
}

// DOS-resistant patterns
export const dosResistant = {
  // Prevent ReDoS with safe regex
  safeRegex(pattern: string, flags?: string): Parser<string> {
    // Analyze regex for dangerous patterns
    if (hasDangerousPattern(pattern)) {
      throw new Error('Potentially dangerous regex pattern');
    }

    return regex(new RegExp(pattern, flags));
  },

  // Limited repetition
  limitedMany<T>(parser: Parser<T>, max: number): Parser<T[]> {
    return new Parser(state => {
      const results: T[] = [];
      let currentState = state;

      for (let i = 0; i < max; i++) {
        const result = parser.run(currentState);
        if (result.type === 'failure') break;

        results.push(result.value);
        currentState = result.state;
      }

      return success(results, currentState);
    });
  }
};