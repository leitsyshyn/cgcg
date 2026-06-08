import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Cpu, Eraser, GitMerge, Pause, Play, Sparkles, Target, Upload, Waypoints } from 'lucide-react';
import { GeometryCanvas, type GeometryCanvasHandle } from './components/GeometryCanvas';
import { ResultPanel } from './components/ResultPanel';
import { TraceLog } from './components/TraceLog';
import type { AlgorithmResult, AppPoint } from './app/types';
import { tracePoint } from './app/types';
import { runLab } from './app/runLab';
import { filterTraceEvents, type TraceLevel } from './trace/recorder';
import { projectTraceFrame } from './trace/projector';
import type { TraceFrame } from './trace/frames';
import {
  defaultEdgeLabelOptions,
  defaultPointLabelOptions,
  defaultToggles,
  type CanvasInputMode,
  type EdgeLabelOptions,
  type PointLabelOptions,
  type VisualizationMode,
  type VisualizationToggles,
} from './app/visualization';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 620;
const DEFAULT_POINT_COUNT = 18;
const MAX_POINT_COUNT = 10_000;
const TRACE_OFF_POINT_LIMIT = 2_000;
const DEFAULT_GENERATION_EXTENT = 420;
const MAX_GENERATION_EXTENT = 10_000;

type GenerationAreaMode = 'spread' | 'viewport';

function idleFrame(points: readonly AppPoint[]): TraceFrame {
  return {
    index: -1,
    points: points.map(tracePoint),
    visibleEdges: [],
    highlightedEdges: [],
    deletedEdges: [],
    activeSubset: [],
    splitLines: [],
    activeBaseEdge: null,
    candidates: [],
    activeTriangle: null,
    testedPoint: null,
    circumcircle: null,
    nearestArrows: [],
    activeDistance: null,
    currentPhase: 'idle',
    explanation: 'Pan the plane, then use Add Points mode or Shift+click to place points.',
  };
}

