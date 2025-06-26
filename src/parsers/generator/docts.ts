export function documentedGenParser<T>(
  description: string,
  genFn: () => Generator<Parser<any>, T, any>
): Parser<T> & { docs: () => string } {
  const parser = genParser(genFn);

  return Object.assign(parser, {
    docs: () => {
      const steps: string[] = [];

      // Dry run to collect steps
      const iterator = genFn();
      let stepNum = 1;

      while (true) {
        const { value, done } = iterator.next();
        if (done) break;

        const parser = value as Parser<any>;
        steps.push(`${stepNum}. ${parser.toString?.() || 'Parse step'}`);
        stepNum++;
      }

      return `${description}\n\nSteps:\n${steps.join('\n')}`;
    }
  });
}