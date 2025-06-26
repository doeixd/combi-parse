// Parallel parser execution
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

// Web Worker based parallel parsing
export class WorkerParser<T> {
  private workers: Worker[] = [];

  constructor(
    private parserCode: string,
    private workerCount = navigator.hardwareConcurrency || 4
  ) {
    for (let i = 0; i < workerCount; i++) {
      const blob = new Blob([parserCode], { type: 'application/javascript' });
      const worker = new Worker(URL.createObjectURL(blob));
      this.workers.push(worker);
    }
  }

  async parseChunks(chunks: string[]): Promise<T[]> {
    const chunkSize = Math.ceil(chunks.length / this.workers.length);
    const promises: Promise<T[]>[] = [];

    for (let i = 0; i < this.workers.length; i++) {
      const workerChunks = chunks.slice(i * chunkSize, (i + 1) * chunkSize);
      if (workerChunks.length === 0) continue;

      promises.push(
        new Promise((resolve, reject) => {
          this.workers[i].onmessage = (e) => resolve(e.data);
          this.workers[i].onerror = reject;
          this.workers[i].postMessage({ chunks: workerChunks });
        })
      );
    }

    const results = await Promise.all(promises);
    return results.flat();
  }

  dispose() {
    this.workers.forEach(w => w.terminate());
  }
}