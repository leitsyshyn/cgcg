import { useEffect, useState } from 'react';
import { GeometryCanvas } from './components/GeometryCanvas';
import type { AlgorithmResult, InputPoint, Point2D } from './geometry/types';
import { runNearestNeighborLab } from './geometry/runAlgorithm';
import { filterTraceEvents, type TraceLevel } from './trace/recorder';
import { projectTraceFrame } from './trace/projector';
import type { TraceFrame } from './trace/frames';
import { defaultToggles, type VisualizationMode, type VisualizationToggles } from './app/visualization';

const CANVAS_WIDTH = 860;
const CANVAS_HEIGHT = 560;

function pointFromInput(point: InputPoint, index: number): Point2D {
  const id = point.id ?? `p${index + 1}`;
  return { id, label: id.toUpperCase(), x: point.x, y: point.y };
}

function idleFrame(points: readonly InputPoint[]): TraceFrame {
  return {
    index: -1,
    points: points.map(pointFromInput),
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
    explanation: 'Click the working area to add points, then run the algorithm.',
  };
}

export default function App() {
  const [points, setPoints] = useState<InputPoint[]>([]);
  const [mode, setMode] = useState<VisualizationMode>('step');
  const [toggles, setToggles] = useState<VisualizationToggles>(defaultToggles);
  const [result, setResult] = useState<AlgorithmResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState(450);

  const effectiveMode: VisualizationMode = points.length > 100 && mode === 'step' ? 'result' : mode;
  const traceLevel: TraceLevel = effectiveMode === 'step' ? 'detailed' : 'phase';
  const events = result ? filterTraceEvents(result.trace, effectiveMode === 'step' ? 'detailed' : 'phase') : [];
  const maxStep = Math.max(0, events.length - 1);
  const frame = result ? projectTraceFrame(events, effectiveMode === 'result' ? maxStep : step) : idleFrame(points);

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

  function addPoint(x: number, y: number): void {
    const id = `p${points.length + 1}`;
    setPoints((current) => [...current, { id, x: Math.round(x), y: Math.round(y) }]);
    setResult(null);
    setError(null);
    setStep(0);
  }

  function generateRandom(): void {
    const count = 18;
    const generated = Array.from({ length: count }, (_, index) => ({
      id: `p${index + 1}`,
      x: 45 + Math.round(Math.random() * (CANVAS_WIDTH - 90)),
      y: 45 + Math.round(Math.random() * (CANVAS_HEIGHT - 90)),
    }));
    setPoints(generated);
    setResult(null);
    setError(null);
    setStep(0);
  }

  function generateGrid(): void {
    const generated: InputPoint[] = [];
    let index = 1;
    for (let row = 0; row < 4; row += 1) {
      for (let column = 0; column < 5; column += 1) {
        generated.push({ id: `p${index++}`, x: 150 + column * 110 + (row % 2) * 16, y: 110 + row * 85 });
      }
    }
    setPoints(generated);
    setResult(null);
    setError(null);
    setStep(0);
  }

  function clear(): void {
    setPoints([]);
    setResult(null);
    setError(null);
    setStep(0);
    setPlaying(false);
  }

  function run(): void {
    setPlaying(false);
    const nextMode = points.length > 100 ? 'result' : effectiveMode;
    if (nextMode !== mode) setMode(nextMode);
    const computed = runNearestNeighborLab(points, points.length > 100 ? 'phase' : traceLevel);
    if (!computed.ok) {
      setError([computed.error.message, ...(computed.error.details ?? [])].join(' '));
      setResult(null);
      return;
    }
    setError(null);
    setResult(computed.value);
    const projectedEvents = filterTraceEvents(computed.value.trace, nextMode === 'step' ? 'detailed' : 'phase');
    setStep(nextMode === 'result' ? Math.max(0, projectedEvents.length - 1) : 0);
  }

  function updateToggle(key: keyof VisualizationToggles): void {
    setToggles((current) => ({ ...current, [key]: !current[key] }));
  }

  const modeLabel = effectiveMode === 'step' ? 'Step mode' : effectiveMode === 'phase' ? 'Phase mode' : 'Result-only mode';

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Computational geometry laboratory</p>
          <h1>All nearest neighbors through Delaunay triangulation</h1>
          <p>
            Manual divide-and-conquer Delaunay construction, adjacency extraction, nearest-neighbor ties, trace projection, and D3/SVG visualization.
          </p>
        </div>
        <div className="metric-card">
          <span>Complexity target</span>
          <strong>O(N log N)</strong>
          <small>Sort, recursively split, merge triangulations, then scan Delaunay adjacency.</small>
        </div>
      </section>

      <section className="workspace">
        <div className="canvas-panel">
          <GeometryCanvas frame={frame} toggles={toggles} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} onAddPoint={addPoint} />
          <div className="step-explanation">{frame.explanation}</div>
        </div>

        <aside className="control-panel">
          <div className="control-group">
            <h2>Input</h2>
            <button type="button" onClick={generateRandom}>Random small set</button>
            <button type="button" onClick={generateGrid}>Structured grid</button>
            <button type="button" onClick={clear}>Clear/reset</button>
            <button type="button" className="primary" onClick={run} disabled={points.length < 2}>Run algorithm</button>
          </div>

          <div className="control-group">
            <h2>Visualization Mode</h2>
            <select value={mode} onChange={(event) => setMode(event.target.value as VisualizationMode)}>
              <option value="step" disabled={points.length > 100}>Step mode</option>
              <option value="phase">Phase mode</option>
              <option value="result">Result-only mode</option>
            </select>
            {points.length > 100 ? <p className="note">Detailed tracing is disabled for N &gt; 100.</p> : null}
          </div>

          <div className="control-group">
            <h2>Playback</h2>
            <div className="button-row">
              <button type="button" onClick={() => setStep(0)} disabled={!result}>Reset trace</button>
              <button type="button" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={!result || effectiveMode === 'result'}>Prev</button>
              <button type="button" onClick={() => setStep((value) => Math.min(maxStep, value + 1))} disabled={!result || effectiveMode === 'result'}>Next</button>
              <button type="button" onClick={() => setPlaying((value) => !value)} disabled={!result || effectiveMode === 'result'}>{playing ? 'Pause' : 'Play'}</button>
            </div>
            <label className="range-label">
              Speed
              <input type="range" min="100" max="1600" step="50" value={speedMs} onChange={(event) => setSpeedMs(Number(event.target.value))} />
            </label>
            <label className="range-label">
              Step
              <input type="range" min="0" max={maxStep} value={Math.min(step, maxStep)} onChange={(event) => setStep(Number(event.target.value))} disabled={!result || effectiveMode === 'result'} />
            </label>
          </div>

          <div className="control-group toggles">
            <h2>Layers</h2>
            {(Object.keys(toggles) as Array<keyof VisualizationToggles>).map((key) => (
              <label key={key}>
                <input type="checkbox" checked={toggles[key]} onChange={() => updateToggle(key)} />
                {key}
              </label>
            ))}
          </div>

          <div className="control-group status-panel">
            <h2>Status</h2>
            <dl>
              <dt>Points</dt><dd>{points.length}</dd>
              <dt>Delaunay edges</dt><dd>{result?.delaunayEdges.length ?? 0}</dd>
              <dt>Mode</dt><dd>{modeLabel}</dd>
              <dt>Step</dt><dd>{result ? `${effectiveMode === 'result' ? maxStep : step} / ${maxStep}` : 'not run'}</dd>
              <dt>Phase</dt><dd>{frame.currentPhase}</dd>
              <dt>Validation</dt><dd className={result?.validation.ok === false ? 'bad' : 'good'}>{result?.validation.message ?? 'not checked'}</dd>
              <dt>Runtime</dt><dd>{result ? `${result.runtimeMs.toFixed(2)} ms` : 'not run'}</dd>
            </dl>
            {error ? <p className="error-box">{error}</p> : null}
          </div>
        </aside>
      </section>

      {result ? (
        <section className="results-panel">
          <h2>Nearest-Neighbor Relation</h2>
          <div className="result-grid">
            {result.nearestNeighbors.map((item) => (
              <div key={item.pointId} className="result-pill">
                <strong>{item.pointId.toUpperCase()}</strong>
                <span>→ {item.neighborIds.map((id) => id.toUpperCase()).join(', ')}</span>
                <small>d² = {item.distance2.toFixed(2)}</small>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
