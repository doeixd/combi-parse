// Incremental parsing for editors
export class IncrementalParser<T> {
  private lastParse?: {
    input: string;
    result: T;
    parseTree: ParseNode;
  };

  constructor(private parser: Parser<T>) { }

  parse(input: string, changes?: TextChange[]): IncrementalParseResult<T> {
    if (!this.lastParse || !changes) {
      // Full parse
      const start = performance.now();
      const result = this.parser.parse(input);
      const time = performance.now() - start;

      this.lastParse = {
        input,
        result,
        parseTree: buildParseTree(this.parser, input)
      };

      return { result, time, reusedNodes: 0 };
    }

    // Incremental parse
    const affected = this.findAffectedNodes(changes);
    const reusable = this.findReusableNodes(affected);

    // Re-parse only affected regions
    const result = this.reparseWithCache(input, reusable);

    return result;
  }

  private findAffectedNodes(changes: TextChange[]): ParseNode[] {
    // Find nodes that overlap with changes
    const affected: ParseNode[] = [];

    for (const change of changes) {
      this.walkTree(this.lastParse!.parseTree, node => {
        if (node.overlaps(change)) {
          affected.push(node);
        }
      });
    }

    return affected;
  }

  private reparseWithCache(
    input: string,
    cache: Map<string, ParseNode>
  ): IncrementalParseResult<T> {
    // Custom parser that checks cache first
    const cachedParser = this.createCachedParser(this.parser, cache);

    const start = performance.now();
    const result = cachedParser.parse(input);
    const time = performance.now() - start;

    return {
      result,
      time,
      reusedNodes: cache.size
    };
  }
}

// Text change tracking
interface TextChange {
  offset: number;
  length: number;
  text: string;
}

interface ParseNode {
  parser: Parser<any>;
  start: number;
  end: number;
  value: any;
  children: ParseNode[];

  overlaps(change: TextChange): boolean {
  return !(this.end < change.offset ||
    this.start > change.offset + change.length);
}
}