export default function App() {
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<GeometryCanvasHandle | null>(null);
  const pendingViewActionRef = useRef<'fit' | 'reset' | null>(null);
  const [points, setPoints] = useState<AppPoint[]>([]);
  const [mode, setMode] = useState<VisualizationMode>('step');
  const [toggles, setToggles] = useState<VisualizationToggles>(defaultToggles);
  const [pointLabelOptions, setPointLabelOptions] = useState<PointLabelOptions>(defaultPointLabelOptions);
  const [edgeLabelOptions, setEdgeLabelOptions] = useState<EdgeLabelOptions>(defaultEdgeLabelOptions);
  const [canvasInputMode, setCanvasInputMode] = useState<CanvasInputMode>('pan');
  const [pointCount, setPointCount] = useState(DEFAULT_POINT_COUNT);
  const [generationAreaMode, setGenerationAreaMode] = useState<GenerationAreaMode>('spread');
  const [generationExtent, setGenerationExtent] = useState(DEFAULT_GENERATION_EXTENT);
  const [result, setResult] = useState<AlgorithmResult | null>(null);
  const [resultTraceLevel, setResultTraceLevel] = useState<TraceLevel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState(450);

  const effectiveMode: VisualizationMode = points.length > 100 && mode === 'step' ? 'result' : mode;
  const traceLevel: TraceLevel = effectiveMode === 'step' ? 'detailed' : 'phase';
  const events = useMemo(
    () => (result ? filterTraceEvents(result.trace, effectiveMode === 'step' ? 'detailed' : 'phase') : []),
    [effectiveMode, result],
  );
  const maxStep = Math.max(0, events.length - 1);
  const activeTraceIndex = result
    ? (events.length === 0 ? -1 : effectiveMode === 'result' ? maxStep : Math.min(step, maxStep))
    : -1;
  const frame = useMemo(
    () => (result
      ? (events.length > 0 ? projectTraceFrame(events, activeTraceIndex) : resultFrame(result, resultTraceLevel === 'off'))
      : idleFrame(points)),
    [activeTraceIndex, events, points, result, resultTraceLevel],
  );
  const visibleTraceEvents = result ? events.slice(0, activeTraceIndex + 1) : [];
  const activeEventId = activeTraceIndex >= 0 ? (events[activeTraceIndex]?.id ?? null) : null;
  const traceSkipped = resultTraceLevel === 'off';
  const playbackDisabled = !result || effectiveMode === 'result' || events.length === 0;

  useEffect(() => {
    if (!playing || effectiveMode === 'result') return;

    const timer = window.setInterval(() => {
      setStep((current) => {
        if (current >= maxStep) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, speedMs);

    return () => window.clearInterval(timer);
  }, [effectiveMode, maxStep, playing, speedMs]);

  useEffect(() => {
    const action = pendingViewActionRef.current;
    if (!action) return;

    if (action === 'fit') {
      canvasRef.current?.fitToPoints();
    } else {
      canvasRef.current?.resetView();
    }

    pendingViewActionRef.current = null;
  }, [points]);

  function resetExecution(): void {
    setResult(null);
    setResultTraceLevel(null);
    setError(null);
    setStep(0);
    setPlaying(false);
  }

  function replacePoints(nextPoints: readonly { x: number; y: number }[]): void {
    pendingViewActionRef.current = nextPoints.length > 0 ? 'fit' : 'reset';
    setPoints(
      nextPoints.map((point, index) => ({
        id: `p${index + 1}`,
        name: `S${index + 1}`,
        x: Math.round(point.x),
        y: Math.round(point.y),
        sortedIndex: null,
      })),
    );
    resetExecution();
  }

  const addPoint = useCallback((x: number, y: number): void => {
    setPoints((current) => [
      ...current,
      {
        id: `p${current.length + 1}`,
        name: `S${current.length + 1}`,
        x: Math.round(x),
        y: Math.round(y),
        sortedIndex: null,
      },
    ]);
    resetExecution();
  }, []);

  function generateRandom(): void {
    const count = clampPointCount(pointCount);
    const bounds = generationBounds(generationAreaMode, clampGenerationExtent(generationExtent), canvasRef.current);
    setPointCount(count);
    setGenerationExtent((current) => clampGenerationExtent(current));
    replacePoints(generateRandomPoints(count, bounds));
  }

  function generateStructured(): void {
    const count = clampPointCount(pointCount);
    const bounds = generationBounds(generationAreaMode, clampGenerationExtent(generationExtent), canvasRef.current);
    setPointCount(count);
    setGenerationExtent((current) => clampGenerationExtent(current));
    replacePoints(generateStructuredPoints(count, bounds));
  }

  function clear(): void {
    replacePoints([]);
  }

  function openUpload(): void {
    uploadInputRef.current?.click();
  }

  async function uploadPoints(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      const uploaded = parseUploadedPoints(text);
      if (uploaded.length < 2) {
        throw new Error('Upload must contain at least two points.');
      }
      replacePoints(uploaded);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : String(uploadError));
      setResult(null);
      setResultTraceLevel(null);
      setStep(0);
      setPlaying(false);
    }
  }

  function run(): void {
    setPlaying(false);

    const nextMode: VisualizationMode = points.length > 100 ? 'result' : effectiveMode;
    const runTraceLevel: TraceLevel = points.length > TRACE_OFF_POINT_LIMIT
      ? 'off'
      : points.length > 100
        ? 'phase'
        : traceLevel;

    if (nextMode !== mode) setMode(nextMode);

    const computed = runLab(points, runTraceLevel);
    if (!computed.ok) {
      setError([computed.error.message, ...(computed.error.details ?? [])].join(' '));
      setResult(null);
      setResultTraceLevel(null);
      return;
    }

    const projectedEvents = filterTraceEvents(computed.value.trace, nextMode === 'step' ? 'detailed' : 'phase');

    setError(null);
    setResult(computed.value);
    setResultTraceLevel(runTraceLevel);
    setStep(nextMode === 'result' ? Math.max(0, projectedEvents.length - 1) : 0);
  }

  function updateLayer(key: keyof VisualizationToggles, checked: boolean): void {
    setToggles((current) => ({ ...current, [key]: checked }));
  }

  function updatePointLabels(key: keyof PointLabelOptions, checked: boolean): void {
    setPointLabelOptions((current) => ({ ...current, [key]: checked }));
  }

  function updateEdgeLabels(key: keyof EdgeLabelOptions, checked: boolean): void {
    setEdgeLabelOptions((current) => ({ ...current, [key]: checked }));
  }

  function updateMode(nextMode: VisualizationMode): void {
    setMode(nextMode);
    if (nextMode === 'step' && resultTraceLevel && resultTraceLevel !== 'detailed') {
      setResult(null);
      setResultTraceLevel(null);
      setStep(0);
      setPlaying(false);
    }
  }

  return (
    <main className="dark h-svh overflow-hidden bg-background text-foreground">
      <input
        ref={uploadInputRef}
        type="file"
        accept=".txt,.csv,.json"
        className="hidden"
        onChange={(event) => {
          void uploadPoints(event);
        }}
      />

      <div className="grid h-full grid-cols-1 gap-3 p-3 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="grid min-h-0 gap-3 xl:grid-rows-[minmax(0,1fr)_220px]">
          <Card className="min-h-0 py-0">
            <CardContent className="h-full min-h-0 p-0">
              <GeometryCanvas
                ref={canvasRef}
                frame={frame}
                toggles={toggles}
                pointLabelOptions={pointLabelOptions}
                edgeLabelOptions={edgeLabelOptions}
                inputMode={canvasInputMode}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                onAddPoint={addPoint}
              />
            </CardContent>
          </Card>

          <TraceLog
            events={visibleTraceEvents}
            points={result?.points ?? points}
            activeEventId={activeEventId}
            pointCount={points.length}
            stepText={result && events.length > 0 ? `${activeTraceIndex + 1}/${events.length}` : '0/0'}
            phase={frame.currentPhase}
            mode={effectiveMode}
            runtimeMs={result?.runtimeMs ?? null}
            explanation={frame.explanation}
            traceSkipped={traceSkipped}
          />
        </section>

        <aside className="grid min-h-0 gap-3 xl:grid-rows-[auto_minmax(0,1fr)]">
          <Card className="py-0">
            <CardContent className="p-3">
              <div className="flex flex-col gap-3">
                <FieldSet>
                  <FieldLegend variant="label">Input</FieldLegend>
                  <FieldGroup className="gap-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Button type="button" variant="outline" size="sm" className="h-9" onClick={openUpload}>
                        <Upload data-icon="inline-start" />
                        Upload
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="h-9" onClick={generateRandom}>
                        <Sparkles data-icon="inline-start" />
                        Random
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="h-9" onClick={generateStructured}>
                        <GitMerge data-icon="inline-start" />
                        Structured
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="h-9" onClick={clear}>
                        <Eraser data-icon="inline-start" />
                        Clear
                      </Button>
                    </div>

                    <Field>
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <FieldLabel htmlFor="point-count">Point count</FieldLabel>
                        <span>2-{MAX_POINT_COUNT}</span>
                      </div>
                      <input
                        id="point-count"
                        type="number"
                        min={2}
                        max={MAX_POINT_COUNT}
                        step={1}
                        value={pointCount}
                        onChange={(event) => setPointCount(event.target.value === '' ? 0 : Number(event.target.value))}
                        onBlur={() => setPointCount((current) => clampPointCount(current))}
                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      />
                    </Field>

                    <div className="grid gap-2">
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>Generation area</span>
                        <span>{generationAreaMode === 'viewport' ? 'Current view' : 'Centered spread'}</span>
                      </div>
                      <ToggleGroup
                        type="single"
                        variant="outline"
                        value={generationAreaMode}
                        onValueChange={(value) => {
                          if (value) setGenerationAreaMode(value as GenerationAreaMode);
                        }}
                        className="grid w-full grid-cols-2"
                      >
                        <ToggleGroupItem value="spread" className="h-9 w-full text-sm">
                          Spread
                        </ToggleGroupItem>
                        <ToggleGroupItem value="viewport" className="h-9 w-full text-sm">
                          Viewport
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </div>

                    <Field>
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <FieldLabel htmlFor="generation-extent">Spread</FieldLabel>
                        <span>+/- {clampGenerationExtent(generationExtent)}</span>
                      </div>
                      <input
                        id="generation-extent"
                        type="number"
                        min={40}
                        max={MAX_GENERATION_EXTENT}
                        step={10}
                        value={generationExtent}
                        onChange={(event) => setGenerationExtent(event.target.value === '' ? 0 : Number(event.target.value))}
                        onBlur={() => setGenerationExtent((current) => clampGenerationExtent(current))}
                        disabled={generationAreaMode === 'viewport'}
                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
                      />
                    </Field>

                    <div className="grid gap-2">
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>Interaction</span>
                        <span>Shift+click adds in any mode</span>
                      </div>
                      <ToggleGroup
                        type="single"
                        variant="outline"
                        value={canvasInputMode}
                        onValueChange={(value) => {
                          if (value) setCanvasInputMode(value as CanvasInputMode);
                        }}
                        className="grid w-full grid-cols-2"
                      >
                        <ToggleGroupItem value="pan" className="h-9 w-full text-sm">
                          Pan / Zoom
                        </ToggleGroupItem>
                        <ToggleGroupItem value="add" className="h-9 w-full text-sm">
                          Add Points
                        </ToggleGroupItem>
                      </ToggleGroup>
                      <div className="grid grid-cols-2 gap-2">
                        <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => canvasRef.current?.fitToPoints()} disabled={points.length === 0}>
                          Fit View
                        </Button>
                        <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => canvasRef.current?.resetView()}>
                          Reset View
                        </Button>
                      </div>
                    </div>
                  </FieldGroup>
                </FieldSet>

                <FieldSet>
                  <FieldLegend variant="label">Mode</FieldLegend>
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    value={effectiveMode}
                    onValueChange={(value) => {
                      if (value) updateMode(value as VisualizationMode);
                    }}
                    className="grid w-full grid-cols-3"
                  >
                    <ToggleGroupItem value="step" className="h-9 w-full text-sm" disabled={points.length > 100}>
                      <Waypoints data-icon="inline-start" />
                      Step
                    </ToggleGroupItem>
                    <ToggleGroupItem value="phase" className="h-9 w-full text-sm">
                      <GitMerge data-icon="inline-start" />
                      Phase
                    </ToggleGroupItem>
                    <ToggleGroupItem value="result" className="h-9 w-full text-sm">
                      <Target data-icon="inline-start" />
                      Result
                    </ToggleGroupItem>
                  </ToggleGroup>
                </FieldSet>

                <FieldSet>
                  <FieldLegend variant="label">Playback</FieldLegend>
                  <FieldGroup className="gap-3">
                    <div className="grid grid-cols-3 gap-2">
                      <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={playbackDisabled}>
                        <ChevronLeft data-icon="inline-start" />
                        Prev
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => setPlaying((value) => !value)} disabled={playbackDisabled}>
                        {playing ? <Pause data-icon="inline-start" /> : <Play data-icon="inline-start" />}
                        {playing ? 'Pause' : 'Play'}
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => setStep((value) => Math.min(maxStep, value + 1))} disabled={playbackDisabled}>
                        Next
                        <ChevronRight data-icon="inline-end" />
                      </Button>
                    </div>

                    <Field>
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <FieldLabel htmlFor="step-slider">Steps</FieldLabel>
                        <span>{result ? `${activeTraceIndex + 1}/${events.length}` : '0/0'}</span>
                      </div>
                      <Slider
                        id="step-slider"
                        min={0}
                        max={Math.max(maxStep, 1)}
                        step={1}
                        value={[Math.max(0, activeTraceIndex)]}
                        onValueChange={(value) => setStep(value[0] ?? 0)}
                        disabled={playbackDisabled}
                      />
                    </Field>

                    <Field>
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <FieldLabel htmlFor="speed-slider">Speed</FieldLabel>
                        <span>{Math.round(((1700 - speedMs - 100) / 1500) * 100)}%</span>
                      </div>
                      <Slider
                        id="speed-slider"
                        min={100}
                        max={1600}
                        step={50}
                        value={[1700 - speedMs]}
                        onValueChange={(value) => setSpeedMs(1700 - (value[0] ?? 1250))}
                        disabled={playbackDisabled}
                      />
                    </Field>
                  </FieldGroup>
                </FieldSet>

                <div className="grid gap-3 xl:grid-cols-2 xl:gap-4">
                  <FieldSet>
                    <FieldLegend variant="label">Point labels</FieldLegend>
                    <FieldGroup className="gap-2">
                      <Field orientation="horizontal">
                        <Checkbox id="input-labels" checked={pointLabelOptions.inputLabels} onCheckedChange={(checked) => updatePointLabels('inputLabels', checked === true)} />
                        <FieldLabel htmlFor="input-labels">Input</FieldLabel>
                      </Field>
                      <Field orientation="horizontal">
                        <Checkbox id="sorted-labels" checked={pointLabelOptions.sortedLabels} onCheckedChange={(checked) => updatePointLabels('sortedLabels', checked === true)} />
                        <FieldLabel htmlFor="sorted-labels">Sorted</FieldLabel>
                      </Field>
                      <Field orientation="horizontal">
                        <Checkbox id="coordinate-labels" checked={pointLabelOptions.coordinates} onCheckedChange={(checked) => updatePointLabels('coordinates', checked === true)} />
                        <FieldLabel htmlFor="coordinate-labels">(x; y)</FieldLabel>
                      </Field>
                    </FieldGroup>
                  </FieldSet>

                  <FieldSet>
                    <FieldLegend variant="label">Edge labels</FieldLegend>
                    <FieldGroup className="gap-2">
                      <Field orientation="horizontal">
                        <Checkbox id="edge-pair-labels" checked={edgeLabelOptions.pairLabels} onCheckedChange={(checked) => updateEdgeLabels('pairLabels', checked === true)} />
                        <FieldLabel htmlFor="edge-pair-labels">P1-P2</FieldLabel>
                      </Field>
                      <Field orientation="horizontal">
                        <Checkbox id="edge-id-labels" checked={edgeLabelOptions.idLabels} onCheckedChange={(checked) => updateEdgeLabels('idLabels', checked === true)} />
                        <FieldLabel htmlFor="edge-id-labels">E1</FieldLabel>
                      </Field>
                    </FieldGroup>
                  </FieldSet>

                  <FieldSet className="xl:col-span-2">
                    <FieldLegend variant="label">Layers</FieldLegend>
                    <FieldGroup className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-4 gap-y-2">
                      <LayerField id="layer-delaunay" label="Delaunay" color="var(--canvas-edge)" checked={toggles.delaunayEdges} onCheckedChange={(checked) => updateLayer('delaunayEdges', checked)} />
                      <LayerField id="layer-split-lines" label="Split" color="var(--canvas-split)" checked={toggles.splitLines} onCheckedChange={(checked) => updateLayer('splitLines', checked)} />
                      <LayerField id="layer-candidates" label="Candidates" color="var(--canvas-edge-candidate)" checked={toggles.candidateEdges} onCheckedChange={(checked) => updateLayer('candidateEdges', checked)} />
                      <LayerField id="layer-circumcircles" label="Circles" color="var(--canvas-circle)" checked={toggles.circumcircles} onCheckedChange={(checked) => updateLayer('circumcircles', checked)} />
                      <LayerField id="layer-deleted" label="Deleted" color="var(--canvas-edge-deleted)" checked={toggles.deletedEdges} onCheckedChange={(checked) => updateLayer('deletedEdges', checked)} />
                      <LayerField id="layer-nearest" label="Nearest" color="var(--canvas-edge-nearest)" checked={toggles.nearestArrows} onCheckedChange={(checked) => updateLayer('nearestArrows', checked)} />
                    </FieldGroup>
                  </FieldSet>
                </div>

                <div className="grid gap-1 text-xs text-muted-foreground">
                  <p>Drag to pan. Use the wheel or trackpad pinch to zoom.</p>
                  <p>Random and structured generators can use a centered spread or the current viewport bounds.</p>
                  <p>Point and edge labels are hidden automatically in dense views.</p>
                  {points.length > TRACE_OFF_POINT_LIMIT ? <p>Trace recording is disabled above {TRACE_OFF_POINT_LIMIT.toLocaleString()} points.</p> : null}
                  {points.length > 100 && points.length <= TRACE_OFF_POINT_LIMIT ? <p>Detailed trace disabled above 100 points.</p> : null}
                  {mode === 'step' && resultTraceLevel === null && !result ? <p>Run again after switching back to step.</p> : null}
                  {error ? <span className="text-destructive">{error}</span> : null}
                </div>

                <Button type="button" size="sm" className="h-9" onClick={run} disabled={points.length < 2}>
                  <Cpu data-icon="inline-start" />
                  Run
                </Button>
              </div>
            </CardContent>
          </Card>

          {result ? (
            <ResultPanel result={result} />
          ) : (
            <Card size="sm" className="min-h-0 py-0">
              <CardContent className="flex h-full min-h-0 items-center justify-center py-3 text-sm text-muted-foreground">
                Run the algorithm to see nearest neighbors.
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </main>
  );
}

