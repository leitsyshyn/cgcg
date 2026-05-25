import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, SkipBack } from 'lucide-react';
import { GeometryCanvas } from './components/GeometryCanvas';
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
  type EdgeLabelOptions,
  type PointLabelOptions,
  type VisualizationMode,
  type VisualizationToggles,
} from './app/visualization';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 620;

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
    explanation: 'Click inside the plane to add points, then run the algorithm.',
  };
}

export default function App() {
  const [points, setPoints] = useState<AppPoint[]>([]);
  const [mode, setMode] = useState<VisualizationMode>('step');
  const [toggles, setToggles] = useState<VisualizationToggles>(defaultToggles);
  const [pointLabelOptions, setPointLabelOptions] = useState<PointLabelOptions>(defaultPointLabelOptions);
  const [edgeLabelOptions, setEdgeLabelOptions] = useState<EdgeLabelOptions>(defaultEdgeLabelOptions);
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
  const activeTraceIndex = result ? (effectiveMode === 'result' ? maxStep : Math.min(step, maxStep)) : -1;
  const frame = useMemo(
    () => (result ? projectTraceFrame(events, activeTraceIndex) : idleFrame(points)),
    [activeTraceIndex, events, points, result],
  );
  const visibleTraceEvents = result ? events.slice(0, activeTraceIndex + 1) : [];
  const activeEventId = activeTraceIndex >= 0 ? (events[activeTraceIndex]?.id ?? null) : null;

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

  function resetExecution(): void {
    setResult(null);
    setResultTraceLevel(null);
    setError(null);
    setStep(0);
    setPlaying(false);
  }

  function addPoint(x: number, y: number): void {
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
  }

  function generateRandom(): void {
    const count = 18;
    setPoints(
      Array.from({ length: count }, (_, index) => ({
        id: `p${index + 1}`,
        name: `S${index + 1}`,
        x: 60 + Math.round(Math.random() * (CANVAS_WIDTH - 120)),
        y: 60 + Math.round(Math.random() * (CANVAS_HEIGHT - 120)),
        sortedIndex: null,
      })),
    );
    resetExecution();
  }

  function generateGrid(): void {
    const generated: AppPoint[] = [];
    let index = 1;

    for (let row = 0; row < 4; row += 1) {
      for (let column = 0; column < 5; column += 1) {
        generated.push({
          id: `p${index}`,
          name: `S${index}`,
          x: 170 + column * 120 + (row % 2) * 20,
          y: 130 + row * 95,
          sortedIndex: null,
        });
        index += 1;
      }
    }

    setPoints(generated);
    resetExecution();
  }

  function clear(): void {
    setPoints([]);
    resetExecution();
  }

  function run(): void {
    setPlaying(false);

    const nextMode: VisualizationMode = points.length > 100 ? 'result' : effectiveMode;
    const runTraceLevel: TraceLevel = points.length > 100 ? 'phase' : traceLevel;

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
      <div className="grid h-full grid-cols-1 gap-3 p-3 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="grid min-h-0 gap-3 xl:grid-rows-[minmax(0,1fr)_220px]">
          <Card className="min-h-0">
            <CardHeader>
              <CardAction className="flex flex-wrap justify-end gap-2">
                <Badge variant="outline">{points.length} point(s)</Badge>
                <Badge variant="outline">step {result ? `${activeTraceIndex + 1}/${events.length}` : '0/0'}</Badge>
                {result ? <Badge variant="outline">{effectiveMode}</Badge> : null}
              </CardAction>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-col p-0">
              <GeometryCanvas
                frame={frame}
                toggles={toggles}
                pointLabelOptions={pointLabelOptions}
                edgeLabelOptions={edgeLabelOptions}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                onAddPoint={addPoint}
              />
            </CardContent>
            <CardFooter>
              <p className="truncate text-sm text-muted-foreground">{frame.explanation}</p>
            </CardFooter>
          </Card>

          <TraceLog events={visibleTraceEvents} points={result?.points ?? points} activeEventId={activeEventId} />
        </section>

        <aside className="grid min-h-0 gap-3 xl:grid-rows-[minmax(0,1fr)_220px]">
          <Card className="min-h-0">
            <CardContent className="h-full">
              <div className="flex h-full flex-col gap-4 overflow-hidden">
                <section className="flex flex-col gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Button type="button" variant="outline" onClick={generateRandom}>Random set</Button>
                    <Button type="button" variant="outline" onClick={generateGrid}>Structured grid</Button>
                    <Button type="button" variant="outline" onClick={clear}>Clear</Button>
                    <Button type="button" onClick={run} disabled={points.length < 2}>Run algorithm</Button>
                  </div>
                </section>

                <Separator />

                <section className="flex flex-col gap-2">
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    value={effectiveMode}
                    onValueChange={(value) => {
                      if (value) updateMode(value as VisualizationMode);
                    }}
                    className="grid w-full grid-cols-3"
                  >
                    <ToggleGroupItem value="step" className="w-full" disabled={points.length > 100}>Step</ToggleGroupItem>
                    <ToggleGroupItem value="phase" className="w-full">Phase</ToggleGroupItem>
                    <ToggleGroupItem value="result" className="w-full">Result</ToggleGroupItem>
                  </ToggleGroup>
                  {points.length > 100 ? <p className="text-xs text-muted-foreground">Detailed trace disabled above 100 points.</p> : null}
                  {mode === 'step' && resultTraceLevel === null && !result ? <p className="text-xs text-muted-foreground">Run again after switching back to step.</p> : null}
                </section>

                <Separator />

                <section className="flex flex-col gap-3">
                  <div className="flex items-center justify-center gap-2">
                    <Button type="button" variant="outline" size="icon-sm" aria-label="Reset to start" onClick={() => setStep(0)} disabled={!result}>
                      <SkipBack data-icon="inline-start" />
                    </Button>
                    <Button type="button" variant="outline" size="icon-sm" aria-label="Previous step" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={!result || effectiveMode === 'result'}>
                      <ChevronLeft data-icon="inline-start" />
                    </Button>
                    <Button type="button" variant="outline" size="icon-sm" aria-label={playing ? 'Pause playback' : 'Play playback'} onClick={() => setPlaying((value) => !value)} disabled={!result || effectiveMode === 'result'}>
                      {playing ? <Pause data-icon="inline-start" /> : <Play data-icon="inline-start" />}
                    </Button>
                    <Button type="button" variant="outline" size="icon-sm" aria-label="Next step" onClick={() => setStep((value) => Math.min(maxStep, value + 1))} disabled={!result || effectiveMode === 'result'}>
                      <ChevronRight data-icon="inline-start" />
                    </Button>
                  </div>

                  <FieldSet>
                    <FieldLegend variant="label">Playback</FieldLegend>
                    <FieldGroup>
                      <Field>
                        <FieldLabel htmlFor="speed-slider">Speed</FieldLabel>
                        <Slider
                          id="speed-slider"
                          min={100}
                          max={1600}
                          step={50}
                          value={[1700 - speedMs]}
                          onValueChange={(value) => setSpeedMs(1700 - (value[0] ?? 1250))}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="step-slider">Step</FieldLabel>
                        <Slider
                          id="step-slider"
                          min={0}
                          max={Math.max(maxStep, 1)}
                          step={1}
                          value={[Math.max(0, activeTraceIndex)]}
                          onValueChange={(value) => setStep(value[0] ?? 0)}
                          disabled={!result || effectiveMode === 'result'}
                        />
                      </Field>
                      <div className="text-xs text-muted-foreground">
                        {result ? `${activeTraceIndex + 1} / ${events.length}` : 'No trace'}
                      </div>
                    </FieldGroup>
                  </FieldSet>
                </section>

                <Separator />

                <FieldSet>
                  <FieldLegend>Labels</FieldLegend>
                  <FieldGroup className="gap-4">
                    <Field orientation="horizontal">
                      <FieldLabel htmlFor="input-labels">Point input</FieldLabel>
                      <Switch id="input-labels" checked={pointLabelOptions.inputLabels} onCheckedChange={(checked) => updatePointLabels('inputLabels', checked)} />
                    </Field>
                    <Field orientation="horizontal">
                      <FieldLabel htmlFor="sorted-labels">Point sorted</FieldLabel>
                      <Switch id="sorted-labels" checked={pointLabelOptions.sortedLabels} onCheckedChange={(checked) => updatePointLabels('sortedLabels', checked)} />
                    </Field>
                    <Field orientation="horizontal">
                      <FieldLabel htmlFor="coordinate-labels">Point (x; y)</FieldLabel>
                      <Switch id="coordinate-labels" checked={pointLabelOptions.coordinates} onCheckedChange={(checked) => updatePointLabels('coordinates', checked)} />
                    </Field>
                    <Field orientation="horizontal">
                      <FieldLabel htmlFor="edge-pair-labels">Edge P1-P2</FieldLabel>
                      <Switch id="edge-pair-labels" checked={edgeLabelOptions.pairLabels} onCheckedChange={(checked) => updateEdgeLabels('pairLabels', checked)} />
                    </Field>
                    <Field orientation="horizontal">
                      <FieldLabel htmlFor="edge-id-labels">Edge E1</FieldLabel>
                      <Switch id="edge-id-labels" checked={edgeLabelOptions.idLabels} onCheckedChange={(checked) => updateEdgeLabels('idLabels', checked)} />
                    </Field>
                  </FieldGroup>
                </FieldSet>

                <Separator />

                <FieldSet>
                  <FieldLegend>Layers</FieldLegend>
                  <FieldGroup className="gap-4">
                    <Field orientation="horizontal">
                      <FieldLabel htmlFor="layer-delaunay">Delaunay</FieldLabel>
                      <Switch id="layer-delaunay" checked={toggles.delaunayEdges} onCheckedChange={(checked) => updateLayer('delaunayEdges', checked)} />
                    </Field>
                    <Field orientation="horizontal">
                      <FieldLabel htmlFor="layer-split-lines">Split</FieldLabel>
                      <Switch id="layer-split-lines" checked={toggles.splitLines} onCheckedChange={(checked) => updateLayer('splitLines', checked)} />
                    </Field>
                    <Field orientation="horizontal">
                      <FieldLabel htmlFor="layer-candidates">Candidates</FieldLabel>
                      <Switch id="layer-candidates" checked={toggles.candidateEdges} onCheckedChange={(checked) => updateLayer('candidateEdges', checked)} />
                    </Field>
                    <Field orientation="horizontal">
                      <FieldLabel htmlFor="layer-circumcircles">Circles</FieldLabel>
                      <Switch id="layer-circumcircles" checked={toggles.circumcircles} onCheckedChange={(checked) => updateLayer('circumcircles', checked)} />
                    </Field>
                    <Field orientation="horizontal">
                      <FieldLabel htmlFor="layer-deleted">Deleted</FieldLabel>
                      <Switch id="layer-deleted" checked={toggles.deletedEdges} onCheckedChange={(checked) => updateLayer('deletedEdges', checked)} />
                    </Field>
                    <Field orientation="horizontal">
                      <FieldLabel htmlFor="layer-nearest">Nearest</FieldLabel>
                      <Switch id="layer-nearest" checked={toggles.nearestArrows} onCheckedChange={(checked) => updateLayer('nearestArrows', checked)} />
                    </Field>
                  </FieldGroup>
                </FieldSet>

                <div className="mt-auto flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant="outline">{result?.edges.length ?? 0} edges</Badge>
                  <Badge variant="outline">runtime {result ? `${result.runtimeMs.toFixed(2)} ms` : 'not run'}</Badge>
                  {error ? <span className="text-destructive">{error}</span> : null}
                </div>
              </div>
            </CardContent>
          </Card>

          {result ? <ResultPanel result={result} /> : <Card size="sm"><CardContent className="flex h-full items-center justify-center text-sm text-muted-foreground">Run the algorithm to see nearest neighbors.</CardContent></Card>}
        </aside>
      </div>
    </main>
  );
}
