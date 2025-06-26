export function asyncGenParser<T>(
  genFn: () => AsyncGenerator<Parser<any>, T, any>
): Parser<Promise<T>> {
  return new Parser(state => {
    // Return a promise that resolves to success/failure
    return (async () => {
      const iterator = genFn();
      let currentState = state;
      let nextValue: any = undefined;

      while (true) {
        const { value: parserOrReturn, done } = await iterator.next(nextValue);

        if (done) {
          return success(parserOrReturn as T, currentState);
        }

        const parser = parserOrReturn as Parser<any>;
        const result = parser.run(currentState);

        if (result.type === "failure") {
          return result;
        }

        currentState = result.state;
        nextValue = result.value;
      }
    })();
  });
}

// Example: Parser that can fetch external resources
const enhancedParser = asyncGenParser(async function* () {
  const importKeyword = yield str('import');
  yield whitespace;
  const url = yield between(str('"'), regex(/[^"]*/), str('"'));

  // Async operation
  const response = await fetch(url);
  const schema = await response.json();

  // Use the fetched schema to create a dynamic parser
  const dynamicParser = createParserFromSchema(schema);
  const data = yield dynamicParser;

  return { imported: url, data };
});