function LayerField({
  id,
  label,
  color,
  checked,
  onCheckedChange,
}: {
  readonly id: string;
  readonly label: string;
  readonly color: string;
  readonly checked: boolean;
  readonly onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <Field orientation="horizontal" className="min-w-0 w-full justify-start gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={(value) => onCheckedChange(value === true)} />
      <FieldLabel htmlFor={id} className="min-w-0 flex flex-1 items-center gap-2 text-sm">
        <span aria-hidden className="block h-0.5 w-5 shrink-0" style={{ backgroundColor: color }} />
        <span className="truncate">{label}</span>
      </FieldLabel>
    </Field>
  );
}

function resultFrame(result: AlgorithmResult, traceSkipped: boolean): TraceFrame {
  return {
    index: -1,
    points: result.points.map(tracePoint),
    visibleEdges: result.edges,
    highlightedEdges: [],
    deletedEdges: [],
    activeSubset: [],
    splitLines: [],
    activeBaseEdge: null,
    candidates: [],
    activeTriangle: null,
    testedPoint: null,
    circumcircle: null,
    nearestArrows: result.nearestNeighbors.flatMap((item) =>
      item.neighbors.map((neighbor) => ({
        from: result.points[item.point]?.id ?? '',
        to: result.points[neighbor]?.id ?? '',
      })),
    ),
    activeDistance: null,
    currentPhase: 'algorithm-complete',
    explanation: traceSkipped
      ? 'Algorithm completed. Trace recording was skipped for this input size.'
      : 'Algorithm completed.',
  };
}

