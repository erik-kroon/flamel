import {
  marketSessionLabel as marketSessionLabelForTimestamp,
  rangeSessionLabel,
} from "@/features/market-data/market-session";
import type { DataSource, TimeRange } from "@/features/market-data/types";

import type { PriceHistoryViewModel } from "./price-history-view-model";

export function sourceLabel(source?: DataSource) {
  if (source === "databento") return "Databento";
  if (source === "mock") return "Mock provider";
  return "Provider pending";
}

export function titleCaseStatus(status: string) {
  return status === "idle" ? "Pending" : status[0].toUpperCase() + status.slice(1);
}

export function freshnessStateLabel(status: string, stale: boolean, source?: DataSource) {
  if (status === "loading") return "Loading quote";
  if (status === "error") return "Quote unavailable";
  if (source === "mock") return "Mock fixture";
  if (source === "databento") return "Historical snapshot";
  return stale ? "Cached quote" : "Delayed quote";
}

export function marketSessionLabel(value?: string) {
  return marketSessionLabelForTimestamp(value);
}

export function watchlistStatusLabel(status: string, source?: DataSource) {
  if (status === "error" || status === "loading") return titleCaseStatus(status);
  if (source === "mock") return "Mock";
  return status === "ready" ? "Cached" : "Pending";
}

export function transportLabel(source?: DataSource) {
  if (source === "databento") return "Local fixture";
  return source === "mock" ? "Local" : "REST";
}

export function chartSessionLabel(range: TimeRange) {
  return rangeSessionLabel(range);
}

export function chartGranularityLabel(range: TimeRange, count: number, source?: DataSource) {
  if (source === "mock") {
    if (range === "1D") return "sampled mock points";
    return "mock points";
  }
  if (range === "1D") return "1m bars";
  if (range === "1W") return source === "databento" && count < 20 ? "Daily bars" : "5m bars";
  if (range === "1M") return count <= 35 ? "Daily bars" : "1h bars";
  return "Bars";
}

export function chartCountLabel(range: TimeRange, count: number, source?: DataSource) {
  if (source === "mock") return `${count} rendered points`;
  if (range === "1D" || range === "1W" || range === "1M") return `${count} OHLCV bars`;
  return `${count} points`;
}

export interface PriceHistoryDisplayLabelsInput {
  chart: PriceHistoryViewModel;
  range: TimeRange;
  source?: DataSource;
  formatTimeLabel: (timestamp: string, range: TimeRange) => string;
}

export interface PriceHistoryDisplayLabels {
  session: string;
  granularity: string;
  countLabel: string;
  firstLabel: string;
  middleLabel: string;
  lastLabel: string;
}

export function createPriceHistoryDisplayLabels({
  chart,
  range,
  source,
  formatTimeLabel,
}: PriceHistoryDisplayLabelsInput): PriceHistoryDisplayLabels {
  const middlePoint =
    chart.normalized.length > 2
      ? chart.normalized[Math.floor(chart.normalized.length / 2)]
      : undefined;

  return {
    session: chartSessionLabel(range),
    granularity: chartGranularityLabel(range, chart.metadata.count, source),
    countLabel: chartCountLabel(range, chart.metadata.count, source),
    firstLabel: chart.metadata.first ? formatTimeLabel(chart.metadata.first.timestamp, range) : "",
    middleLabel: middlePoint ? formatTimeLabel(middlePoint.timestamp, range) : "",
    lastLabel: chart.metadata.last ? formatTimeLabel(chart.metadata.last.timestamp, range) : "",
  };
}
