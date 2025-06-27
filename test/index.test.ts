import { describe, it, expect } from 'vitest';
import { str, number, sequence } from '../src';

describe('Main module exports', () => {
  it('should export core parser functions', () => {
    expect(str).toBeDefined();
    expect(number).toBeDefined();
    expect(sequence).toBeDefined();
  });

  it('should parse simple string', () => {
    const parser = str('hello');
    expect(parser.parse('hello')).toBe('hello');
  });
});