interface GenerationBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

function clampPointCount(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_POINT_COUNT;
  return Math.max(2, Math.min(MAX_POINT_COUNT, Math.round(value)));
}

function clampGenerationExtent(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_GENERATION_EXTENT;
  return Math.max(40, Math.min(MAX_GENERATION_EXTENT, Math.round(value)));
}

function generationBounds(
  mode: GenerationAreaMode,
  extent: number,
  canvas: GeometryCanvasHandle | null,
): GenerationBounds {
  if (mode === 'viewport') {
    const viewportBounds = canvas?.getViewportBounds();
    if (viewportBounds) return viewportBounds;
  }

  return {
    minX: -extent,
    maxX: extent,
    minY: -extent,
    maxY: extent,
  };
}

function generateRandomPoints(count: number, bounds: GenerationBounds): readonly { x: number; y: number }[] {
  const safeBounds = ensureRandomCapacity(bounds, count);
  const generated: { x: number; y: number }[] = [];
  const used = new Set<string>();
  const minX = Math.ceil(safeBounds.minX);
  const maxX = Math.floor(safeBounds.maxX);
  const minY = Math.ceil(safeBounds.minY);
  const maxY = Math.floor(safeBounds.maxY);

  while (generated.length < count) {
    const x = randomInteger(minX, maxX);
    const y = randomInteger(minY, maxY);
    const key = `${x}:${y}`;
    if (used.has(key)) continue;
    used.add(key);
    generated.push({ x, y });
  }

  return generated;
}

