import {
  type EquityQuote,
  type EquitySearchResult,
  MarketDataNotFoundError,
  type PricePoint,
} from "../types";
import { resolveQuoteChange } from "../finance-calculations";
import { sortPriceSeries } from "../price-series";

export interface MassiveTickerResult {
  ticker: string;
  name: string;
  primary_exchange?: string;
  market?: string;
  currency_name?: string;
  market_cap?: number;
  share_class_shares_outstanding?: number;
}

export interface MassiveTickerResponse {
  results?: MassiveTickerResult;
}

export interface MassiveTickerSearchResponse {
  results?: MassiveTickerResult[];
}

export interface MassiveSnapshotTicker {
  ticker: string;
  name?: string;
  market_status?: string;
  session?: {
    price?: number;
    open?: number;
    high?: number;
    low?: number;
    close?: number;
    volume?: number;
    change?: number;
    change_percent?: number;
    previous_close?: number;
  };
  last_trade?: {
    price?: number;
    timestamp?: number;
  };
  day?: {
    c?: number;
    o?: number;
    h?: number;
    l?: number;
    v?: number;
  };
  lastTrade?: {
    p?: number;
    t?: number;
  };
  prevDay?: {
    c?: number;
    o?: number;
    h?: number;
    l?: number;
    v?: number;
  };
  todaysChange?: number;
  todaysChangePerc?: number;
  updated?: number;
}

export interface MassiveSnapshotTickerResponse {
  ticker?: MassiveSnapshotTicker;
}

export interface MassiveAggregateBar {
  t?: number;
  c?: number;
  window_start?: number;
  close?: number;
}

export interface MassiveAggregatesResponse {
  results?: MassiveAggregateBar[];
}

function toCurrency(currencyName?: string) {
  if (!currencyName) {
    return "USD";
  }

  return currencyName.length === 3
    ? currencyName.toUpperCase()
    : currencyName.toUpperCase().includes("SEK")
      ? "SEK"
      : currencyName.toUpperCase().includes("USD")
        ? "USD"
        : currencyName.toUpperCase();
}

function toIsoTimestamp(value?: number) {
  if (!value) {
    return new Date(0).toISOString();
  }

  return new Date(value < 10_000_000_000 ? value * 1000 : value).toISOString();
}

export function mapMassiveTickerSearch(
  response: MassiveTickerSearchResponse,
): EquitySearchResult[] {
  return (response.results ?? []).map((result) => ({
    symbol: result.ticker,
    name: result.name,
    exchange: result.primary_exchange ?? result.market ?? "UNKNOWN",
    currency: toCurrency(result.currency_name),
  }));
}

export function mapMassiveQuote(
  ticker: MassiveTickerResult,
  snapshot: MassiveSnapshotTicker,
): EquityQuote {
  const price =
    snapshot.session?.price ??
    snapshot.last_trade?.price ??
    snapshot.lastTrade?.p ??
    snapshot.day?.c;
  const previousClose =
    snapshot.session?.previous_close ?? snapshot.session?.close ?? snapshot.prevDay?.c;

  if (price === undefined || previousClose === undefined) {
    throw new MarketDataNotFoundError(ticker.ticker);
  }

  const { change, changePercent } = resolveQuoteChange({
    lastPrice: price,
    previousClose,
    change: snapshot.session?.change ?? snapshot.todaysChange,
    changePercent: snapshot.session?.change_percent ?? snapshot.todaysChangePerc,
  });

  return {
    symbol: ticker.ticker,
    name: ticker.name,
    exchange: ticker.primary_exchange ?? ticker.market ?? "UNKNOWN",
    currency: toCurrency(ticker.currency_name),
    lastPrice: price,
    previousClose,
    open: snapshot.session?.open ?? snapshot.day?.o ?? price,
    high: snapshot.session?.high ?? snapshot.day?.h ?? price,
    low: snapshot.session?.low ?? snapshot.day?.l ?? price,
    change,
    changePercent,
    volume: snapshot.session?.volume ?? snapshot.day?.v ?? 0,
    marketCap: ticker.market_cap,
    updatedAt: toIsoTimestamp(
      snapshot.updated ?? snapshot.last_trade?.timestamp ?? snapshot.lastTrade?.t,
    ),
    source: "massive",
  };
}

export function mapMassiveAggregates(response: MassiveAggregatesResponse): PricePoint[] {
  return sortPriceSeries(
    (response.results ?? [])
      .filter((bar) => {
        const timestamp = bar.t ?? bar.window_start;
        const value = bar.c ?? bar.close;
        return timestamp !== undefined && value !== undefined;
      })
      .map((bar) => ({
        timestamp: new Date(bar.t ?? bar.window_start ?? 0).toISOString(),
        value: bar.c ?? bar.close ?? 0,
      })),
  );
}
