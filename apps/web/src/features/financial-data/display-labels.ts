import type { DataSource, TimeRange } from "@/features/market-data/types";

const MARKET_MINUTE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  hour12: false,
  minute: "2-digit",
  timeZone: "America/New_York",
});

export function sourceLabel(source?: DataSource) {
  if (source === "databento") return "Databento";
  if (source === "massive") return "Massive REST";
  if (source === "mock") return "Mock provider";
  return "Provider pending";
}

export function titleCaseStatus(status: string) {
  return status === "idle" ? "Pending" : status[0].toUpperCase() + status.slice(1);
}

export function statusDotClass(status: string, source?: DataSource) {
  if (status === "error") return "bg-[var(--negative)]";
  if (status === "loading") return "bg-[var(--warning)]";
  if (source === "mock") return "bg-[var(--accent)]";
  return "bg-[var(--positive)]";
}

export function freshnessStateLabel(status: string, stale: boolean, source?: DataSource) {
  if (status === "loading") return "Loading quote";
  if (status === "error") return "Quote unavailable";
  if (source === "mock") return "Fallback fixture";
  if (source === "databento") return "Historical snapshot";
  return stale ? "Cached quote" : "Delayed quote";
}

export function marketSessionLabel(value?: string) {
  if (!value) return "Session pending";

  const parts = MARKET_MINUTE_FORMATTER.formatToParts(new Date(value));
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  const minutes = hour * 60 + minute;

  if (minutes >= 4 * 60 && minutes < 9 * 60 + 30) return "Pre-market";
  if (minutes >= 9 * 60 + 30 && minutes < 16 * 60) return "Market open";
  if (minutes >= 16 * 60 && minutes < 20 * 60) return "After-hours";
  return "Closed";
}

export function watchlistStatusLabel(status: string, source?: DataSource) {
  if (status === "error" || status === "loading") return titleCaseStatus(status);
  if (source === "mock") return "Fallback";
  return status === "ready" ? "Cached" : "Pending";
}

export function transportLabel(source?: DataSource) {
  if (source === "databento") return "Local fixture";
  return source === "mock" ? "Local" : "REST";
}

export function chartSessionLabel(range: TimeRange) {
  return range === "1D" ? "Extended hours" : "Regular session";
}

export function chartGranularityLabel(range: TimeRange, count: number, source?: DataSource) {
  if (source === "mock") {
    if (range === "1D") return "sampled fallback points";
    return "fallback points";
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
