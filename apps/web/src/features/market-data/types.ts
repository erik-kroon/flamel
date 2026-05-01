export type EquitySymbol = string;

export type TimeRange = "1D" | "1W" | "1M";

export type DataSource = "mock" | "databento";

export interface EquitySearchResult {
  symbol: EquitySymbol;
  name: string;
  exchange: string;
  currency: string;
}

export interface EquityQuote extends EquitySearchResult {
  lastPrice: number;
  previousClose: number;
  open: number;
  high: number;
  low: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: number;
  peRatio?: number;
  updatedAt: string;
  source: DataSource;
}

export interface PricePoint {
  timestamp: string;
  value: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
}

export class MarketDataNotFoundError extends Error {
  constructor(symbol: string) {
    super(`No market data found for ${symbol}`);
    this.name = "MarketDataNotFoundError";
  }
}

export class MarketDataProviderError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "MarketDataProviderError";
  }
}

export interface MarketDataProvider {
  readonly source: DataSource;
  search(query: string): Promise<EquitySearchResult[]>;
  quote(symbol: EquitySymbol): Promise<EquityQuote>;
  history(symbol: EquitySymbol, range: TimeRange): Promise<PricePoint[]>;
}

export interface MarketDataSessionResult<TData> {
  data: TData;
  source: DataSource;
}

export interface MarketDataSession {
  search(query: string): Promise<MarketDataSessionResult<EquitySearchResult[]>>;
  quote(symbol: EquitySymbol): Promise<MarketDataSessionResult<EquityQuote>>;
  history(symbol: EquitySymbol, range: TimeRange): Promise<MarketDataSessionResult<PricePoint[]>>;
}

export interface SymbolIntakePolicy {
  fixtureSymbols: readonly EquitySymbol[];
  unsupportedMessage: string;
}
