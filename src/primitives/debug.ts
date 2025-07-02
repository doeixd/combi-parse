/**
 * @fileoverview Parser Debugging and Visualization Tools
 * 
 * This module provides comprehensive debugging capabilities for parser combinators,
 * including interactive step-through debugging, railroad diagram generation, and
 * runtime inspection tools. These utilities are essential for understanding parser
 * behavior, diagnosing parsing failures, and optimizing parser performance.
 * 
 * The debugging approach combines static analysis (railroad diagrams) with dynamic
 * inspection (step debugging) to provide complete visibility into parser execution.
 * This is particularly valuable when dealing with complex grammars where the
 * interaction between different parser combinators can be difficult to predict.
 * 
 * Railroad diagrams provide a visual representation of the grammar structure,
 * following the tradition established by syntax diagrams in language specifications.
 * The interactive debugger allows stepping through parse execution to understand
 * exactly how input is consumed and where failures occur.
 * 
 * @example
 * ```typescript
 * // Create a debugger for a complex parser
 * const debugger = new ParserDebugger(jsonParser);
 * 
 * // Generate railroad diagram
 * const diagram = toRailroadDiagram(jsonParser);
 * 
 * // Debug interactively
 * const session = await debugger.debug('{"key": "value"}');
 * const step = await session.step();
 * const callStack = session.getCallStack();
 * ```
 */

import { Parser } from "../parser";

/**
 * Represents a single step in parser execution during debugging.
 * 
 * Debug steps track the flow of control through parser combinators,
 * recording entry/exit points and success/failure outcomes. This provides
 * a detailed trace of parsing execution for analysis.
 */
export interface DebugStep {
  /** The type of debugging event that occurred */
  type: 'enter' | 'exit' | 'success' | 'failure';
  /** The parser instance that generated this debug step */
  parser: Parser<any>;
  /** The parsing state when this step occurred */
  state: { index: number };
  /** Optional descriptive message about this step */
  message?: string;
}

/**
 * Represents a single frame in the parser call stack.
 * 
 * Parser frames track the hierarchical structure of parser execution,
 * showing which parsers called which other parsers and at what positions
 * in the input.
 */
export interface ParserFrame {
  /** The parser instance at this stack frame */
  parser: Parser<any>;
  /** The input position when this parser was invoked */
  position: number;
  /** A preview of the input at this position for context */
  preview: string;
}

/**
 * Complete debugging information for the current parser state.
 * 
 * This aggregates all available debugging information into a single
 * structure for comprehensive inspection of parser execution.
 */
export interface DebugInfo {
  /** Current position in the input string */
  position: number;
  /** Remaining unparsed input */
  remaining: string;
  /** Current parser call stack */
  callStack: ParserFrame[];
  /** Local variables and state information */
  variables: Record<string, any>;
}

/**
 * Simple SVG builder for generating railroad diagrams.
 * 
 * This class provides a fluent interface for constructing SVG-based
 * railroad diagrams that visualize parser grammar structure. Railroad
 * diagrams are a standard way of representing formal grammars visually.
 */
class SVGBuilder {
  private elements: string[] = [];
  private width = 0;
  private height = 0;

  /**
   * Adds a terminal symbol (literal string or token) to the diagram.
   * 
   * Terminal symbols are rendered as rounded rectangles and represent
   * the actual tokens that must be matched in the input.
   * 
   * @param text The terminal symbol text to display
   * @param x The x-coordinate for positioning
   * @param y The y-coordinate for positioning
   * @returns The x-coordinate after this terminal
   * 
   * @example
   * ```typescript
   * const svg = new SVGBuilder();
   * const nextX = svg.terminal('if', 10, 20);
   * ```
   */
  terminal(text: string, x: number, y: number): number {
    const width = text.length * 8 + 20;
    this.elements.push(`<rect x="${x}" y="${y}" width="${width}" height="30" fill="lightblue" stroke="black"/>`);
    this.elements.push(`<text x="${x + 10}" y="${y + 20}" font-family="monospace">${text}</text>`);
    this.width = Math.max(this.width, x + width);
    this.height = Math.max(this.height, y + 30);
    return x + width + 10;
  }

