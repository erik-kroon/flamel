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

export interface PriceSeriesAnalysis {
  metadata: PriceSeriesMetadata;
  sorted: PricePoint[];
}

export interface PriceSeriesSvgOptions {
  width?: number;
  height?: number;
  verticalPadding?: number;
}

export interface PriceDomainReference {
  previousClose?: number;
  open?: number;
  last?: number;
}

export interface PriceDomain {
  min: number;
  max: number;
  visibleMin: number;
  visibleMax: number;
  padding: number;
  spread: number;
}

const DEFAULT_SVG_OPTIONS: Required<PriceSeriesSvgOptions> = {
  width: 100,
  height: 52,
  verticalPadding: 4,
};

const STANDARD_DOMAIN_PADDING_RATIO = 0.1;
const VOLATILE_DOMAIN_PADDING_RATIO = 0.12;
const VOLATILE_RANGE_RATIO = 0.05;
const MIN_DOMAIN_PADDING_RATIO = 0.001;
const MIN_DOMAIN_PADDING_TICKS = 0.01;

function isIsoUtcTimestamp(value: string) {
  return /^\d{4}-\d{2}-\d{2}T.*Z$/.test(value);
}

function compareTimestamps(left: string, right: string) {
  if (isIsoUtcTimestamp(left) && isIsoUtcTimestamp(right)) {
    return left < right ? -1 : left > right ? 1 : 0;
  }

  return Date.parse(left) - Date.parse(right);
}

export function sortPriceSeries(points: readonly PricePoint[]): PricePoint[] {
  return [...points].sort((a, b) => compareTimestamps(a.timestamp, b.timestamp));
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
  return analyzePriceSeries(points, range).metadata;
}

export function analyzePriceSeries(
  points: readonly PricePoint[],
  range?: TimeRange,
): PriceSeriesAnalysis {
  const sorted = sortPriceSeries(points);

  if (sorted.length === 0) {
    return {
      sorted,
      metadata: {
        range,
        count: 0,
        empty: true,
      },
    };
  }

  let min = sorted[0]!.value;
  let max = sorted[0]!.value;

  for (let index = 1; index < sorted.length; index += 1) {
    const value = sorted[index]!.value;
    if (value < min) min = value;
    if (value > max) max = value;
  }

  return {
    sorted,
    metadata: {
      range,
      count: sorted.length,
      empty: false,
      min,
      max,
      first: sorted[0],
      last: sorted.at(-1),
    },
  };
}

function collectFinitePriceValues(point: PricePoint) {
  return [point.low, point.open, point.value, point.close, point.high].filter((value) => {
    return typeof value === "number" && Number.isFinite(value);
  });
}

export function getPaddedPriceDomain(
  points: readonly PricePoint[],
  references: PriceDomainReference = {},
): PriceDomain {
  const values = [
    ...points.flatMap((point) => collectFinitePriceValues(point)),
    references.previousClose,
    references.open,
    references.last,
  ].filter((value) => typeof value === "number" && Number.isFinite(value));

  if (values.length === 0) {
    return {
      min: -MIN_DOMAIN_PADDING_TICKS,
      max: MIN_DOMAIN_PADDING_TICKS,
      visibleMin: 0,
      visibleMax: 0,
      padding: MIN_DOMAIN_PADDING_TICKS,
      spread: MIN_DOMAIN_PADDING_TICKS * 2,
    };
  }

  const visibleMin = Math.min(...values);
  const visibleMax = Math.max(...values);
  const visibleRange = visibleMax - visibleMin;
  const midpoint = Math.max(Math.abs((visibleMax + visibleMin) / 2), 1);
  const paddingRatio =
    visibleRange / midpoint >= VOLATILE_RANGE_RATIO
      ? VOLATILE_DOMAIN_PADDING_RATIO
      : STANDARD_DOMAIN_PADDING_RATIO;
  const minimumPadding = Math.max(midpoint * MIN_DOMAIN_PADDING_RATIO, MIN_DOMAIN_PADDING_TICKS);
  const padding = Math.max(visibleRange * paddingRatio, minimumPadding);
  const min = visibleMin - padding;
  const max = visibleMax + padding;

  return {
    min,
    max,
    visibleMin,
    visibleMax,
    padding,
    spread: max - min,
  };
}

export function normalizePriceSeriesForSvg(
  points: readonly PricePoint[],
  options: PriceSeriesSvgOptions = {},
): NormalizedPricePoint[] {
  const { sorted, metadata } = analyzePriceSeries(points);

  if (sorted.length < 2) {
    return [];
  }

  const { width, height, verticalPadding } = {
    ...DEFAULT_SVG_OPTIONS,
    ...options,
  };
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
