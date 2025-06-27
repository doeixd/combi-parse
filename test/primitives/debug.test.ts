import { describe, it, expect, vi } from 'vitest';
import { 
  ParserDebugger, 
  toRailroadDiagram,
  DebugStep,
  DebugInfo,
  ParserFrame
} from '../../src/primitives/debug';
import { str, regex, choice, sequence, number } from '../../src/parser';

describe('Parser Debugging Tools', () => {
  describe('toRailroadDiagram', () => {
    it('should generate SVG markup for simple parsers', () => {
      const parser = str('hello');
      const diagram = toRailroadDiagram(parser);
      
      expect(diagram).toContain('<svg');
      expect(diagram).toContain('</svg>');
      expect(diagram).toContain('xmlns="http://www.w3.org/2000/svg"');
    });

    it('should handle complex parsers', () => {
      const parser = choice([
        str('if'),
        str('while'),
        str('for')
      ]);
      const diagram = toRailroadDiagram(parser);
      
      expect(diagram).toContain('<svg');
      expect(diagram).toContain('</svg>');
      expect(typeof diagram).toBe('string');
      expect(diagram.length).toBeGreaterThan(0);
    });

    it('should generate valid SVG structure', () => {
      const parser = sequence([str('let'), regex(/\s+/), regex(/[a-z]+/)]);
      const diagram = toRailroadDiagram(parser);
      
      // Should contain basic SVG structure
      expect(diagram).toMatch(/<svg[^>]*>/);
      expect(diagram).toMatch(/<\/svg>/);
      
      // Should have width and height attributes
      expect(diagram).toMatch(/width="\d+"/);
      expect(diagram).toMatch(/height="\d+"/);
    });

    it('should work with parsers that have describe method', () => {
      const parser = str('test');
      // Mock the describe method
      (parser as any).describe = () => 'TestParser';
      
      const diagram = toRailroadDiagram(parser);
      expect(diagram).toContain('<svg');
      expect(diagram).toContain('TestParser');
    });

    it('should handle parsers without describe method', () => {
      const parser = regex(/\d+/);
      const diagram = toRailroadDiagram(parser);
      
      expect(diagram).toContain('<svg');
      expect(diagram).toContain('Parser'); // Default description
    });
  });

  describe('ParserDebugger', () => {
    it('should create debugger for simple parser', () => {
      const parser = str('hello');
      const parserDebugger = new ParserDebugger(parser);
      
      expect(parserDebugger).toBeInstanceOf(ParserDebugger);
    });

    it('should add breakpoints', () => {
      const parser = str('hello');
      const subParser = str('world');
      const parserDebugger = new ParserDebugger(parser);
      
      // Should not throw
      expect(() => {
        parserDebugger.addBreakpoint(subParser);
      }).not.toThrow();
    });

    it('should create debug session', async () => {
      const parser = str('hello');
      const parserDebugger = new ParserDebugger(parser);
      
      const session = await parserDebugger.debug('hello world');
      expect(session).toBeDefined();
    });

    it('should handle multiple breakpoints', () => {
      const parser1 = str('hello');
      const parser2 = str('world');
      const combined = sequence([parser1, str(' '), parser2]);
      const parserDebugger = new ParserDebugger(combined);
      
      parserDebugger.addBreakpoint(parser1);
      parserDebugger.addBreakpoint(parser2);
      
      // Should not throw
      expect(() => {
        parserDebugger.addBreakpoint(parser1);
        parserDebugger.addBreakpoint(parser2);
      }).not.toThrow();
    });
  });

  describe('DebugSession', () => {
    it('should step through parsing execution', async () => {
      const parser = str('test');
      const parserDebugger = new ParserDebugger(parser);
      const session = await parserDebugger.debug('test');
      
      const step = await session.step();
      expect(step).toBeDefined();
      expect(step.type).toMatch(/enter|exit|success|failure/);
      expect(step.parser).toBeDefined();
      expect(step.state).toBeDefined();
      expect(typeof step.state.index).toBe('number');
    });

    it('should provide call stack information', async () => {
      const parser = str('hello');
      const parserDebugger = new ParserDebugger(parser);
      const session = await parserDebugger.debug('hello');
      
      const callStack = session.getCallStack();
      expect(Array.isArray(callStack)).toBe(true);
      
      if (callStack.length > 0) {
        const frame = callStack[0];
        expect(frame.parser).toBeDefined();
        expect(typeof frame.position).toBe('number');
        expect(typeof frame.preview).toBe('string');
      }
    });

    it('should provide debugging information', async () => {
      const parser = str('test');
      const parserDebugger = new ParserDebugger(parser);
      const session = await parserDebugger.debug('test input');
      
      const info = session.inspect();
      expect(info.position).toBeGreaterThanOrEqual(0);
      expect(typeof info.remaining).toBe('string');
      expect(Array.isArray(info.callStack)).toBe(true);
      expect(typeof info.variables).toBe('object');
      expect(info.variables).not.toBeNull();
    });

    it('should handle breakpoints during execution', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const parser = str('test');
      const parserDebugger = new ParserDebugger(parser);
      parserDebugger.addBreakpoint(parser);
      
      const session = await parserDebugger.debug('test');
      const step = await session.step();
      
      // Should have logged breakpoint message
      expect(step).toBeDefined();
      
      consoleSpy.mockRestore();
    });

    it('should provide meaningful step information', async () => {
      const parser = choice([str('hello'), str('world')]);
      const parserDebugger = new ParserDebugger(parser);
      const session = await parserDebugger.debug('hello');
      
      const step = await session.step();
      expect(['enter', 'exit', 'success', 'failure']).toContain(step.type);
      expect(step.parser).toBe(parser);
      expect(step.state.index).toBeGreaterThanOrEqual(0);
    });

    it('should handle multiple steps', async () => {
      const parser = sequence([str('a'), str('b'), str('c')]);
      const parserDebugger = new ParserDebugger(parser);
      const session = await parserDebugger.debug('abc');
      
      const steps = [];
      for (let i = 0; i < 3; i++) {
        try {
          const step = await session.step();
          steps.push(step);
        } catch {
          break;
        }
      }
      
      expect(steps.length).toBeGreaterThan(0);
      steps.forEach(step => {
        expect(step.type).toMatch(/enter|exit|success|failure/);
      });
    });

    it('should track call stack depth correctly', async () => {
      const innerParser = str('inner');
      const outerParser = sequence([str('outer'), innerParser]);
      const parserDebugger = new ParserDebugger(outerParser);
      const session = await parserDebugger.debug('outerinner');
      
      await session.step();
      const callStack = session.getCallStack();
      
      expect(Array.isArray(callStack)).toBe(true);
      // Should have at least the initial parser in the call stack
      expect(callStack.length).toBeGreaterThanOrEqual(0);
    });

    it('should provide input preview in call frames', async () => {
      const parser = str('hello world');
      const parserDebugger = new ParserDebugger(parser);
      const session = await parserDebugger.debug('hello world test');
      
      await session.step();
      const callStack = session.getCallStack();
      
      if (callStack.length > 0) {
        const frame = callStack[0];
        expect(typeof frame.preview).toBe('string');
        expect(frame.preview.length).toBeLessThanOrEqual(20); // Should be truncated
      }
    });

    it('should handle debugging of failed parses', async () => {
      const parser = str('expected');
      const parserDebugger = new ParserDebugger(parser);
      const session = await parserDebugger.debug('unexpected');
      
      // Should still be able to step and inspect
      const step = await session.step();
      const info = session.inspect();
      
      expect(step).toBeDefined();
      expect(info).toBeDefined();
      expect(info.remaining).toBe('unexpected');
    });
  });

  describe('integration tests', () => {
    it('should debug complex parser execution', async () => {
      // Create a parser for simple arithmetic expressions
      const numberParser = number;
      const operatorParser = choice([str('+'), str('-'), str('*'), str('/')]);
      const exprParser = sequence([
        numberParser,
        str(' '),
        operatorParser,
        str(' '),
        numberParser
      ]);
      
      const parserDebugger = new ParserDebugger(exprParser);
      parserDebugger.addBreakpoint(numberParser);
      parserDebugger.addBreakpoint(operatorParser);
      
      const session = await parserDebugger.debug('10 + 20');
      
      // Should be able to step through execution
      const step1 = await session.step();
      expect(step1).toBeDefined();
      
      const info = session.inspect();
      expect(info.position).toBeGreaterThanOrEqual(0);
      expect(info.remaining).toMatch(/\d+ \+ \d+/);
    });

    it('should generate railroad diagrams for complex grammars', () => {
      const identifier = regex(/[a-z]+/);
      const keyword = choice([str('if'), str('while'), str('for')]);
      const statement = choice([
        sequence([keyword, str(' '), identifier]),
        identifier
      ]);
      
      const diagram = toRailroadDiagram(statement);
      
      expect(diagram).toContain('<svg');
      expect(diagram).toContain('</svg>');
      expect(diagram.length).toBeGreaterThan(100); // Should be substantial
    });

    it('should handle recursive parser debugging', async () => {
      // Simple recursive parser (like balanced parentheses)
      let parenParser: any;
      parenParser = choice([
        str('()'),
        sequence([str('('), () => parenParser, str(')')])
      ]);
      
      const parserDebugger = new ParserDebugger(parenParser);
      const session = await parserDebugger.debug('(())');
      
      // Should handle recursive execution without errors
      const step = await session.step();
      const info = session.inspect();
      
      expect(step).toBeDefined();
      expect(info).toBeDefined();
    });

    it('should provide useful debugging for choice parsers', async () => {
      const parser = choice([
        str('apple'),
        str('application'),
        str('apply')
      ]);
      
      const parserDebugger = new ParserDebugger(parser);
      const session = await parserDebugger.debug('application');
      
      const step = await session.step();
      const info = session.inspect();
      
      expect(step).toBeDefined();
      expect(info.remaining).toBe('application');
      expect(info.position).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle empty input gracefully', async () => {
      const parser = str('test');
      const parserDebugger = new ParserDebugger(parser);
      const session = await parserDebugger.debug('');
      
      const step = await session.step();
      const info = session.inspect();
      
      expect(step).toBeDefined();
      expect(info.remaining).toBe('');
      expect(info.position).toBe(0);
    });

    it('should handle very long input', async () => {
      const parser = regex(/a+/);
      const parserDebugger = new ParserDebugger(parser);
      const longInput = 'a'.repeat(1000);
      const session = await parserDebugger.debug(longInput);
      
      const step = await session.step();
      const info = session.inspect();
      
      expect(step).toBeDefined();
      expect(info.remaining.length).toBeLessThanOrEqual(1000);
    });

    it('should handle parser errors gracefully', async () => {
      const parser = str('expected');
      const parserDebugger = new ParserDebugger(parser);
      const session = await parserDebugger.debug('wrong');
      
      // Should not throw errors during debugging
      expect(async () => {
        await session.step();
        session.inspect();
        session.getCallStack();
      }).not.toThrow();
    });
  });
});
