export type VisualizationMode = 'step' | 'phase' | 'result';

export type CanvasInputMode = 'pan' | 'add';

export interface PointLabelOptions {
  readonly inputLabels: boolean;
  readonly sortedLabels: boolean;
  readonly coordinates: boolean;
}

export interface EdgeLabelOptions {
  readonly pairLabels: boolean;
  readonly idLabels: boolean;
}

export interface VisualizationToggles {
  readonly delaunayEdges: boolean;
  readonly splitLines: boolean;
  readonly candidateEdges: boolean;
  readonly circumcircles: boolean;
  readonly deletedEdges: boolean;
  readonly nearestArrows: boolean;
}

export const defaultPointLabelOptions: PointLabelOptions = {
  inputLabels: true,
  sortedLabels: true,
  coordinates: false,
};

export const defaultEdgeLabelOptions: EdgeLabelOptions = {
  pairLabels: true,
  idLabels: false,
};

export const defaultToggles: VisualizationToggles = {
  delaunayEdges: true,
  splitLines: true,
  candidateEdges: true,
  circumcircles: true,
  deletedEdges: true,
  nearestArrows: true,
};
