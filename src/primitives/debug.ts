// Generate railroad diagrams
export function toRailroadDiagram(parser: Parser<any>): string {
  const svg = new SVGBuilder();

  function visit(p: Parser<any>, x: number, y: number): number {
    if (p instanceof StrParser) {
      return svg.terminal(p.expected, x, y);
    } else if (p instanceof ChoiceParser) {
      return svg.choice(p.alternatives.map(alt => () => visit(alt, x, y)));
    } else if (p instanceof SequenceParser) {
      let currentX = x;
      for (const child of p.parsers) {
        currentX = visit(child, currentX, y);
      }
      return currentX;
    }
    // ... etc
  }

  visit(parser, 0, 0);
  return svg.build();
}

// Interactive parser debugger
export class ParserDebugger<T> {
  private steps: DebugStep[] = [];
  private breakpoints: Set<Parser<any>> = new Set();

  constructor(private parser: Parser<T>) { }

  addBreakpoint(parser: Parser<any>): void {
    this.breakpoints.add(parser);
  }

  async debug(input: string): Promise<DebugSession<T>> {
    return new DebugSession(this.parser, input, this.breakpoints);
  }
}

class DebugSession<T> {
  private currentStep = 0;
  private steps: DebugStep[] = [];

  constructor(
    private parser: Parser<T>,
    private input: string,
    private breakpoints: Set<Parser<any>>
  ) { }

  async step(): Promise<DebugStep> {
    // Execute one parser step
    const step = this.steps[this.currentStep++];

    if (this.breakpoints.has(step.parser)) {
      // Pause for inspection
      await this.onBreakpoint(step);
    }

    return step;
  }

  getCallStack(): ParserFrame[] {
    // Return current parser call stack
    return this.steps
      .slice(0, this.currentStep)
      .filter(s => s.type === 'enter')
      .map(s => ({
        parser: s.parser,
        position: s.state.index,
        preview: this.input.slice(s.state.index, s.state.index + 20)
      }));
  }

  inspect(): DebugInfo {
    return {
      position: this.currentState.index,
      remaining: this.input.slice(this.currentState.index),
      callStack: this.getCallStack(),
      variables: this.getLocalVariables()
    };
  }
}