function generateStructuredPoints(count: number, bounds: GenerationBounds): readonly { x: number; y: number }[] {
  const columns = Math.max(2, Math.ceil(Math.sqrt(count)));
  const rows = Math.ceil(count / columns);
  const safeBounds = ensureStructuredCapacity(bounds, columns, rows);
  const minX = Math.round(safeBounds.minX);
  const maxX = Math.round(safeBounds.maxX);
  const minY = Math.round(safeBounds.minY);
  const maxY = Math.round(safeBounds.maxY);
  const width = Math.max(maxX - minX, columns - 1);
  const height = Math.max(maxY - minY, rows - 1);

  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const baseX = columns === 1 ? minX : minX + Math.floor((column * width) / (columns - 1));
    const baseY = rows === 1 ? maxY : maxY - Math.floor((row * height) / (rows - 1));
    const stagger = row % 2 === 0 ? 0 : Math.max(1, Math.floor(width / Math.max(columns * 3, 3)));
    const nextBaseX = columns === 1 ? maxX : minX + Math.floor(((column + 1) * width) / (columns - 1));
    const maxStagger = column < columns - 1 ? Math.max(0, nextBaseX - baseX - 1) : 0;

    return {
      x: baseX + Math.min(stagger, maxStagger),
      y: baseY,
    };
  });
}

