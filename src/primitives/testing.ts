// Parser testing utilities
export class ParserTester<T> {
  constructor(private parser: Parser<T>) { }

  // Property-based testing
  async propertyTest(
    generator: () => string,
    property: (input: string, result: T) => boolean,
    iterations = 100
  ): Promise<TestResult> {
    const failures: Array<{ input: string; error: string }> = [];

    for (let i = 0; i < iterations; i++) {
      const input = generator();

      try {
        const result = this.parser.parse(input);
        if (!property(input, result)) {
          failures.push({
            input,
            error: 'Property not satisfied'
          });
        }
      } catch (e) {
        failures.push({
          input,
          error: e.message
        });
      }
    }

    return {
      passed: failures.length === 0,
      failures,
      coverage: this.calculateCoverage()
    };
  }

  // Fuzzing
  async fuzz(options: FuzzOptions = {}): Promise<FuzzResult> {
    const mutators = [
      (s: string) => s + 'x',                          // Append
      (s: string) => s.slice(0, -1),                  // Truncate
      (s: string) => s.replace(/.$/, 'x'),            // Replace
      (s: string) => s.slice(0, s.length / 2) + s,      // Duplicate
      (s: string) => shuffle(s.split('')).join(''),   // Shuffle
    ];

    const seeds = options.seeds || [''];
    const corpus = new Set(seeds);
    const crashes: Array<{ input: string; error: Error }> = [];

    for (let i = 0; i < (options.iterations || 1000); i++) {
      const seed = Array.from(corpus)[Math.floor(Math.random() * corpus.size)];
      const mutator = mutators[Math.floor(Math.random() * mutators.length)];
      const input = mutator(seed);

      try {
        const result = this.parser.parse(input);
        // Successful parse, add to corpus
        corpus.add(input);
      } catch (e) {
        if (!(e instanceof ParserError)) {
          // Unexpected error - likely a bug
          crashes.push({ input, error: e });
        }
      }
    }

    return { crashes, corpus: Array.from(corpus) };
  }

  // Grammar coverage
  calculateCoverage(): CoverageReport {
    // Track which parser nodes have been executed
    const coverage = new Map<Parser<any>, number>();

    // Instrument parser to track execution
    const instrumented = this.instrument(this.parser, coverage);

    // Run test suite
    this.runTestSuite(instrumented);

    return {
      totalParsers: this.countParsers(this.parser),
      coveredParsers: coverage.size,
      percentage: (coverage.size / this.countParsers(this.parser)) * 100,
      uncovered: this.findUncovered(this.parser, coverage)
    };
  }
}

// Differential testing against reference implementation
export async function differentialTest<T>(
  parser1: Parser<T>,
  parser2: Parser<T>,
  inputs: string[]
): Promise<DifferentialResult> {
  const differences: Array<{
    input: string;
    result1: T | Error;
    result2: T | Error;
  }> = [];

  for (const input of inputs) {
    const r1 = tryParse(parser1, input);
    const r2 = tryParse(parser2, input);

    if (!deepEqual(r1, r2)) {
      differences.push({ input, result1: r1, result2: r2 });
    }
  }

  return { differences };
}