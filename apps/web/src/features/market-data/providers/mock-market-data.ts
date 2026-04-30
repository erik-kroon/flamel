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

const UPDATED_AT = "2026-04-30T18:00:00.000Z";

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
  AMZN: {
    symbol: "AMZN",
    name: "Amazon.com, Inc.",
    exchange: "NASDAQ",
    currency: "USD",
    lastPrice: 186.11,
    previousClose: 184.9,
    open: 185.2,
    high: 187.44,
    low: 183.81,
    volume: 41_884_229,
    marketCap: 1_960_000_000_000,
    peRatio: 34.6,
  },
  GOOG: {
    symbol: "GOOG",
    name: "Alphabet Inc.",
    exchange: "NASDAQ",
    currency: "USD",
    lastPrice: 371.99,
    previousClose: 347.76,
    open: 354.22,
    high: 373.4,
    low: 350.61,
    volume: 18_225_410,
    marketCap: 2_260_000_000_000,
    peRatio: 29.8,
  },
  META: {
    symbol: "META",
    name: "Meta Platforms, Inc.",
    exchange: "NASDAQ",
    currency: "USD",
    lastPrice: 531.28,
    previousClose: 526.72,
    open: 528.4,
    high: 535.6,
    low: 524.91,
    volume: 16_103_778,
    marketCap: 1_340_000_000_000,
    peRatio: 27.2,
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
  NFLX: {
    symbol: "NFLX",
    name: "Netflix, Inc.",
    exchange: "NASDAQ",
    currency: "USD",
    lastPrice: 982.41,
    previousClose: 974.33,
    open: 977.05,
    high: 988.9,
    low: 969.2,
    volume: 3_774_109,
    marketCap: 420_000_000_000,
    peRatio: 45.1,
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
  QQQ: {
    symbol: "QQQ",
    name: "Invesco QQQ Trust",
    exchange: "NASDAQ",
    currency: "USD",
    lastPrice: 666.87,
    previousClose: 659.49,
    open: 661.2,
    high: 668.1,
    low: 657.9,
    volume: 42_115_003,
    marketCap: 0,
    peRatio: undefined,
  },
  SPY: {
    symbol: "SPY",
    name: "SPDR S&P 500 ETF Trust",
    exchange: "NYSE Arca",
    currency: "USD",
    lastPrice: 713.77,
    previousClose: 712.47,
    open: 711.82,
    high: 714.3,
    low: 709.4,
    volume: 58_229_441,
    marketCap: 0,
    peRatio: undefined,
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
  VOO: {
    symbol: "VOO",
    name: "Vanguard S&P 500 ETF",
    exchange: "NYSE Arca",
    currency: "USD",
    lastPrice: 656.09,
    previousClose: 654.95,
    open: 654.7,
    high: 657.1,
    low: 652.6,
    volume: 5_812_004,
    marketCap: 0,
    peRatio: undefined,
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

function seededNoise(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function buildHistory(equity: MockEquity, range: TimeRange): PricePoint[] {
  const count = RANGE_POINTS[range];
  const stepMs = RANGE_STEP_MS[range];
  const end = Date.parse(UPDATED_AT);
  const startValue = equity.previousClose;
  const delta = equity.lastPrice - startValue;
  const symbolSeed = equity.symbol
    .split("")
    .reduce((total, character) => total + character.charCodeAt(0), 0);
  const volatility = equity.lastPrice * (range === "1D" ? 0.0019 : range === "1W" ? 0.003 : 0.0042);
  let value = startValue;
  let lastShock = 0;

  return Array.from({ length: count }, (_, index) => {
    const progress = count === 1 ? 1 : index / (count - 1);
    const remaining = Math.max(count - index, 1);

    if (index === 0) {
      value = startValue;
    } else if (index === count - 1) {
      value = equity.lastPrice;
    } else {
      const target = startValue + delta * progress;
      const drift = (equity.lastPrice - value) / remaining;
      const shock = (seededNoise(symbolSeed + index * 17) - 0.5) * volatility;
      const regime = seededNoise(symbolSeed + Math.floor(index / 11) * 29) - 0.5;
      const meanReversion = (target - value) * 0.16;
      const eventMove = index % 23 === symbolSeed % 13 ? regime * volatility * 2.3 : 0;

      lastShock = shock;
      value += drift + shock + meanReversion + eventMove;
    }

    return {
      timestamp: new Date(end - (count - 1 - index) * stepMs).toISOString(),
      value: roundMoney(value),
      open: roundMoney(index === 0 ? startValue : value - lastShock * 0.25),
      high: roundMoney(value + Math.abs(lastShock) * 0.7),
      low: roundMoney(value - Math.abs(lastShock) * 0.7),
      close: roundMoney(value),
      volume: Math.round((equity.volume / count) * (0.65 + seededNoise(symbolSeed + index * 31))),
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