function ensureRandomCapacity(bounds: GenerationBounds, count: number): GenerationBounds {
  let safeBounds = normalizeBounds(bounds);

  while (integerCapacity(safeBounds) < count) {
    safeBounds = expandBounds(safeBounds, 1.25);
  }

  return safeBounds;
}

function ensureStructuredCapacity(bounds: GenerationBounds, columns: number, rows: number): GenerationBounds {
  const safeBounds = normalizeBounds(bounds);
  const centerX = (safeBounds.minX + safeBounds.maxX) / 2;
  const centerY = (safeBounds.minY + safeBounds.maxY) / 2;
  const halfWidth = Math.max((safeBounds.maxX - safeBounds.minX) / 2, (columns - 1) / 2);
  const halfHeight = Math.max((safeBounds.maxY - safeBounds.minY) / 2, (rows - 1) / 2);

  return {
    minX: centerX - halfWidth,
    maxX: centerX + halfWidth,
    minY: centerY - halfHeight,
    maxY: centerY + halfHeight,
  };
}

function normalizeBounds(bounds: GenerationBounds): GenerationBounds {
  return {
    minX: Math.min(bounds.minX, bounds.maxX),
    maxX: Math.max(bounds.minX, bounds.maxX),
    minY: Math.min(bounds.minY, bounds.maxY),
    maxY: Math.max(bounds.minY, bounds.maxY),
  };
}

