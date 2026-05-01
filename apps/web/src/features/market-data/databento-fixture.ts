import { roundMoney } from "./finance-calculations";
import { sortPriceSeries } from "./price-series";
import type { PricePoint, TimeRange } from "./types";

export interface DatabentoOhlcvRecord {
  hd?: {
    ts_event?: string | number;
  };
  ts_event?: string | number;
  open?: string | number;
  high?: string | number;
  low?: string | number;
  close?: string | number;
  volume?: string | number;
  symbol?: string;
}

export interface DatabentoFixtureBar {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface DatabentoFixtureHistoryWindow {
  granularity: string;
  session: string;
  bars: DatabentoFixtureBar[];
}

export type DatabentoFixtureHistory = PricePoint[] | DatabentoFixtureHistoryWindow;

export interface DatabentoFixtureEquity {
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
  previousClose: number;
  quote: DatabentoFixtureBar;
  history: Record<TimeRange, DatabentoFixtureHistory>;
}

export interface DatabentoFixtureSourceFiles {
  "ohlcv-1m"?: string;
  "ohlcv-1d"?: string;
}

export interface DatabentoFixtureFile {
  source: "databento";
  dataset: string;
  schema: string;
  requestId: string;
  generatedAt?: string;
  sourceFiles?: DatabentoFixtureSourceFiles;
  equities: DatabentoFixtureEquity[];
}

export interface DatabentoParsedBar {
  symbol?: string;
  bar: DatabentoFixtureBar;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toNumber(value: string | number | undefined) {
  if (value === undefined) {
    return undefined;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

export function timestampFromDatabentoRecord(record: DatabentoOhlcvRecord) {
  const timestamp = record.ts_event ?? record.hd?.ts_event;

  if (timestamp === undefined) {
    return undefined;
  }

  if (typeof timestamp === "number") {
    return new Date(timestamp / 1_000_000).toISOString();
  }

  if (/^\d+$/.test(timestamp)) {
    return new Date(Number(timestamp) / 1_000_000).toISOString();
  }

  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
}

export function parseDatabentoOhlcvBar(
  record: DatabentoOhlcvRecord,
): DatabentoParsedBar | undefined {
  const timestamp = timestampFromDatabentoRecord(record);
  const open = toNumber(record.open);
  const high = toNumber(record.high);
  const low = toNumber(record.low);
  const close = toNumber(record.close);

  if (
    !timestamp ||
    open === undefined ||
    high === undefined ||
    low === undefined ||
    close === undefined
  ) {
    return undefined;
  }

  return {
    symbol: record.symbol,
    bar: {
      timestamp,
      open: roundMoney(open),
      high: roundMoney(high),
      low: roundMoney(low),
      close: roundMoney(close),
      volume: toNumber(record.volume) ?? 0,
    },
  };
}

export function aggregateDatabentoFixtureBars(
  bars: readonly DatabentoFixtureBar[],
  intervalMs: number,
) {
  const buckets = new Map<number, DatabentoFixtureBar>();

  for (const bar of bars) {
    const bucketTime = Math.floor(Date.parse(bar.timestamp) / intervalMs) * intervalMs;
    const current = buckets.get(bucketTime);

    if (!current) {
      buckets.set(bucketTime, {
        ...bar,
        timestamp: new Date(bucketTime).toISOString(),
      });
      continue;
    }

    current.high = Math.max(current.high, bar.high);
    current.low = Math.min(current.low, bar.low);
    current.close = bar.close;
    current.volume += bar.volume;
  }

  return [...buckets.values()].sort(
    (left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp),
  );
}

export function databentoFixtureBarToPricePoint(bar: DatabentoFixtureBar): PricePoint {
  return {
    timestamp: bar.timestamp,
    value: roundMoney(bar.close),
    open: roundMoney(bar.open),
    high: roundMoney(bar.high),
    low: roundMoney(bar.low),
    close: roundMoney(bar.close),
    volume: bar.volume,
  };
}

export function mapDatabentoFixtureHistory(
  history: DatabentoFixtureHistory | undefined,
): PricePoint[] {
  if (!history) {
    return [];
  }

  if (Array.isArray(history)) {
    return sortPriceSeries(history);
  }

  return sortPriceSeries(history.bars.map(databentoFixtureBarToPricePoint));
}

function assertFixtureBar(value: unknown, path: string): asserts value is DatabentoFixtureBar {
  if (!isRecord(value)) {
    throw new Error(`${path} must be an object.`);
  }

  if (typeof value.timestamp !== "string" || Number.isNaN(Date.parse(value.timestamp))) {
    throw new Error(`${path}.timestamp must be a valid timestamp.`);
  }

  for (const key of ["open", "high", "low", "close", "volume"] as const) {
    if (typeof value[key] !== "number" || !Number.isFinite(value[key])) {
      throw new Error(`${path}.${key} must be a finite number.`);
    }
  }
}

function assertFixtureHistory(
  value: unknown,
  path: string,
): asserts value is DatabentoFixtureHistory {
  if (Array.isArray(value)) {
    for (const [index, point] of value.entries()) {
      if (!isRecord(point) || typeof point.timestamp !== "string") {
        throw new Error(`${path}[${index}] must be a price point.`);
      }
    }
    return;
  }

  if (!isRecord(value)) {
    throw new Error(`${path} must be a history window or price point array.`);
  }

  if (!Array.isArray(value.bars)) {
    throw new Error(`${path}.bars must be an array.`);
  }

  for (const [index, bar] of value.bars.entries()) {
    assertFixtureBar(bar, `${path}.bars[${index}]`);
  }
}

function assertFixtureEquity(
  value: unknown,
  index: number,
): asserts value is DatabentoFixtureEquity {
  if (!isRecord(value)) {
    throw new Error(`equities[${index}] must be an object.`);
  }

  for (const key of [
    "symbol",
    "name",
    "exchange",
    "currency",
    "previousClose",
    "quote",
    "history",
  ] as const) {
    if (!(key in value)) {
      throw new Error(`equities[${index}].${key} is required.`);
    }
  }

  assertFixtureBar(value.quote, `equities[${index}].quote`);

  if (!isRecord(value.history)) {
    throw new Error(`equities[${index}].history must be an object.`);
  }

  for (const range of ["1D", "1W", "1M"] as const) {
    if (!(range in value.history)) {
      throw new Error(`equities[${index}].history.${range} is required.`);
    }

    assertFixtureHistory(value.history[range], `equities[${index}].history.${range}`);
  }
}

export function parseDatabentoFixtureFile(value: unknown): DatabentoFixtureFile {
  if (!isRecord(value)) {
    throw new Error("Databento fixture must be an object.");
  }

  if (value.source !== "databento") {
    throw new Error("Databento fixture source must be databento.");
  }

  if (!Array.isArray(value.equities)) {
    throw new Error("Databento fixture equities must be an array.");
  }

  for (const key of ["dataset", "schema", "requestId"] as const) {
    if (!(key in value)) {
      throw new Error(`Databento fixture ${key} is required.`);
    }
  }

  value.equities.forEach(assertFixtureEquity);

  return value as unknown as DatabentoFixtureFile;
}

export function createDatabentoFixtureFile(fixture: DatabentoFixtureFile): DatabentoFixtureFile {
  return parseDatabentoFixtureFile(fixture);
}
