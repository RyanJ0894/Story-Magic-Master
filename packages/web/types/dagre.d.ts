declare module 'dagre' {
  export namespace graphlib {
    class Graph {
      setDefaultEdgeLabel(fn: () => Record<string, unknown>): void;
      setGraph(opts: Record<string, unknown>): void;
      setNode(id: string, opts: Record<string, unknown>): void;
      setEdge(source: string, target: string): void;
      node(id: string): { x: number; y: number; width: number; height: number };
    }
  }
  export function layout(graph: graphlib.Graph): void;
}
