import { type PricePoint, type TimeRange } from "./types";

export interface PriceSeriesMetadata {
  range?: TimeRange;
  count: number;
  empty: boolean;
  min?: number;
  max?: number;
  first?: PricePoint;
  last?: PricePoint;
}

export interface NormalizedPricePoint extends PricePoint {
  x: number;
  y: number;
}

export interface PriceSeriesSvgOptions {
  width?: number;
  height?: number;
  verticalPadding?: number;
}

const DEFAULT_SVG_OPTIONS: Required<PriceSeriesSvgOptions> = {
  width: 100,
  height: 52,
  verticalPadding: 4,
};

export function sortPriceSeries(points: readonly PricePoint[]): PricePoint[] {
  return [...points].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}

export function appendPricePoint(
  points: readonly PricePoint[],
  point: PricePoint,
  maxPoints = points.length + 1,
): PricePoint[] {
  return sortPriceSeries([...points, point]).slice(-Math.max(0, maxPoints));
}

export function getPriceSeriesMetadata(
  points: readonly PricePoint[],
  range?: TimeRange,
): PriceSeriesMetadata {
  if (points.length === 0) {
    return {
      range,
      count: 0,
      empty: true,
    };
  }

  const sorted = sortPriceSeries(points);
  const values = sorted.map((point) => point.value);

  return {
    range,
    count: sorted.length,
    empty: false,
    min: Math.min(...values),
    max: Math.max(...values),
    first: sorted[0],
    last: sorted.at(-1),
  };
}

export function normalizePriceSeriesForSvg(
  points: readonly PricePoint[],
  options: PriceSeriesSvgOptions = {},
): NormalizedPricePoint[] {
  const sorted = sortPriceSeries(points);

  if (sorted.length < 2) {
    return [];
  }

  const { width, height, verticalPadding } = {
    ...DEFAULT_SVG_OPTIONS,
    ...options,
  };
  const metadata = getPriceSeriesMetadata(sorted);
  const min = metadata.min ?? 0;
  const max = metadata.max ?? min;
  const spread = Math.max(max - min, 1);
  const drawableHeight = Math.max(height - verticalPadding * 2, 1);

  return sorted.map((point, index) => ({
    ...point,
    x: (index / (sorted.length - 1)) * width,
    y: height - verticalPadding - ((point.value - min) / spread) * drawableHeight,
  }));
}

export function priceSeriesToSvgPath(
  points: readonly PricePoint[],
  options: PriceSeriesSvgOptions = {},
) {
  return normalizePriceSeriesForSvg(points, options)
    .map((point, index) => {
      return `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    })
    .join(" ");
}
