import {
  analyzePriceSeries,
  getPaddedPriceDomain,
  pricePointsToSvgPath,
  type NormalizedPricePoint,
  type PriceSeriesMetadata,
} from "@/features/market-data/price-series";
import {
  marketDateKey,
  marketDateLabel,
  marketSessionBandReferences,
  type MarketSessionBand,
} from "@/features/market-data/market-session";
import type { DataSource, EquityQuote, PricePoint, TimeRange } from "@/features/market-data/types";

import { chartAnnotationLayout, type ChartAnnotationLayout } from "./chart-annotations";

export const PRICE_AREA_TOP = 6;
export const PRICE_AREA_BOTTOM = 78;
export const VOLUME_AREA_TOP = 83;
export const VOLUME_AREA_BOTTOM = 98;

export interface ChartAxisLabel {
  value: number;
  top: number;
}

const CHART_AXIS_STEPS = [1, 2, 3, 5, 10, 20, 50, 100, 200, 500] as const;
const CHART_AXIS_TARGET_INTERVALS = 4;

interface ChartAxisScale {
  min: number;
  max: number;
  spread: number;
  step: number;
  precision: number;
  axis: ChartAxisLabel[];
}

export interface ChartTimeSeparator {
  x: number;
  label: string;
}

export interface PriceHistoryVolumeBar extends NormalizedPricePoint {
  volume: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PriceHistoryViewModel {
  metadata: PriceSeriesMetadata;
  normalized: NormalizedPricePoint[];
  path: string;
  axis: ChartAxisLabel[];
  axisPrecision: number;
  currentY: number;
  openX?: number;
  closeX?: number;
  preMarketBand?: MarketSessionBand;
  afterHoursBand?: MarketSessionBand;
  timeSeparators: ChartTimeSeparator[];
  previousCloseY?: number;
  openY?: number;
  annotationLayout: ChartAnnotationLayout;
  rangeMove?: number;
  rangeHigh?: number;
  rangeLow?: number;
  rangeVolume: number;
  volumeBars: PriceHistoryVolumeBar[];
  hasVolume: boolean;
  last?: NormalizedPricePoint;
  limited: boolean;
  nearestPointIndex(xPercent: number): number | undefined;
  returnVsPreviousClose(point: Pick<PricePoint, "value">): number | undefined;
}

export interface PriceHistoryViewModelInput {
  points: readonly PricePoint[];
  quote?: EquityQuote;
  range: TimeRange;
  source?: DataSource;
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

function nearestUniformPointIndex(pointCount: number, xPercent: number) {
  if (pointCount <= 0) return undefined;
  if (pointCount === 1) return 0;

  return Math.max(
    0,
    Math.min(pointCount - 1, Math.round((clampPercent(xPercent) / 100) * (pointCount - 1))),
  );
}

function chartTimeSeparators(points: readonly NormalizedPricePoint[], range: TimeRange) {
  if (points.length < 2 || range === "1D") return [];

  const separators: ChartTimeSeparator[] = [];
  const minLabelGap = range === "1W" ? 11 : 18;
  let previousKey = marketDateKey(points[0]!.timestamp);
  let previousLabelX = -Infinity;

  for (const point of points.slice(1)) {
    const key = marketDateKey(point.timestamp);
    if (key === previousKey) continue;

    previousKey = key;
    if (point.x <= 2 || point.x >= 96 || point.x - previousLabelX < minLabelGap) continue;

    separators.push({
      x: point.x,
      label: marketDateLabel(point.timestamp),
    });
    previousLabelX = point.x;
  }

  return separators;
}

function percentile(values: readonly number[], percentileRank: number) {
  const sorted = values.filter((value) => value > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return 0;

  const index = Math.ceil((percentileRank / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))]!;
}

function tickPrecision(step: number) {
  if (step >= 1) return 0;

  const stepText = step.toString();
  return stepText.includes(".") ? stepText.split(".")[1]!.length : 0;
}

function roundedTickValue(value: number, precision: number) {
  return Number(value.toFixed(precision));
}

function chooseChartAxisStep(spread: number) {
  const rawStep = spread / CHART_AXIS_TARGET_INTERVALS;
  return CHART_AXIS_STEPS.find((step) => step >= rawStep) ?? CHART_AXIS_STEPS.at(-1)!;
}

function createChartAxisScale(min: number, max: number, spread: number): ChartAxisScale {
  const step = chooseChartAxisStep(spread);
  let tickMin = Math.floor(min / step) * step;
  let tickMax = Math.ceil(max / step) * step;

  while (Math.round((tickMax - tickMin) / step) + 1 < 3) {
    tickMin -= step;
    tickMax += step;
  }

  const precision = tickPrecision(step);
  const axisMin = roundedTickValue(tickMin, precision);
  const axisMax = roundedTickValue(tickMax, precision);
  const axisSpread = Math.max(step, axisMax - axisMin);
  const tickCount = Math.round(axisSpread / step) + 1;
  const axis = Array.from({ length: tickCount }, (_, index) => {
    const value = roundedTickValue(axisMax - step * index, precision);
    const ratio = (axisMax - value) / axisSpread;

    return {
      value,
      top: PRICE_AREA_TOP + ratio * (PRICE_AREA_BOTTOM - PRICE_AREA_TOP),
    };
  });

  return {
    min: axisMin,
    max: axisMax,
    spread: axisSpread,
    step,
    precision,
    axis,
  };
}

export function createPriceHistoryViewModel({
  points,
  quote,
  range,
  source,
}: PriceHistoryViewModelInput): PriceHistoryViewModel {
  const { sorted, metadata } = analyzePriceSeries(points, range);
  const normalized =
    sorted.length < 2
      ? []
      : sorted.map((point, index) => ({
          ...point,
          x: (index / (sorted.length - 1)) * 100,
          y: 0,
        }));
  const domain = getPaddedPriceDomain(sorted, {
    previousClose: quote?.previousClose,
    open: quote?.open,
    last: quote?.lastPrice ?? metadata.last?.value,
  });
  const visibleSpread = domain.visibleMax - domain.visibleMin;
  const axisScale = createChartAxisScale(
    domain.visibleMin,
    domain.visibleMax,
    visibleSpread > 0 ? visibleSpread : domain.spread,
  );
  const current = quote?.lastPrice ?? metadata.last?.value ?? axisScale.min;
  const valueToY = (value: number) =>
    PRICE_AREA_BOTTOM -
    ((value - axisScale.min) / axisScale.spread) * (PRICE_AREA_BOTTOM - PRICE_AREA_TOP);
  const rangeMove =
    metadata.first && metadata.last && metadata.first.value !== 0
      ? ((metadata.last.value - metadata.first.value) / metadata.first.value) * 100
      : quote?.changePercent;
  const sessionBands = marketSessionBandReferences(normalized, range);
  const currentY = valueToY(current);
  const previousCloseY =
    quote?.previousClose === undefined ? undefined : valueToY(quote.previousClose);
  const openY = quote?.open === undefined ? undefined : valueToY(quote.open);
  const plotted = normalized.map((point) => ({ ...point, y: valueToY(point.value) }));
  const volumes = sorted.map((point) => point.volume ?? 0);
  const rangeVolume = volumes.reduce((total, volume) => total + volume, 0);
  const volumeScaleMax = percentile(volumes, 95);
  const volumeBarWidth = sorted.length > 0 ? Math.max(0.16, Math.min(0.82, 58 / sorted.length)) : 0;

  return {
    metadata,
    normalized: plotted,
    path: pricePointsToSvgPath(plotted),
    axis: axisScale.axis,
    axisPrecision: axisScale.precision,
    currentY,
    openX: sessionBands.openX,
    closeX: sessionBands.closeX,
    preMarketBand: sessionBands.preMarketBand,
    afterHoursBand: sessionBands.afterHoursBand,
    timeSeparators: chartTimeSeparators(plotted, range),
    previousCloseY,
    openY,
    annotationLayout: chartAnnotationLayout({
      last: currentY,
      previousClose: previousCloseY,
      axis: axisScale.axis,
      pricePath: plotted,
    }),
    rangeMove,
    rangeHigh: metadata.max,
    rangeLow: metadata.min,
    rangeVolume,
    volumeBars: plotted.map((point) => {
      const volume = point.volume ?? 0;
      const height =
        volumeScaleMax > 0
          ? Math.sqrt(Math.min(volume, volumeScaleMax) / volumeScaleMax) *
            (VOLUME_AREA_BOTTOM - VOLUME_AREA_TOP)
          : 0;

      return {
        ...point,
        volume,
        x: point.x - volumeBarWidth / 2,
        y: VOLUME_AREA_BOTTOM - height,
        width: volumeBarWidth,
        height,
      };
    }),
    hasVolume: rangeVolume > 0,
    last: plotted.at(-1),
    limited: sorted.length > 0 && sorted.length < 8 && source !== "databento",
    nearestPointIndex: (xPercent) => nearestUniformPointIndex(plotted.length, xPercent),
    returnVsPreviousClose: (point) => {
      if (!quote?.previousClose) return undefined;

      return ((point.value - quote.previousClose) / quote.previousClose) * 100;
    },
  };
}