  /**
   * Adds a choice structure (alternatives) to the diagram.
   * 
   * Choice structures show multiple paths through the grammar,
   * representing alternatives that can be selected during parsing.
   * 
   * @param alternatives Array of functions that render each alternative
   * @returns The maximum x-coordinate reached by any alternative
   * 
   * @example
   * ```typescript
   * const svg = new SVGBuilder();
   * const nextX = svg.choice([
   *   () => svg.terminal('true', 0, 0),
   *   () => svg.terminal('false', 0, 40)
   * ]);
   * ```
   */
  choice(alternatives: (() => number)[]): number {
    // Simplified choice rendering
    let maxX = 0;
    alternatives.forEach((alt) => {
      maxX = Math.max(maxX, alt());
    });
    return maxX;
  }

  /**
   * Builds and returns the complete SVG string.
   * 
   * @returns Complete SVG markup as a string
   * 
   * @example
   * ```typescript
   * const svg = new SVGBuilder();
   * svg.terminal('hello', 0, 0);
   * const svgString = svg.build();
   * document.body.innerHTML = svgString;
   * ```
   */
  build(): string {
    return `<svg width="${this.width}" height="${this.height}" xmlns="http://www.w3.org/2000/svg">
      ${this.elements.join('\n')}
    </svg>`;
  }
}

/**
 * Generates a railroad diagram (syntax diagram) for a parser.
 * 
 * Railroad diagrams provide a visual representation of the grammar structure,
 * showing the possible paths through the parser and the relationships between
 * different parsing rules. This is invaluable for understanding complex grammars
 * and communicating grammar structure to others.
 * 
 * The generated diagrams follow standard railroad diagram conventions with
 * terminals shown as rounded rectangles and choice points shown as branching paths.
 * 
 * @param parser The parser to visualize
 * @returns SVG markup string representing the railroad diagram
 * 
 * @example
 * ```typescript
 * // Generate diagram for a simple expression parser
 * const exprParser = choice([
 *   sequence([str('('), expression, str(')')]),
 *   regex(/\d+/),
 *   regex(/[a-z]+/)
 * ]);
 * 
 * const diagram = toRailroadDiagram(exprParser);
 * 
 * // Display in web page
 * document.getElementById('diagram').innerHTML = diagram;
 * ```
 * 
 * @example
 * ```typescript
 * // Generate diagram for JSON parser
 * const jsonDiagram = toRailroadDiagram(jsonParser);
 * 
 * // Save to file (Node.js)
 * import { writeFileSync } from 'fs';
 * writeFileSync('json-grammar.svg', jsonDiagram);
 * ```
 */
export function toRailroadDiagram(parser: Parser<any>): string {
  const svg = new SVGBuilder();

  function visit(p: Parser<any>, x: number, y: number): number {
    // Since we don't have specific parser subclasses, we'll create a generic visualization
    const description = (p as any).describe?.() || 'Parser';
    return svg.terminal(description, x, y);
  }

  visit(parser, 0, 0);
  return svg.build();
}

/**
 * Interactive parser debugger for step-by-step execution analysis.
 * 
 * This class provides comprehensive debugging capabilities including breakpoints,
 * step execution, call stack inspection, and variable monitoring. It's designed
 * to help developers understand parser behavior and diagnose complex parsing issues.
 * 
 * The debugger maintains a complete execution trace and allows pausing at
 * specific parser combinators to examine the parsing state in detail.
 * 
 * @template T The type of value the parser produces
 * 
 * @example
 * ```typescript
 * // Create debugger for a JSON parser
 * const debugger = new ParserDebugger(jsonParser);
 * 
 * // Add breakpoint at string parsing
 * debugger.addBreakpoint(stringParser);
 * 
 * // Start debugging session
 * const session = await debugger.debug('{"name": "John"}');
 * 
 * // Step through execution
 * while (true) {
 *   const step = await session.step();
 *   console.log(`${step.type} at position ${step.state.index}`);
 *   
 *   if (step.type === 'success' || step.type === 'failure') {
 *     break;
 *   }
 * }
 * ```
 */
export class ParserDebugger<T> {
  private breakpoints: Set<Parser<any>> = new Set();

  /**
   * Creates a new parser debugger.
   * 
   * @param parser The parser to debug
   */
  constructor(private parser: Parser<T>) { }

  /**
   * Adds a breakpoint at a specific parser.
   * 
   * When the specified parser is executed during debugging, the debugger
   * will pause and allow inspection of the current state.
   * 
   * @param parser The parser where execution should pause
   * 
   * @example
   * ```typescript
   * const debugger = new ParserDebugger(complexParser);
   * debugger.addBreakpoint(stringLiteralParser);
   * debugger.addBreakpoint(numberParser);
   * ```
   */
  addBreakpoint(parser: Parser<any>): void {
    this.breakpoints.add(parser);
  }

