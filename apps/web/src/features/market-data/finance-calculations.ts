import { type EquityQuote } from "./types";

export interface QuoteChangeInput {
  lastPrice: number;
  previousClose: number;
}

export interface ResolveQuoteChangeInput extends QuoteChangeInput {
  change?: number;
  changePercent?: number;
}

export interface QuoteChange {
  change: number;
  changePercent: number;
}

export interface SimulatedTickInput {
  quote: EquityQuote;
  movementPercent: number;
  maxMovementPercent?: number;
  updatedAt: string;
}

export function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

export function calculateQuoteChange({ lastPrice, previousClose }: QuoteChangeInput): QuoteChange {
  const change = roundMoney(lastPrice - previousClose);
  const changePercent = previousClose === 0 ? 0 : roundMoney((change / previousClose) * 100);

  return {
    change,
    changePercent,
  };
}

export function resolveQuoteChange({
  lastPrice,
  previousClose,
  change,
  changePercent,
}: ResolveQuoteChangeInput): QuoteChange {
  const resolvedChange = change ?? calculateQuoteChange({ lastPrice, previousClose }).change;
  const resolvedChangePercent =
    changePercent ?? (previousClose === 0 ? 0 : roundMoney((resolvedChange / previousClose) * 100));

  return {
    change: resolvedChange,
    changePercent: resolvedChangePercent,
  };
}

export function applySimulatedTick({
  quote,
  movementPercent,
  maxMovementPercent = 0.75,
  updatedAt,
}: SimulatedTickInput): EquityQuote {
  const boundedMovement = Math.max(
    -Math.abs(maxMovementPercent),
    Math.min(Math.abs(maxMovementPercent), movementPercent),
  );
  const lastPrice = roundMoney(quote.lastPrice * (1 + boundedMovement / 100));
  const change = calculateQuoteChange({
    lastPrice,
    previousClose: quote.previousClose,
  });

  return {
    ...quote,
    lastPrice,
    high: Math.max(quote.high, lastPrice),
    low: Math.min(quote.low, lastPrice),
    ...change,
    updatedAt,
  };
}

export function isQuoteStale(updatedAt: string, now: Date, maxAgeMs: number) {
  const updatedTime = Date.parse(updatedAt);

  if (Number.isNaN(updatedTime)) {
    return true;
  }

  return now.getTime() - updatedTime > maxAgeMs;
}
