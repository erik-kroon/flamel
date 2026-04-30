import type { TimeRange } from "@/features/market-data/types";

const DEFAULT_LOCALE = "en-US";
const DEFAULT_CURRENCY = "USD";
const MARKET_TIME_ZONE = "America/New_York";
const MARKET_TIMESTAMP_FORMATTER = new Intl.DateTimeFormat(DEFAULT_LOCALE, {
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
  day: "numeric",
  timeZone: MARKET_TIME_ZONE,
});
const MARKET_CHART_TIME_FORMATTER = new Intl.DateTimeFormat(DEFAULT_LOCALE, {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: MARKET_TIME_ZONE,
});
const MARKET_CHART_DATE_FORMATTER = new Intl.DateTimeFormat(DEFAULT_LOCALE, {
  month: "short",
  day: "numeric",
  timeZone: MARKET_TIME_ZONE,
});
const COMPACT_NUMBER_FORMATTER = new Intl.NumberFormat(DEFAULT_LOCALE, {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatMoney(value: number, currency = DEFAULT_CURRENCY) {
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatCompactNumber(value?: number) {
  if (value === undefined) {
    return "n/a";
  }

  return COMPACT_NUMBER_FORMATTER.format(value);
}

export function formatSignedPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function formatMarketTimestamp(value?: string) {
  if (!value) {
    return "Pending";
  }

  return MARKET_TIMESTAMP_FORMATTER.format(new Date(value)) + " ET";
}

export function formatMarketAxisPrice(value: number, currency = DEFAULT_CURRENCY, precision = 2) {
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: "currency",
    currency,
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  }).format(value);
}

export function formatMarketChartTime(value: string, range: TimeRange) {
  const date = new Date(value);

  if (range === "1D") {
    return `${MARKET_CHART_TIME_FORMATTER.format(date)} ET`;
  }

  return MARKET_CHART_DATE_FORMATTER.format(date);
}
