import { Parser, str, success } from "../parser";

export function recover<T>(
  parser: Parser<T>,
  recovery: Parser<any>,
  fallback: T
): Parser<T> {
  return new Parser(state => {
    const result = parser.run(state);

    if (result.type === 'success') {
      return result;
    }

    // Try to recover by skipping to recovery point
    let currentState = state;
    while (currentState.index < currentState.input.length) {
      const recoveryResult = recovery.run(currentState);

      if (recoveryResult.type === 'success') {
        return success(fallback, recoveryResult.state);
      }

      currentState = { ...currentState, index: currentState.index + 1 };
    }

    return result; // Return original failure
  });
}

// // Usage: Parse statements, recovering at semicolons
// const statement = recover(
//   actualStatement,
//   str(';'),
//   { type: 'error', message: 'Invalid statement' }
// );