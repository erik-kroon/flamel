import {
  type EquityQuote,
  type EquitySearchResult,
  type MarketDataProvider,
  type PricePoint,
  type TimeRange,
} from "../types";
import { calculateQuoteChange, roundMoney } from "../finance-calculations";
import { sortPriceSeries } from "../price-series";
import { assertSupportedSymbol, normalizeSymbol } from "../symbols";

type MockEquity = Omit<EquityQuote, "change" | "changePercent" | "source" | "updatedAt">;

const UPDATED_AT = "2026-04-30T12:00:00.000Z";

const EQUITIES: Record<string, MockEquity> = {
  AAPL: {
    symbol: "AAPL",
    name: "Apple Inc.",
    exchange: "NASDAQ",
    currency: "USD",
    lastPrice: 209.44,
    previousClose: 207.31,
    open: 208.12,
    high: 211.88,
    low: 206.95,
    volume: 48_102_344,
    marketCap: 3_210_000_000_000,
    peRatio: 32.4,
  },
  MSFT: {
    symbol: "MSFT",
    name: "Microsoft Corporation",
    exchange: "NASDAQ",
    currency: "USD",
    lastPrice: 427.18,
    previousClose: 431.02,
    open: 429.6,
    high: 433.2,
    low: 425.41,
    volume: 22_844_901,
    marketCap: 3_176_000_000_000,
    peRatio: 36.8,
  },
  NVDA: {
    symbol: "NVDA",
    name: "NVIDIA Corporation",
    exchange: "NASDAQ",
    currency: "USD",
    lastPrice: 118.72,
    previousClose: 116.91,
    open: 117.1,
    high: 120.44,
    low: 115.88,
    volume: 177_332_018,
    marketCap: 2_918_000_000_000,
    peRatio: 41.5,
  },
  TSLA: {
    symbol: "TSLA",
    name: "Tesla, Inc.",
    exchange: "NASDAQ",
    currency: "USD",
    lastPrice: 182.64,
    previousClose: 186.12,
    open: 185.4,
    high: 188.05,
    low: 181.17,
    volume: 91_220_771,
    marketCap: 582_000_000_000,
    peRatio: 54.2,
  },
  "ERIC-B.ST": {
    symbol: "ERIC-B.ST",
    name: "Telefonaktiebolaget LM Ericsson",
    exchange: "NASDAQ Stockholm",
    currency: "SEK",
    lastPrice: 86.34,
    previousClose: 85.98,
    open: 86.02,
    high: 87.12,
    low: 85.42,
    volume: 10_884_230,
    marketCap: 286_000_000_000,
    peRatio: 19.1,
  },
  "VOLV-B.ST": {
    symbol: "VOLV-B.ST",
    name: "Volvo AB",
    exchange: "NASDAQ Stockholm",
    currency: "SEK",
    lastPrice: 271.3,
    previousClose: 267.8,
    open: 268.1,
    high: 272.4,
    low: 266.9,
    volume: 6_101_443,
    marketCap: 551_000_000_000,
    peRatio: 12.7,
  },
};

const RANGE_POINTS: Record<TimeRange, number> = {
  "1D": 96,
  "1W": 35,
  "1M": 90,
};

const RANGE_STEP_MS: Record<TimeRange, number> = {
  "1D": 4 * 60 * 1000,
  "1W": 45 * 60 * 1000,
  "1M": 8 * 60 * 60 * 1000,
};

function getEquity(symbol: string) {
  return EQUITIES[assertSupportedSymbol(symbol, SUPPORTED_MOCK_SYMBOLS)];
}

function quoteFromEquity(equity: MockEquity): EquityQuote {
  return {
    ...equity,
    ...calculateQuoteChange({
      lastPrice: equity.lastPrice,
      previousClose: equity.previousClose,
    }),
    source: "mock",
    updatedAt: UPDATED_AT,
  };
}

function buildHistory(equity: MockEquity, range: TimeRange): PricePoint[] {
  const count = RANGE_POINTS[range];
  const stepMs = RANGE_STEP_MS[range];
  const end = Date.parse(UPDATED_AT);
  const startValue = equity.previousClose;
  const delta = equity.lastPrice - startValue;

  return Array.from({ length: count }, (_, index) => {
    const progress = count === 1 ? 1 : index / (count - 1);
    const wave = Math.sin((index + equity.symbol.length) * 0.75) * 0.0018;
    const value =
      index === 0
        ? startValue
        : index === count - 1
          ? equity.lastPrice
          : startValue + delta * progress + equity.lastPrice * wave;

    return {
      timestamp: new Date(end - (count - 1 - index) * stepMs).toISOString(),
      value: roundMoney(value),
    };
  });
}

export class MockMarketDataProvider implements MarketDataProvider {
  readonly source = "mock" as const;

  async search(query: string): Promise<EquitySearchResult[]> {
    const normalizedQuery = normalizeSymbol(query);

    return Object.values(EQUITIES)
      .filter(
        (equity) =>
          equity.symbol.includes(normalizedQuery) ||
          equity.name.toUpperCase().includes(normalizedQuery),
      )
      .map(({ symbol, name, exchange, currency }) => ({
        symbol,
        name,
        exchange,
        currency,
      }));
  }

  async quote(symbol: string): Promise<EquityQuote> {
    return quoteFromEquity(getEquity(symbol));
  }

  async history(symbol: string, range: TimeRange): Promise<PricePoint[]> {
    return sortPriceSeries(buildHistory(getEquity(symbol), range));
  }
}

export const SUPPORTED_MOCK_SYMBOLS = Object.keys(EQUITIES);
