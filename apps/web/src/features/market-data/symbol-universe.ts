import type { EquitySearchResult, EquitySymbol } from "./types";

export const DEFAULT_SYMBOLS = ["AAPL", "AMZN", "GOOG", "META", "MSFT", "NVDA", "TSLA"] as const;

export const SEARCHABLE_US_EQUITIES: readonly EquitySearchResult[] = [
  { symbol: "AAPL", name: "Apple Inc.", exchange: "NASDAQ", currency: "USD" },
  { symbol: "AMZN", name: "Amazon.com, Inc.", exchange: "NASDAQ", currency: "USD" },
  { symbol: "GOOG", name: "Alphabet Inc.", exchange: "NASDAQ", currency: "USD" },
  { symbol: "META", name: "Meta Platforms, Inc.", exchange: "NASDAQ", currency: "USD" },
  { symbol: "MSFT", name: "Microsoft Corporation", exchange: "NASDAQ", currency: "USD" },
  { symbol: "NVDA", name: "NVIDIA Corporation", exchange: "NASDAQ", currency: "USD" },
  { symbol: "QQQ", name: "Invesco QQQ Trust", exchange: "NASDAQ", currency: "USD" },
  { symbol: "SPY", name: "SPDR S&P 500 ETF Trust", exchange: "NYSE Arca", currency: "USD" },
  { symbol: "TSLA", name: "Tesla, Inc.", exchange: "NASDAQ", currency: "USD" },
  { symbol: "VOO", name: "Vanguard S&P 500 ETF", exchange: "NYSE Arca", currency: "USD" },
];

export const FIXTURE_SYMBOL_DETAILS = Object.fromEntries(
  SEARCHABLE_US_EQUITIES.map(({ symbol, name, exchange, currency }) => [
    symbol,
    { name, exchange, currency },
  ]),
) as Record<string, Omit<EquitySearchResult, "symbol">>;

export function fixtureUniverseCopy(symbols: readonly EquitySymbol[] = DEFAULT_SYMBOLS) {
  return symbols.join(", ");
}

export function unsupportedSymbolMessage(symbols: readonly EquitySymbol[] = DEFAULT_SYMBOLS) {
  return `Symbol not included in bundled fixture universe. Available: ${fixtureUniverseCopy(symbols)}.`;
}
