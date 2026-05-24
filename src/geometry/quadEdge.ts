import type { DirectedEdge, Edge, QuadEdge } from './types';

export class QuadEdgeSubdivision {
  private readonly quads: QuadEdge[] = [];

  makeEdge(origin: number, destination: number): DirectedEdge {
    const e0 = this.createDirected(0, origin);
    const e1 = this.createDirected(1, null);
    const e2 = this.createDirected(2, destination);
    const e3 = this.createDirected(3, null);
    const quad: QuadEdge = { edges: [e0, e1, e2, e3] };

    e0.quad = quad;
    e1.quad = quad;
    e2.quad = quad;
    e3.quad = quad;
    e0.next = e0;
    e1.next = e3;
    e2.next = e2;
    e3.next = e1;

    this.quads.push(quad);
    return e0;
  }

  splice(a: DirectedEdge, b: DirectedEdge): void {
    const alpha = this.rot(this.onext(a));
    const beta = this.rot(this.onext(b));
    const t1 = this.onext(b);
    const t2 = this.onext(a);
    const t3 = this.onext(beta);
    const t4 = this.onext(alpha);

    a.next = t1;
    b.next = t2;
    alpha.next = t3;
    beta.next = t4;
  }

  connect(a: DirectedEdge, b: DirectedEdge): DirectedEdge {
    const edge = this.makeEdge(this.dest(a), this.orig(b));
    this.splice(edge, this.lnext(a));
    this.splice(this.sym(edge), b);
    return edge;
  }

  deleteEdge(edge: DirectedEdge): void {
    this.splice(edge, this.oprev(edge));
    this.splice(this.sym(edge), this.oprev(this.sym(edge)));
    edge.quad.edges.forEach((directed) => {
      directed.deleted = true;
    });
  }

  rot(edge: DirectedEdge): DirectedEdge {
    return edge.quad.edges[((edge.index + 1) % 4) as 0 | 1 | 2 | 3];
  }

  invRot(edge: DirectedEdge): DirectedEdge {
    return edge.quad.edges[((edge.index + 3) % 4) as 0 | 1 | 2 | 3];
  }

  sym(edge: DirectedEdge): DirectedEdge {
    return edge.quad.edges[((edge.index + 2) % 4) as 0 | 1 | 2 | 3];
  }

  onext(edge: DirectedEdge): DirectedEdge {
    return edge.next;
  }

  oprev(edge: DirectedEdge): DirectedEdge {
    return this.rot(this.onext(this.rot(edge)));
  }

  lnext(edge: DirectedEdge): DirectedEdge {
    return this.rot(this.onext(this.invRot(edge)));
  }

  rprev(edge: DirectedEdge): DirectedEdge {
    return this.onext(this.sym(edge));
  }

  orig(edge: DirectedEdge): number {
    if (edge.origin === null) {
      throw new Error('Directed edge has no primal origin.');
    }
    return edge.origin;
  }

  dest(edge: DirectedEdge): number {
    return this.orig(this.sym(edge));
  }

  edges(): readonly Edge[] {
    const edges: Edge[] = [];
    const seen = new Set<string>();

    for (const quad of this.quads) {
      const primal = quad.edges[0];
      if (primal.deleted) continue;
      const a = this.orig(primal);
      const b = this.dest(primal);
      if (a === b) continue;
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ a, b });
    }

    return edges;
  }

  private createDirected(index: 0 | 1 | 2 | 3, origin: number | null): DirectedEdge {
    return {
      index,
      origin,
      deleted: false,
      quad: null as unknown as QuadEdge,
      next: null as unknown as DirectedEdge,
    };
  }
}
