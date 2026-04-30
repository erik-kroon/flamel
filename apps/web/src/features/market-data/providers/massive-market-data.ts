import { restClient } from "@massive.com/client-js";

import {
  type EquityQuote,
  type EquitySearchResult,
  MarketDataNotFoundError,
  MarketDataProviderError,
  type MarketDataProvider,
  type PricePoint,
  type TimeRange,
} from "../types";
import {
  mapMassiveAggregates,
  mapMassiveQuote,
  mapMassiveTickerSearch,
  type MassiveAggregatesResponse,
  type MassiveSnapshotTickerResponse,
  type MassiveTickerResponse,
  type MassiveTickerSearchResponse,
} from "./massive-mappers";
import { normalizeSymbol } from "../symbols";

type MaybeAxiosResponse<T> = T | { data: T };

export interface MassiveTickerRequest {
  ticker: string;
}

export interface MassiveTickerSearchRequest {
  type?: string;
  market?: string;
  search?: string;
  active?: boolean;
  order?: string;
  limit?: number;
  sort?: string;
}

export interface MassiveSnapshotTickerRequest {
  stocksTicker: string;
}

export interface MassiveAggregatesRequest {
  stocksTicker: string;
  multiplier: number;
  timespan: string;
  from: string;
  to: string;
  adjusted?: boolean;
  sort?: string;
  limit?: number;
}

export interface MassiveRestClient {
  getTicker(request: MassiveTickerRequest): Promise<MaybeAxiosResponse<MassiveTickerResponse>>;
  listTickers(
    request: MassiveTickerSearchRequest,
  ): Promise<MaybeAxiosResponse<MassiveTickerSearchResponse>>;
  getStocksSnapshotTicker(
    request: MassiveSnapshotTickerRequest,
  ): Promise<MaybeAxiosResponse<MassiveSnapshotTickerResponse>>;
  getStocksAggregates(
    request: MassiveAggregatesRequest,
  ): Promise<MaybeAxiosResponse<MassiveAggregatesResponse>>;
}

interface MassiveMarketDataProviderOptions {
  client: MassiveRestClient;
  today?: Date;
}

const RANGE_DAYS: Record<TimeRange, number> = {
  "1D": 1,
  "1W": 7,
  "1M": 31,
};

function unwrap<T>(response: MaybeAxiosResponse<T>): T {
  if (response && typeof response === "object" && "data" in response) {
    return response.data;
  }

  return response;
}

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function planMassiveSearchRequest(query: string): MassiveTickerSearchRequest | undefined {
  const normalizedQuery = normalizeSymbol(query);
  if (!normalizedQuery) {
    return undefined;
  }

  return {
    type: "CS",
    market: "stocks",
    search: normalizedQuery,
    active: true,
    order: "asc",
    limit: 10,
    sort: "ticker",
  };
}

export function planMassiveQuoteRequests(symbol: string): {
  ticker: MassiveTickerRequest;
  snapshot: MassiveSnapshotTickerRequest;
} {
  const normalizedSymbol = normalizeSymbol(symbol);

  return {
    ticker: { ticker: normalizedSymbol },
    snapshot: { stocksTicker: normalizedSymbol },
  };
}

export function planMassiveHistoryWindow(range: TimeRange, today: Date) {
  const to = new Date(today);
  const from = new Date(today);
  from.setUTCDate(from.getUTCDate() - RANGE_DAYS[range]);

  return {
    from: toDateString(from),
    to: toDateString(to),
  };
}

export function planMassiveHistoryRequest(
  symbol: string,
  range: TimeRange,
  today: Date,
): MassiveAggregatesRequest {
  const normalizedSymbol = normalizeSymbol(symbol);
  const { from, to } = planMassiveHistoryWindow(range, today);
  const isIntraday = range === "1D";

  return {
    stocksTicker: normalizedSymbol,
    multiplier: isIntraday ? 30 : 1,
    timespan: isIntraday ? "minute" : "day",
    from,
    to,
    adjusted: true,
    sort: "asc",
    limit: isIntraday ? 120 : 40,
  };
}

function toProviderError(message: string, error: unknown) {
  if (error instanceof MarketDataNotFoundError) {
    return error;
  }

  return new MarketDataProviderError(message, error);
}

export class MassiveMarketDataProvider implements MarketDataProvider {
  readonly source = "massive" as const;

  private readonly quoteCache = new Map<string, Promise<EquityQuote>>();
  private readonly historyCache = new Map<string, Promise<PricePoint[]>>();
  private readonly today: Date;

  constructor(private readonly options: MassiveMarketDataProviderOptions) {
    this.today = options.today ?? new Date();
  }

  async search(query: string): Promise<EquitySearchResult[]> {
    const request = planMassiveSearchRequest(query);
    if (!request) {
      return [];
    }

    try {
      const response = await this.options.client.listTickers(request);

      return mapMassiveTickerSearch(unwrap(response));
    } catch (error) {
      throw toProviderError("Unable to search Massive market data.", error);
    }
  }

  quote(symbol: string): Promise<EquityQuote> {
    const normalizedSymbol = normalizeSymbol(symbol);
    const cached = this.quoteCache.get(normalizedSymbol);
    if (cached) {
      return cached;
    }

    const promise = this.loadQuote(normalizedSymbol);
    this.quoteCache.set(normalizedSymbol, promise);
    return promise;
  }

  history(symbol: string, range: TimeRange): Promise<PricePoint[]> {
    const normalizedSymbol = normalizeSymbol(symbol);
    const cacheKey = `${normalizedSymbol}:${range}`;
    const cached = this.historyCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const promise = this.loadHistory(normalizedSymbol, range);
    this.historyCache.set(cacheKey, promise);
    return promise;
  }

  private async loadQuote(symbol: string) {
    try {
      const request = planMassiveQuoteRequests(symbol);
      const [tickerResponse, snapshotResponse] = await Promise.all([
        this.options.client.getTicker(request.ticker),
        this.options.client.getStocksSnapshotTicker(request.snapshot),
      ]);
      const ticker = unwrap(tickerResponse).results;
      const snapshot = unwrap(snapshotResponse).ticker;

      if (!ticker || !snapshot) {
        throw new MarketDataNotFoundError(symbol);
      }

      return mapMassiveQuote(ticker, snapshot);
    } catch (error) {
      throw toProviderError(`Unable to load Massive quote for ${symbol}.`, error);
    }
  }

  private async loadHistory(symbol: string, range: TimeRange) {
    try {
      const request = planMassiveHistoryRequest(symbol, range, this.today);
      const response = await this.options.client.getStocksAggregates(request);

      return mapMassiveAggregates(unwrap(response));
    } catch (error) {
      throw toProviderError(`Unable to load Massive history for ${symbol}.`, error);
    }
  }
}

export function createMassiveRestClient(apiKey: string): MassiveRestClient {
  return restClient(apiKey, "https://api.massive.com") as unknown as MassiveRestClient;
}