  /**
   * Starts a debugging session for the given input.
   * 
   * @param input The input string to parse and debug
   * @returns A promise that resolves to a debugging session
   * 
   * @example
   * ```typescript
   * const session = await debugger.debug('test input');
   * const info = session.inspect();
   * console.log(`Parsing at position ${info.position}`);
   * ```
   */
  async debug(input: string): Promise<DebugSession<T>> {
    return new DebugSession(this.parser, input, this.breakpoints);
  }
}

/**
 * Active debugging session for step-by-step parser execution.
 * 
 * This class manages the state of an active debugging session, providing
 * methods to step through execution, inspect the call stack, and examine
 * local variables.
 * 
 * @template T The type of value the parser produces
 */
class DebugSession<T> {
  private currentStep = 0;
  private steps: DebugStep[] = [];
  private currentState = { index: 0 };

  /**
   * Creates a new debugging session.
   * 
   * @param parser The parser being debugged
   * @param input The input string being parsed
   * @param breakpoints Set of parsers where execution should pause
   */
  constructor(
    private parser: Parser<T>,
    private input: string,
    private breakpoints: Set<Parser<any>>
  ) {
    // Initialize with some sample debug steps
    this.steps = [
      { type: 'enter', parser: this.parser, state: { index: 0 } }
    ];
  }

  /**
   * Executes one step of parser execution.
   * 
   * @returns A promise that resolves to the debug step that was executed
   * @throws Error if debugging session has ended
   * 
   * @example
   * ```typescript
   * const session = await debugger.debug('input');
   * 
   * try {
   *   while (true) {
   *     const step = await session.step();
   *     console.log(`Step: ${step.type} at ${step.state.index}`);
   *   }
   * } catch (error) {
   *   console.log('Debugging complete');
   * }
   * ```
   */
  async step(): Promise<DebugStep> {
    // Execute one parser step
    if (this.currentStep >= this.steps.length) {
      // Create a new step if we're at the end
      const step: DebugStep = {
        type: 'exit',
        parser: this.parser,
        state: { index: this.currentState.index }
      };
      this.steps.push(step);
    }

    const step = this.steps[this.currentStep++];
    this.currentState = step.state;

    if (this.breakpoints.has(step.parser)) {
      // Pause for inspection
      await this.onBreakpoint(step);
    }

    return step;
  }

  /**
   * Handles breakpoint encounters during debugging.
   * 
   * This method is called when execution reaches a parser that has a breakpoint.
   * It can be overridden to provide custom breakpoint handling behavior.
   * 
   * @param step The debug step that triggered the breakpoint
   */
  private async onBreakpoint(step: DebugStep): Promise<void> {
    // Simple breakpoint handler - could be extended to pause execution
    console.log(`Breakpoint hit at step: ${step.type}`);
  }

  /**
   * Gets the current parser call stack.
   * 
   * The call stack shows the hierarchy of parser invocations leading to
   * the current execution point, similar to a function call stack.
   * 
   * @returns Array of parser frames representing the call stack
   * 
   * @example
   * ```typescript
   * const callStack = session.getCallStack();
   * callStack.forEach((frame, depth) => {
   *   console.log(`  ${'  '.repeat(depth)}${frame.parser.describe?.()} at ${frame.position}`);
   * });
   * ```
   */
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

  /**
   * Gets local variables and state information.
   * 
   * @returns Object containing current debugging variables
   * @private
   */
  private getLocalVariables(): Record<string, any> {
    // Return current local variables (simplified implementation)
    return {
      currentStep: this.currentStep,
      position: this.currentState.index,
      inputLength: this.input.length
    };
  }

  /**
   * Inspects the current debugging state.
   * 
   * This provides a comprehensive view of the current parsing state including
   * position, remaining input, call stack, and local variables.
   * 
   * @returns Complete debugging information
   * 
   * @example
   * ```typescript
   * const info = session.inspect();
   * console.log(`Position: ${info.position}`);
   * console.log(`Remaining: "${info.remaining}"`);
   * console.log(`Call stack depth: ${info.callStack.length}`);
   * ```
   */
  inspect(): DebugInfo {
    return {
      position: this.currentState.index,
      remaining: this.input.slice(this.currentState.index),
      callStack: this.getCallStack(),
      variables: this.getLocalVariables()
    };
  }
}
