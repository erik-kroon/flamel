import type { TimeRange } from "@/features/market-data/types";

const DEFAULT_LOCALE = "en-US";
const DEFAULT_CURRENCY = "USD";

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

  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatSignedPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function formatMarketTimestamp(value?: string) {
  if (!value) {
    return "Pending";
  }

  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function formatMarketAxisPrice(value: number, currency = DEFAULT_CURRENCY) {
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: "currency",
    currency,
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

export function formatMarketChartTime(value: string, range: TimeRange) {
  const date = new Date(value);

  if (range === "1D") {
    return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    month: "short",
    day: "numeric",
  }).format(date);
}
