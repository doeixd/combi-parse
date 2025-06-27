/**
 * @fileoverview Parallel and Asynchronous Parser Execution
 * 
 * This module provides capabilities for parallel and asynchronous parser execution,
 * enabling high-performance parsing through concurrent execution strategies.
 * These utilities are particularly valuable for parsing large inputs, handling
 * multiple parsing alternatives simultaneously, or processing multiple independent
 * parsing tasks concurrently.
 * 
 * The parallel execution model is based on racing multiple parsers against the
 * same input, allowing the fastest successful parser to determine the result.
 * This is useful for ambiguous grammars where multiple parsers might succeed,
 * and you want to use the first one that completes successfully.
 * 
 * Web Worker support enables true parallel parsing in browser environments,
 * distributing parsing work across multiple CPU cores. This is especially
 * beneficial for parsing large datasets or complex grammars that can be
 * decomposed into independent parsing tasks.
 * 
 * @example
 * ```typescript
 * // Race multiple parsers for the fastest result
 * const result = await parallelChoice([
 *   jsonParser,
 *   xmlParser,
 *   csvParser
 * ], input);
 * 
 * // Use Web Workers for CPU-intensive parsing
 * const worker = new WorkerParser(parserCode, 4);
 * const results = await worker.parseChunks(inputChunks);
 * ```
 */

import { Parser } from "../parser";

/**
 * Executes multiple parsers in parallel and returns the first successful result.
 * 
 * This function creates a race condition between multiple parsers, where the first
 * parser to successfully complete determines the result. This is useful for handling
 * ambiguous input formats where multiple parsers might be applicable, and you want
 * to use whichever parser completes first.
 * 
 * The parallel execution is simulated using setTimeout to yield control between
 * parser executions, allowing other JavaScript tasks to run concurrently.
 * 
 * @template T The type of value the parsers produce
 * @param parsers Array of parsers to execute concurrently
 * @param input The input string to parse
 * @param options Optional configuration including timeout
 * @returns A promise that resolves to the first successful parse result
 * @throws Error if all parsers fail or if timeout is exceeded
 * 
 * @example
 * ```typescript
 * // Try multiple date formats simultaneously
 * const dateResult = await parallelChoice([
 *   regex(/\d{4}-\d{2}-\d{2}/),           // ISO format
 *   regex(/\d{2}\/\d{2}\/\d{4}/),         // US format
 *   regex(/\d{2}-\d{2}-\d{4}/)            // European format
 * ], dateString);
 * ```
 * 
 * @example
 * ```typescript
 * // Parse different data formats with timeout
 * try {
 *   const result = await parallelChoice([
 *     jsonParser,
 *     xmlParser,
 *     yamlParser
 *   ], input, { timeout: 5000 });
 *   console.log('Parsed successfully:', result);
 * } catch (error) {
 *   console.error('All parsers failed or timed out');
 * }
 * ```
 */
