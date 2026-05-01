import type { TimeRange } from "./types";

export const MARKET_TIME_ZONE = "America/New_York";
export const PRE_MARKET_OPEN_MINUTES = 4 * 60;
export const REGULAR_SESSION_OPEN_MINUTES = 9 * 60 + 30;
export const REGULAR_SESSION_CLOSE_MINUTES = 16 * 60;
export const AFTER_HOURS_CLOSE_MINUTES = 20 * 60;

const MARKET_PARTS_FORMATTER = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  hour: "2-digit",
  hour12: false,
  minute: "2-digit",
  month: "2-digit",
  timeZone: MARKET_TIME_ZONE,
  year: "numeric",
});

const MARKET_DATE_LABEL_FORMATTER = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: MARKET_TIME_ZONE,
});

export interface MarketDateParts {
  date: string;
  hour: number;
  minute: number;
  minutes: number;
}

export interface MarketSessionBand {
  left: number;
  width: number;
}

export interface MarketSessionBandReferences {
  openX?: number;
  closeX?: number;
  preMarketBand?: MarketSessionBand;
  afterHoursBand?: MarketSessionBand;
}

export interface MarketSessionReferencePoint {
  timestamp: string;
  x: number;
}

export type MarketSessionState = "pre-market" | "regular" | "after-hours" | "closed";

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

export function marketDateParts(timestamp: string): MarketDateParts {
  const parts = MARKET_PARTS_FORMATTER.formatToParts(new Date(timestamp));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));

  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour,
    minute,
    minutes: hour * 60 + minute,
  };
}

export function marketDateKey(timestamp: string) {
  return marketDateParts(timestamp).date;
}

export function marketDateLabel(timestamp: string) {
  return MARKET_DATE_LABEL_FORMATTER.format(new Date(timestamp));
}

export function marketMinutes(timestamp: string) {
  return marketDateParts(timestamp).minutes;
}

export function marketSessionState(timestamp: string): MarketSessionState {
  const minutes = marketMinutes(timestamp);

  if (minutes >= PRE_MARKET_OPEN_MINUTES && minutes < REGULAR_SESSION_OPEN_MINUTES) {
    return "pre-market";
  }
  if (minutes >= REGULAR_SESSION_OPEN_MINUTES && minutes < REGULAR_SESSION_CLOSE_MINUTES) {
    return "regular";
  }
  if (minutes >= REGULAR_SESSION_CLOSE_MINUTES && minutes < AFTER_HOURS_CLOSE_MINUTES) {
    return "after-hours";
  }

  return "closed";
}

export function isRegularSession(timestamp: string) {
  return marketSessionState(timestamp) === "regular";
}

export function marketSessionLabel(timestamp?: string) {
  if (!timestamp) return "Session pending";

  const state = marketSessionState(timestamp);
  if (state === "pre-market") return "Pre-market";
  if (state === "regular") return "Market open";
  if (state === "after-hours") return "After-hours";
  return "Closed";
}

export function rangeSessionLabel(range: TimeRange) {
  return range === "1D" ? "Extended hours" : "Regular session";
}

export function marketReferencePercent(
  points: readonly MarketSessionReferencePoint[],
  range: TimeRange,
  minutes: number,
) {
  if (range !== "1D" || points.length < 2) return undefined;

  const first = points[0];
  const last = points.at(-1);
  if (!last) return undefined;

  const firstMinutes = marketMinutes(first.timestamp);
  const lastMinutes = marketMinutes(last.timestamp);

  if (firstMinutes > minutes || lastMinutes < minutes || firstMinutes === lastMinutes) {
    return undefined;
  }

  return ((minutes - firstMinutes) / (lastMinutes - firstMinutes)) * 100;
}

export function marketSessionBand(start?: number, end?: number) {
  if (start === undefined || end === undefined) return undefined;
  const left = clampPercent(start);
  const right = clampPercent(end);
  if (right <= left) return undefined;

  return {
    left,
    width: right - left,
  };
}

export function marketSessionBandReferences(
  points: readonly MarketSessionReferencePoint[],
  range: TimeRange,
): MarketSessionBandReferences {
  const openX = marketReferencePercent(points, range, REGULAR_SESSION_OPEN_MINUTES);
  const closeX = marketReferencePercent(points, range, REGULAR_SESSION_CLOSE_MINUTES);

  return {
    openX,
    closeX,
    preMarketBand: marketSessionBand(0, openX),
    afterHoursBand: marketSessionBand(closeX, 100),
  };
}
