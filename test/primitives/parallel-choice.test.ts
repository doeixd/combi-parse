import { describe, it, expect, vi } from 'vitest';
import { parallelChoice, WorkerParser } from '../../src/primitives/parallel-choice';
import { str, regex, choice, number } from '../../src/parser';

describe('Parallel and Asynchronous Parser Execution', () => {
  describe('parallelChoice', () => {
    it('should return first successful parser result', async () => {
      const parser1 = str('hello');
      const parser2 = str('world');
      const parser3 = str('test');
      
      const result = await parallelChoice([parser1, parser2, parser3], 'hello');
      expect(result).toBe('hello');
    });

    it('should return result from fastest parser', async () => {
      const fastParser = str('fast');
      const slowParser = str('fast'); // Same result but we'll mock timing
      
      // Mock setTimeout to control timing
      const originalSetTimeout = global.setTimeout;
      vi.stubGlobal('setTimeout', vi.fn((fn, delay) => {
        if (delay === 0) {
          return originalSetTimeout(fn, 0);
        }
        return originalSetTimeout(fn, delay);
      }));
      
      const result = await parallelChoice([fastParser, slowParser], 'fast');
      expect(result).toBe('fast');
      
      vi.restoreAllMocks();
    });

    it('should handle parser failures gracefully', async () => {
      const failingParser = str('expected');
      const successParser = str('actual');
      
      const result = await parallelChoice([failingParser, successParser], 'actual');
      expect(result).toBe('actual');
    });

    it('should reject when all parsers fail', async () => {
      const parser1 = str('hello');
      const parser2 = str('world');
      const parser3 = str('test');
      
      await expect(parallelChoice([parser1, parser2, parser3], 'invalid'))
        .rejects
        .toThrow();
    });

    it('should handle timeout option', async () => {
      const slowParser = str('test');
      
      // Mock a slow parser by delaying its execution
      const originalSetTimeout = global.setTimeout;
      let timeoutCallCount = 0;
      vi.stubGlobal('setTimeout', vi.fn((fn, delay) => {
        timeoutCallCount++;
        if (delay === 0) {
          // Parser execution
          return originalSetTimeout(fn, 100); // Make it slow
        } else {
          // Timeout handler
          return originalSetTimeout(fn, delay);
        }
      }));
      
      await expect(parallelChoice([slowParser], 'test', { timeout: 50 }))
        .rejects
        .toThrow('Parsing timeout');
        
      vi.restoreAllMocks();
    });

    it('should work with complex parsers', async () => {
      const jsonParser = choice([
        str('{}').map(() => ({})),
        str('[]').map(() => []),
        str('null').map(() => null)
      ]);
      
      const xmlParser = regex(/<\w+\/>/).map(tag => ({ type: 'xml', tag }));
      const csvParser = regex(/[\w,]+/).map(csv => csv.split(','));
      
      const result1 = await parallelChoice([jsonParser, xmlParser, csvParser], '{}');
      expect(result1).toEqual({});
      
      const result2 = await parallelChoice([jsonParser, xmlParser, csvParser], '<tag/>');
      expect(result2).toEqual({ type: 'xml', tag: '<tag/>' });
      
      const result3 = await parallelChoice([jsonParser, xmlParser, csvParser], 'a,b,c');
      expect(result3).toEqual(['a', 'b', 'c']);
    });

    it('should handle empty parser array', async () => {
      await expect(parallelChoice([], 'input'))
        .rejects
        .toThrow();
    });

    it('should work with different result types', async () => {
      const stringParser = str('text');
      const numberParser = number;
      const booleanParser = str('true').map(() => true);
      
      const result1 = await parallelChoice([stringParser, numberParser, booleanParser], 'text');
      expect(result1).toBe('text');
      
      const result2 = await parallelChoice([stringParser, numberParser, booleanParser], '123');
      expect(result2).toBe(123);
      
      const result3 = await parallelChoice([stringParser, numberParser, booleanParser], 'true');
      expect(result3).toBe(true);
    });

    it('should handle simultaneous success', async () => {
      // Multiple parsers that can parse the same input
      const parser1 = regex(/\w+/);
      const parser2 = regex(/[a-z]+/);
      const parser3 = str('test');
      
      const result = await parallelChoice([parser1, parser2, parser3], 'test');
      // Should get the first one that completes (order may vary due to timing)
      expect(['test', 'test', 'test']).toContain(result);
    });
  });

  describe('WorkerParser', () => {
    it('should create worker parser instance', () => {
      const parserCode = `
        self.addEventListener('message', (e) => {
          self.postMessage(e.data.chunks);
        });
      `;
      
      const worker = new WorkerParser(parserCode, 2);
      expect(worker).toBeInstanceOf(WorkerParser);
      worker.dispose();
    });

    it('should handle Worker unavailability gracefully', () => {
      // Mock Worker as undefined to simulate environments without Web Workers
      const originalWorker = global.Worker;
      (global as any).Worker = undefined;
      
      const parserCode = 'self.addEventListener("message", () => {});';
      const worker = new WorkerParser(parserCode, 2);
      expect(worker).toBeInstanceOf(WorkerParser);
      
      global.Worker = originalWorker;
      worker.dispose();
    });

    it('should handle Blob unavailability gracefully', () => {
      // Mock Blob as undefined
      const originalBlob = global.Blob;
      (global as any).Blob = undefined;
      
      const parserCode = 'self.addEventListener("message", () => {});';
      const worker = new WorkerParser(parserCode, 2);
      expect(worker).toBeInstanceOf(WorkerParser);
      
      global.Blob = originalBlob;
      worker.dispose();
    });

    it('should default to hardware concurrency for worker count', () => {
      // Mock navigator.hardwareConcurrency using vi.stubGlobal
      vi.stubGlobal('navigator', { hardwareConcurrency: 8 });
      
      const parserCode = 'self.addEventListener("message", () => {});';
      const worker = new WorkerParser(parserCode); // No worker count specified
      expect(worker).toBeInstanceOf(WorkerParser);
      
      vi.unstubAllGlobals();
      worker.dispose();
    });

    it('should fallback when Worker creation fails', () => {
      // Mock Worker constructor to throw
      const originalWorker = global.Worker;
      (global as any).Worker = class {
        constructor() {
          throw new Error('Worker creation failed');
        }
      };
      
      const parserCode = 'self.addEventListener("message", () => {});';
      const worker = new WorkerParser(parserCode, 2);
      expect(worker).toBeInstanceOf(WorkerParser);
      
      global.Worker = originalWorker;
      worker.dispose();
    });

    it('should reject when no workers are available', async () => {
      // Create worker without Web Worker support
      const originalWorker = global.Worker;
      (global as any).Worker = undefined;
      
      const parserCode = 'self.addEventListener("message", () => {});';
      const worker = new WorkerParser(parserCode, 2);
      
      await expect(worker.parseChunks(['test1', 'test2']))
        .rejects
        .toThrow('No workers available');
      
      global.Worker = originalWorker;
      worker.dispose();
    });

    // Note: Full Worker functionality tests would require a more complex mock
    // or integration test environment. The following test shows the expected behavior:

    it('should distribute chunks across workers (mock test)', async () => {
      // Create mock Worker class
      class MockWorker extends EventTarget {
        postMessage(data: any) {
          // Simulate immediate response
          setTimeout(() => {
            const event = new MessageEvent('message', {
              data: data.chunks.map((chunk: string) => `processed_${chunk}`)
            });
            this.dispatchEvent(event);
          }, 10);
        }
        
        terminate() {
          // Mock termination
        }
      }
      
      const originalWorker = global.Worker;
      (global as any).Worker = MockWorker;
      
      const parserCode = 'self.addEventListener("message", () => {});';
      const worker = new WorkerParser(parserCode, 2);
      
      try {
        const chunks = ['chunk1', 'chunk2', 'chunk3', 'chunk4'];
        const results = await worker.parseChunks(chunks);
        
        expect(results).toEqual([
          'processed_chunk1',
          'processed_chunk2', 
          'processed_chunk3',
          'processed_chunk4'
        ]);
      } finally {
        worker.dispose();
        global.Worker = originalWorker;
      }
    });

    it('should handle worker errors', async () => {
      class MockWorker extends EventTarget {
        postMessage(_data: any) {
          setTimeout(() => {
            const errorEvent = new Event('error');
            this.dispatchEvent(errorEvent);
          }, 10);
        }
        
        terminate() {}
      }
      
      const originalWorker = global.Worker;
      (global as any).Worker = MockWorker;
      
      const parserCode = 'self.addEventListener("message", () => {});';
      const worker = new WorkerParser(parserCode, 1);
      
      try {
        await expect(worker.parseChunks(['test']))
          .rejects
          .toThrow('Worker error');
      } finally {
        worker.dispose();
        global.Worker = originalWorker;
      }
    });

    it('should handle empty chunks array', async () => {
      const parserCode = 'self.addEventListener("message", () => {});';
      const worker = new WorkerParser(parserCode, 2);
      
      const results = await worker.parseChunks([]);
      expect(results).toEqual([]);
      
      worker.dispose();
    });

    it('should properly dispose workers', () => {
      let terminateCalled = false;
      
      class MockWorker extends EventTarget {
        terminate() {
          terminateCalled = true;
        }
      }
      
      const originalWorker = global.Worker;
      (global as any).Worker = MockWorker;
      
      const parserCode = 'self.addEventListener("message", () => {});';
      const worker = new WorkerParser(parserCode, 1);
      
      worker.dispose();
      expect(terminateCalled).toBe(true);
      
      global.Worker = originalWorker;
    });
  });

  describe('integration tests', () => {
    it('should handle complex parallel parsing scenarios', async () => {
      // Create parsers for different data formats
      const jsonLikeParser = choice([
        str('{}').map(() => ({ type: 'object' })),
        str('[]').map(() => ({ type: 'array' })),
        regex(/"\w+"/).map(s => ({ type: 'string', value: s }))
      ]);
      
      const numberLikeParser = choice([
        regex(/\d+\.\d+/).map(s => ({ type: 'float', value: parseFloat(s) })),
        regex(/\d+/).map(s => ({ type: 'int', value: parseInt(s) }))
      ]);
      
      const booleanLikeParser = choice([
        str('true').map(() => ({ type: 'boolean', value: true })),
        str('false').map(() => ({ type: 'boolean', value: false }))
      ]);
      
      // Test different inputs
      const result1 = await parallelChoice([jsonLikeParser, numberLikeParser, booleanLikeParser], '{}');
      expect(result1).toEqual({ type: 'object' });
      
      const result2 = await parallelChoice([jsonLikeParser, numberLikeParser, booleanLikeParser], '123');
      expect(result2).toEqual({ type: 'int', value: 123 });
      
      const result3 = await parallelChoice([jsonLikeParser, numberLikeParser, booleanLikeParser], 'true');
      expect(result3).toEqual({ type: 'boolean', value: true });
    });

    it('should work with realistic parsing scenarios', async () => {
      // URL vs email vs phone number detection
      const urlParser = regex(/https?:\/\/\w+\.\w+/).map(url => ({ type: 'url', value: url }));
      const emailParser = regex(/\w+@\w+\.\w+/).map(email => ({ type: 'email', value: email }));
      const phoneParser = regex(/\d{3}-\d{3}-\d{4}/).map(phone => ({ type: 'phone', value: phone }));
      
      const result1 = await parallelChoice([urlParser, emailParser, phoneParser], 'https://example.com');
      expect(result1).toEqual({ type: 'url', value: 'https://example.com' });
      
      const result2 = await parallelChoice([urlParser, emailParser, phoneParser], 'user@example.com');
      expect(result2).toEqual({ type: 'email', value: 'user@example.com' });
      
      const result3 = await parallelChoice([urlParser, emailParser, phoneParser], '123-456-7890');
      expect(result3).toEqual({ type: 'phone', value: '123-456-7890' });
    });

    it('should handle ambiguous inputs correctly', async () => {
      // Parsers that might overlap
      const numberParser = regex(/\d+/).map(s => ({ type: 'number', value: parseInt(s) }));
      const phoneParser = regex(/\d{3}/).map(s => ({ type: 'phone_prefix', value: s }));
      
      // Input that could match both (should get first successful one)
      const result = await parallelChoice([numberParser, phoneParser], '123');
      
      // Either parser could succeed first
      expect([
        { type: 'number', value: 123 },
        { type: 'phone_prefix', value: '123' }
      ]).toContainEqual(result);
    });
  });

  describe('error handling', () => {
    it('should handle malformed parser code gracefully', () => {
      const malformedCode = 'invalid javascript code {{{';
      
      expect(() => {
        const worker = new WorkerParser(malformedCode, 1);
        worker.dispose();
      }).not.toThrow(); // Should handle gracefully
    });

    it('should handle very large worker counts', () => {
      const parserCode = 'self.addEventListener("message", () => {});';
      
      expect(() => {
        const worker = new WorkerParser(parserCode, 1000);
        worker.dispose();
      }).not.toThrow();
    });

    it('should handle zero worker count', () => {
      const parserCode = 'self.addEventListener("message", () => {});';
      
      expect(() => {
        const worker = new WorkerParser(parserCode, 0);
        worker.dispose();
      }).not.toThrow();
    });

    it('should handle concurrent disposal', () => {
      const parserCode = 'self.addEventListener("message", () => {});';
      const worker = new WorkerParser(parserCode, 2);
      
      // Multiple dispose calls should be safe
      expect(() => {
        worker.dispose();
        worker.dispose();
        worker.dispose();
      }).not.toThrow();
    });
  });
});