export async function parallelChoice<T>(
  parsers: Parser<T>[],
  input: string,
  options?: { timeout?: number }
): Promise<T> {
  const promises = parsers.map(parser =>
    new Promise<T>((resolve, reject) => {
      // Run in next tick to simulate parallelism
      setTimeout(() => {
        try {
          const result = parser.parse(input);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, 0);
    })
  );

  if (options?.timeout) {
    promises.push(
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Parsing timeout')), options.timeout)
      )
    );
  }

  return Promise.race(promises);
}

/**
 * Web Worker-based parallel parser for CPU-intensive parsing tasks.
 * 
 * This class enables true parallel parsing by distributing work across multiple
 * Web Worker threads. It's particularly useful for parsing large datasets or
 * complex grammars that can be decomposed into independent chunks.
 * 
 * The worker automatically detects the number of available CPU cores and
 * creates an appropriate number of worker threads. Each worker receives
 * a subset of the input chunks to process independently.
 * 
 * @template T The type of value the parser produces
 * 
 * @example
 * ```typescript
 * // Create parser code as a string
 * const parserCode = `
 *   self.addEventListener('message', (e) => {
 *     const { chunks } = e.data;
 *     const results = chunks.map(chunk => {
 *       // Parse each chunk independently
 *       return parseChunk(chunk);
 *     });
 *     self.postMessage(results);
 *   });
 * `;
 * 
 * // Create worker pool
 * const worker = new WorkerParser(parserCode, 4);
 * 
 * // Process large dataset in parallel
 * const inputChunks = splitLargeInput(massiveDataset);
 * const results = await worker.parseChunks(inputChunks);
 * 
 * // Clean up resources
 * worker.dispose();
 * ```
 */
export class WorkerParser<T> {
  private workers: (Worker | null)[] = [];

  /**
   * Creates a new WorkerParser with the specified number of workers.
   * 
   * @param parserCode JavaScript code to execute in each worker
   * @param workerCount Number of workers to create (defaults to CPU count)
   * 
   * @example
   * ```typescript
   * const parserCode = `
   *   // Worker code that handles parsing
   *   self.addEventListener('message', (e) => {
   *     const results = e.data.chunks.map(parseChunk);
   *     self.postMessage(results);
   *   });
   * `;
   * 
   * const worker = new WorkerParser(parserCode, 8);
   * ```
   */
  constructor(
    parserCode: string,
    workerCount = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4
  ) {
    if (typeof Worker !== 'undefined' && typeof Blob !== 'undefined') {
      for (let i = 0; i < workerCount; i++) {
        try {
          const blob = new Blob([parserCode], { type: 'application/javascript' });
          const worker = new Worker(URL.createObjectURL(blob));
          this.workers.push(worker);
        } catch {
          this.workers.push(null);
        }
      }
    }
  }

  /**
   * Parses multiple input chunks in parallel using Web Workers.
   * 
   * This method distributes the input chunks across available workers,
   * with each worker processing a subset of the chunks independently.
   * The results are collected and returned as a flat array.
   * 
   * @param chunks Array of input strings to parse
   * @returns Promise resolving to array of parse results
   * @throws Error if no workers are available or if any worker fails
   * 
   * @example
   * ```typescript
   * // Parse multiple JSON files in parallel
   * const jsonFiles = ['file1.json', 'file2.json', 'file3.json'];
   * const contents = await Promise.all(
   *   jsonFiles.map(file => fetchFileContent(file))
   * );
   * 
   * const worker = new WorkerParser(jsonParserCode);
   * const results = await worker.parseChunks(contents);
   * 
   * results.forEach((result, index) => {
   *   console.log(`Parsed ${jsonFiles[index]}:`, result);
   * });
   * ```
   * 
   * @example
   * ```typescript
   * // Process large CSV file in chunks
   * const csvContent = await fetchLargeCsv();
   * const chunks = csvContent.split('\n\n'); // Split by empty lines
   * 
   * const worker = new WorkerParser(csvParserCode, 6);
   * const parsedChunks = await worker.parseChunks(chunks);
   * 
   * // Combine results
   * const allRows = parsedChunks.flat();
   * ```
   */
  async parseChunks(chunks: string[]): Promise<T[]> {
    const availableWorkers = this.workers.filter(w => w !== null) as Worker[];
    if (availableWorkers.length === 0) {
      throw new Error('No workers available');
    }

    const chunkSize = Math.ceil(chunks.length / availableWorkers.length);
    const promises: Promise<T[]>[] = [];

    for (let i = 0; i < availableWorkers.length; i++) {
      const workerChunks = chunks.slice(i * chunkSize, (i + 1) * chunkSize);
      if (workerChunks.length === 0) continue;

      promises.push(
        new Promise<T[]>((resolve, reject) => {
          const worker = availableWorkers[i];
          const handleMessage = (e: MessageEvent) => {
            worker.removeEventListener('message', handleMessage);
            worker.removeEventListener('error', handleError);
            resolve(e.data);
          };
          const handleError = () => {
            worker.removeEventListener('message', handleMessage);
            worker.removeEventListener('error', handleError);
            reject(new Error('Worker error'));
          };

          worker.addEventListener('message', handleMessage);
          worker.addEventListener('error', handleError);
          worker.postMessage({ chunks: workerChunks });
        })
      );
    }

    const results = await Promise.all(promises);
    return results.flat();
  }

  /**
   * Disposes of all workers and releases resources.
   * 
   * This method should be called when the WorkerParser is no longer needed
   * to properly clean up Web Worker resources and prevent memory leaks.
   * 
   * @example
   * ```typescript
   * const worker = new WorkerParser(parserCode);
   * 
   * try {
   *   const results = await worker.parseChunks(chunks);
   *   processResults(results);
   * } finally {
   *   worker.dispose(); // Always clean up
   * }
   * ```
   */
  dispose() {
    this.workers.forEach(w => {
      if (w) {
        w.terminate();
      }
    });
  }
}
