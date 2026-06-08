export interface ParsedInputPoint {
  readonly x: number;
  readonly y: number;
}

export function parseUploadedPoints(text: string): readonly ParsedInputPoint[] {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Uploaded file is empty.');
  }

  const parsedJson = tryParseJsonPoints(trimmed);
  if (parsedJson) {
    return parsedJson;
  }

  const rawLines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));

  let expectedCount: number | null = null;
  let pointLines = rawLines;
  let firstPointLineNumber = 1;
  if (rawLines.length > 1 && /^\d+$/.test(rawLines[0] ?? '')) {
    expectedCount = Number.parseInt(rawLines[0] ?? '', 10);
    pointLines = rawLines.slice(1);
    firstPointLineNumber = 2;
  }

  const points = pointLines.map((line, index) => parsePointLine(line, firstPointLineNumber + index));
  if (expectedCount !== null && expectedCount !== points.length) {
    throw new Error(`Declared ${expectedCount} point rows, but parsed ${points.length}.`);
  }

  return points;
}

function tryParseJsonPoints(text: string): readonly ParsedInputPoint[] | null {
  try {
    const value = JSON.parse(text);
    if (!Array.isArray(value)) return null;

    return value.map((item, index) => parseJsonPoint(item, index));
  } catch (error) {
    if (error instanceof SyntaxError) {
      return null;
    }
    throw error;
  }
}

function parseJsonPoint(value: unknown, index: number): ParsedInputPoint {
  if (Array.isArray(value) && value.length === 2 && isFiniteNumber(value[0]) && isFiniteNumber(value[1])) {
    return { x: Number(value[0]), y: Number(value[1]) };
  }

  if (
    value &&
    typeof value === 'object' &&
    'x' in value &&
    'y' in value &&
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y)
  ) {
    return { x: Number(value.x), y: Number(value.y) };
  }

  throw new Error(`Invalid JSON point at item ${index + 1}. Use [x, y] or { x, y }.`);
}

function parsePointLine(line: string, lineNumber: number): ParsedInputPoint {
  const parts = line.replace(/[;,]/g, ' ').split(/\s+/).filter(Boolean);

  if (parts.length === 2) {
    const [xToken, yToken] = parts;
    if (isFiniteToken(xToken) && isFiniteToken(yToken)) {
      return { x: Number(xToken), y: Number(yToken) };
    }
    throw new Error(`Line ${lineNumber} must use numeric coordinates: "x y".`);
  }

  if (parts.length === 3) {
    const [labelToken, xToken, yToken] = parts;
    if (!isFiniteToken(labelToken) && isFiniteToken(xToken) && isFiniteToken(yToken)) {
      return { x: Number(xToken), y: Number(yToken) };
    }

    if (isFiniteToken(labelToken) && isFiniteToken(xToken) && isFiniteToken(yToken)) {
      throw new Error(`Line ${lineNumber} is ambiguous. Use "x y" or "label x y".`);
    }

    throw new Error(`Line ${lineNumber} must use either "x y" or "label x y".`);
  }

  throw new Error(`Line ${lineNumber} must contain exactly 2 numeric fields or a label plus 2 numeric fields.`);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isFiniteToken(token: string | undefined): boolean {
  return token !== undefined && Number.isFinite(Number(token));
}
