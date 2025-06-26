interface GenParserOptions {
  debug?: boolean;
  stepThrough?: boolean;
  onYield?: (step: number, parser: Parser<any>, result: any) => void;
}

export function genParserWithOptions<T>(
  genFn: () => Generator<Parser<any>, T, any>,
  options: GenParserOptions = {}
): Parser<T> {
  return new Parser(async state => {
    const iterator = genFn();
    let currentState = state;
    let nextValue: any = undefined;
    let step = 0;

    while (true) {
      const { value: parserOrReturn, done } = iterator.next(nextValue);

      if (done) {
        if (options.debug) {
          console.log(`✅ Generator completed with:`, parserOrReturn);
        }
        return success(parserOrReturn as T, currentState);
      }

      step++;
      const parser = parserOrReturn as Parser<any>;

      if (options.debug) {
        console.log(`\n🔄 Step ${step}:`);
        console.log(`  Parser: ${parser.constructor.name || 'Parser'}`);
        console.log(`  Position: ${currentState.index}`);
        console.log(`  Next text: "${currentState.input.slice(currentState.index, currentState.index + 20)}..."`);
      }

      if (options.stepThrough) {
        // In a real implementation, this could pause for user input
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      const result = parser.run(currentState);

      if (result.type === "failure") {
        if (options.debug) {
          console.log(`  ❌ Failed: ${result.message}`);
        }
        return result;
      }

      if (options.debug) {
        console.log(`  ✅ Success: ${JSON.stringify(result.value)}`);
        console.log(`  Advanced to: ${result.state.index}`);
      }

      if (options.onYield) {
        options.onYield(step, parser, result.value);
      }

      currentState = result.state;
      nextValue = result.value;
    }
  });
}

// Usage:
const debugParser = genParserWithOptions(
  function* () {
    const name = yield identifier;
    yield str('=');
    const value = yield number;
    return { name, value };
  },
  { debug: true }
);