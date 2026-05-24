export type VisualizationMode = 'step' | 'phase' | 'result';

export interface VisualizationToggles {
  readonly labels: boolean;
  readonly delaunayEdges: boolean;
  readonly splitLines: boolean;
  readonly candidateEdges: boolean;
  readonly circumcircles: boolean;
  readonly deletedEdges: boolean;
  readonly nearestArrows: boolean;
}

export const defaultToggles: VisualizationToggles = {
  labels: true,
  delaunayEdges: true,
  splitLines: true,
  candidateEdges: true,
  circumcircles: true,
  deletedEdges: true,
  nearestArrows: true,
};
