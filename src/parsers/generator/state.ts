// Generator with state
export function genParserWithState<S, T>(
  initialState: S,
  genFn: (state: { get: () => S, set: (s: S) => void }) => Generator<Parser<any>, T, any>
): Parser<T> {
  return new Parser(parserState => {
    let localState = initialState;

    const stateManager = {
      get: () => localState,
      set: (s: S) => { localState = s; }
    };

    const iterator = genFn(stateManager);
    let currentParserState = parserState;
    let nextValue: any = undefined;

    while (true) {
      const { value: parserOrReturn, done } = iterator.next(nextValue);

      if (done) {
        return success(parserOrReturn as T, currentParserState);
      }

      const parser = parserOrReturn as Parser<any>;
      const result = parser.run(currentParserState);

      if (result.type === "failure") return result;

      currentParserState = result.state;
      nextValue = result.value;
    }
  });
}

// Example: Parser with counter
const countingParser = genParserWithState(
  { count: 0, items: [] as string[] },
  function* (state) {
    while (true) {
      const item = yield identifier.optional();
      if (item === null) break;

      const current = state.get();
      state.set({
        count: current.count + 1,
        items: [...current.items, item]
      });

      yield whitespace.optional();
    }

    return state.get();
  }
);