function integerCapacity(bounds: GenerationBounds): number {
  const width = Math.max(1, Math.floor(bounds.maxX) - Math.ceil(bounds.minX) + 1);
  const height = Math.max(1, Math.floor(bounds.maxY) - Math.ceil(bounds.minY) + 1);
  return width * height;
}

function expandBounds(bounds: GenerationBounds, multiplier: number): GenerationBounds {
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const halfWidth = Math.max(1, ((bounds.maxX - bounds.minX) / 2) * multiplier);
  const halfHeight = Math.max(1, ((bounds.maxY - bounds.minY) / 2) * multiplier);

  return {
    minX: centerX - halfWidth,
    maxX: centerX + halfWidth,
    minY: centerY - halfHeight,
    maxY: centerY + halfHeight,
  };
}

function randomInteger(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function parseUploadedPoints(text: string): readonly { x: number; y: number }[] {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Uploaded file is empty.');
  }

  const parsedJson = tryParseJsonPoints(trimmed);
  if (parsedJson) {
    return parsedJson.map(({ x, y }) => ({ x: Math.round(x), y: Math.round(y) }));
  }

  const rawLines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));

  const lines = rawLines.length > 1 && /^\d+$/.test(rawLines[0] ?? '') ? rawLines.slice(1) : rawLines;
  const points = lines.map(parsePointLine).filter((point): point is { x: number; y: number } => Boolean(point));

  if (points.length === 0) {
    throw new Error('Could not parse points from the uploaded file. Use JSON or one point per line.');
  }

  return points.map(({ x, y }) => ({ x: Math.round(x), y: Math.round(y) }));
}

function tryParseJsonPoints(text: string): readonly { x: number; y: number }[] | null {
  try {
    const value = JSON.parse(text);
    if (!Array.isArray(value)) return null;

    const points = value.flatMap((item) => {
      if (Array.isArray(item) && item.length >= 2 && Number.isFinite(item[0]) && Number.isFinite(item[1])) {
        return [{ x: Number(item[0]), y: Number(item[1]) }];
      }

      if (
        item &&
        typeof item === 'object' &&
        'x' in item &&
        'y' in item &&
        Number.isFinite(item.x) &&
        Number.isFinite(item.y)
      ) {
        return [{ x: Number(item.x), y: Number(item.y) }];
      }

      return [];
    });

    return points.length > 0 ? points : null;
  } catch {
    return null;
  }
}

function parsePointLine(line: string): { x: number; y: number } | null {
  const parts = line.replace(/[;,]/g, ' ').split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;

  const numeric = parts.map((part) => Number(part));
  const first = numeric[0] ?? Number.NaN;
  const second = numeric[1] ?? Number.NaN;
  const third = numeric[2] ?? Number.NaN;

  if (numeric.length >= 2 && Number.isFinite(first) && Number.isFinite(second)) {
    return { x: first, y: second };
  }

  if (numeric.length >= 3 && Number.isFinite(second) && Number.isFinite(third)) {
    return { x: second, y: third };
  }

  return null;
}
