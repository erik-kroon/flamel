import {
  type EquityQuote,
  type EquitySearchResult,
  MarketDataNotFoundError,
  MarketDataProviderError,
  type MarketDataProvider,
  type PricePoint,
  type TimeRange,
} from "../types";
import { calculateQuoteChange, roundMoney } from "../finance-calculations";
import { sortPriceSeries } from "../price-series";
import { normalizeSymbol } from "../symbols";
import { SEARCHABLE_US_EQUITIES } from "../symbol-universe";

export interface DatabentoTimeseriesRequest {
  dataset: string;
  symbols: string;
  schema: "ohlcv-1m" | "ohlcv-1d";
  start: string;
  end: string;
  stype_in: "raw_symbol";
  stype_out: "raw_symbol";
  encoding: "json";
  compression: "none";
  pretty_px: "true";
  pretty_ts: "true";
  map_symbols: "true";
  limit?: number;
}

export interface DatabentoOhlcvRecord {
  hd?: {
    ts_event?: string | number;
  };
  ts_event?: string | number;
  open?: string | number;
  high?: string | number;
  low?: string | number;
  close?: string | number;
  volume?: string | number;
  symbol?: string;
}

export interface DatabentoHistoricalClient {
  getRange(request: DatabentoTimeseriesRequest): Promise<DatabentoOhlcvRecord[]>;
}

interface DatabentoOhlcvBar {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface DatabentoMarketDataProviderOptions {
  client: DatabentoHistoricalClient;
  today?: Date;
}

interface DatabentoExportProviderOptions {
  data?: DatabentoExportFile;
  url?: string;
}

interface DatabentoExportBar {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface DatabentoExportEquity {
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
  previousClose: number;
  quote: DatabentoExportBar;
  history: Record<TimeRange, DatabentoExportHistory>;
}

export interface DatabentoExportFile {
  source: "databento";
  dataset: string;
  schema: string;
  requestId: string;
  equities: DatabentoExportEquity[];
}

type DatabentoExportHistory =
  | PricePoint[]
  | {
      granularity: string;
      session: string;
      bars: DatabentoExportBar[];
    };

const DEFAULT_DATASET = "XNAS.ITCH";

const RANGE_DAYS: Record<TimeRange, number> = {
  "1D": 1,
  "1W": 7,
  "1M": 31,
};

const RANGE_LIMITS: Record<TimeRange, number> = {
  "1D": 390,
  "1W": 2_200,
  "1M": 40,
};

const FIVE_MINUTES_MS = 5 * 60 * 1000;

function toDateTime(date: Date) {
  return date.toISOString();
}

function rangeStart(range: TimeRange, today: Date) {
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - RANGE_DAYS[range]);
  return start;
}

export function planDatabentoHistoryRequest(
  symbol: string,
  range: TimeRange,
  today: Date,
  dataset = DEFAULT_DATASET,
): DatabentoTimeseriesRequest {
  const normalizedSymbol = normalizeSymbol(symbol);

  return {
    dataset,
    symbols: normalizedSymbol,
    schema: range === "1M" ? "ohlcv-1d" : "ohlcv-1m",
    start: toDateTime(rangeStart(range, today)),
    end: toDateTime(today),
    stype_in: "raw_symbol",
    stype_out: "raw_symbol",
    encoding: "json",
    compression: "none",
    pretty_px: "true",
    pretty_ts: "true",
    map_symbols: "true",
    limit: RANGE_LIMITS[range],
  };
}

export function planDatabentoQuoteRequest(
  symbol: string,
  today: Date,
  dataset = DEFAULT_DATASET,
): DatabentoTimeseriesRequest {
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - 10);

  return {
    ...planDatabentoHistoryRequest(symbol, "1W", today, dataset),
    start: toDateTime(start),
    limit: 2,
  };
}

function toNumber(value: string | number | undefined) {
  if (value === undefined) {
    return undefined;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function timestampFromRecord(record: DatabentoOhlcvRecord) {
  const timestamp = record.ts_event ?? record.hd?.ts_event;

  if (timestamp === undefined) {
    return undefined;
  }

  if (typeof timestamp === "number") {
    return new Date(timestamp / 1_000_000).toISOString();
  }

  if (/^\d+$/.test(timestamp)) {
    return new Date(Number(timestamp) / 1_000_000).toISOString();
  }

  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
}

function validBars(records: DatabentoOhlcvRecord[]) {
  return records
    .flatMap((record): DatabentoOhlcvBar[] => {
      const timestamp = timestampFromRecord(record);
      const open = toNumber(record.open);
      const high = toNumber(record.high);
      const low = toNumber(record.low);
      const close = toNumber(record.close);

      if (
        !timestamp ||
        open === undefined ||
        high === undefined ||
        low === undefined ||
        close === undefined
      ) {
        return [];
      }

      return [
        {
          timestamp,
          open,
          high,
          low,
          close,
          volume: toNumber(record.volume) ?? 0,
        },
      ];
    })
    .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp));
}

function aggregateBars(bars: DatabentoOhlcvBar[], intervalMs: number) {
  const buckets = new Map<number, DatabentoOhlcvBar>();

  for (const bar of bars) {
    const bucketTime = Math.floor(Date.parse(bar.timestamp) / intervalMs) * intervalMs;
    const current = buckets.get(bucketTime);

    if (!current) {
      buckets.set(bucketTime, {
        timestamp: new Date(bucketTime).toISOString(),
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
      });
      continue;
    }

    current.high = Math.max(current.high, bar.high);
    current.low = Math.min(current.low, bar.low);
    current.close = bar.close;
    current.volume += bar.volume;
  }

  return [...buckets.values()].sort(
    (left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp),
  );
}

export function mapDatabentoHistory(
  records: DatabentoOhlcvRecord[],
  range?: TimeRange,
): PricePoint[] {
  const bars = validBars(records);
  const displayBars = range === "1W" ? aggregateBars(bars, FIVE_MINUTES_MS) : bars;

  return sortPriceSeries(
    displayBars.map((record) => ({
      timestamp: record.timestamp,
      value: roundMoney(record.close),
      open: roundMoney(record.open),
      high: roundMoney(record.high),
      low: roundMoney(record.low),
      close: roundMoney(record.close),
      volume: record.volume,
    })),
  );
}

export function mapDatabentoQuote(symbol: string, records: DatabentoOhlcvRecord[]): EquityQuote {
  const bars = validBars(records);
  const latest = bars.at(-1);
  const previous = bars.at(-2);

  if (!latest) {
    throw new MarketDataNotFoundError(symbol);
  }

  const previousClose = previous?.close ?? latest.open;
  const normalizedSymbol = normalizeSymbol(symbol);
  const knownEquity = SEARCHABLE_US_EQUITIES.find((equity) => equity.symbol === normalizedSymbol);

  return {
    symbol: normalizedSymbol,
    name: knownEquity?.name ?? normalizedSymbol,
    exchange: knownEquity?.exchange ?? "NASDAQ",
    currency: knownEquity?.currency ?? "USD",
    lastPrice: roundMoney(latest.close),
    previousClose: roundMoney(previousClose),
    open: roundMoney(latest.open),
    high: roundMoney(latest.high),
    low: roundMoney(latest.low),
    volume: latest.volume,
    ...calculateQuoteChange({
      lastPrice: latest.close,
      previousClose,
    }),
    updatedAt: latest.timestamp,
    source: "databento",
  };
}

function mapExportQuote(equity: DatabentoExportEquity): EquityQuote {
  return {
    symbol: equity.symbol,
    name: equity.name,
    exchange: equity.exchange,
    currency: equity.currency,
    lastPrice: roundMoney(equity.quote.close),
    previousClose: roundMoney(equity.previousClose),
    open: roundMoney(equity.quote.open),
    high: roundMoney(equity.quote.high),
    low: roundMoney(equity.quote.low),
    volume: equity.quote.volume,
    ...calculateQuoteChange({
      lastPrice: equity.quote.close,
      previousClose: equity.previousClose,
    }),
    updatedAt: equity.quote.timestamp,
    source: "databento",
  };
}

function mapExportHistory(history: DatabentoExportHistory | undefined) {
  if (!history) {
    return [];
  }

  if (Array.isArray(history)) {
    return sortPriceSeries(history);
  }

  return sortPriceSeries(
    history.bars.map((bar) => ({
      timestamp: bar.timestamp,
      value: roundMoney(bar.close),
      open: roundMoney(bar.open),
      high: roundMoney(bar.high),
      low: roundMoney(bar.low),
      close: roundMoney(bar.close),
      volume: bar.volume,
    })),
  );
}

function toProviderError(message: string, error: unknown) {
  if (error instanceof MarketDataNotFoundError) {
    return error;
  }

  return new MarketDataProviderError(message, error);
}

export class DatabentoExportMarketDataProvider implements MarketDataProvider {
  readonly source = "databento" as const;

  private exportPromise?: Promise<DatabentoExportFile>;
  private exportIndexPromise?: Promise<Map<string, DatabentoExportEquity>>;
  private readonly quoteCache = new Map<string, Promise<EquityQuote>>();
  private readonly historyCache = new Map<string, Promise<PricePoint[]>>();

  constructor(private readonly options: DatabentoExportProviderOptions) {}

  async search(query: string): Promise<EquitySearchResult[]> {
    const normalizedQuery = normalizeSymbol(query);

    if (!normalizedQuery) {
      return [];
    }

    const data = await this.loadExport();
    return data.equities
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
    const normalizedSymbol = normalizeSymbol(symbol);
    const cached = this.quoteCache.get(normalizedSymbol);
    if (cached) {
      return cached;
    }

    const promise = this.findEquity(normalizedSymbol).then(mapExportQuote);
    this.quoteCache.set(normalizedSymbol, promise);
    return promise;
  }

  async history(symbol: string, range: TimeRange): Promise<PricePoint[]> {
    const normalizedSymbol = normalizeSymbol(symbol);
    const cacheKey = `${normalizedSymbol}:${range}`;
    const cached = this.historyCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const promise = this.findEquity(normalizedSymbol).then((equity) =>
      mapExportHistory(equity.history[range]),
    );
    this.historyCache.set(cacheKey, promise);
    return promise;
  }

  private loadExport() {
    if (this.options.data) {
      return Promise.resolve(this.options.data);
    }

    if (!this.options.url) {
      throw new MarketDataProviderError("Databento export provider requires data or a URL.");
    }

    this.exportPromise ??= fetch(this.options.url).then(async (response) => {
      if (!response.ok) {
        throw new MarketDataProviderError(`Unable to load Databento export ${this.options.url}.`);
      }

      return response.json() as Promise<DatabentoExportFile>;
    });

    return this.exportPromise;
  }

  private async loadExportIndex() {
    this.exportIndexPromise ??= this.loadExport().then(
      (data) => new Map(data.equities.map((equity) => [equity.symbol, equity])),
    );

    return this.exportIndexPromise;
  }

  private async findEquity(symbol: string) {
    const normalizedSymbol = normalizeSymbol(symbol);
    const equity = (await this.loadExportIndex()).get(normalizedSymbol);

    if (!equity) {
      throw new MarketDataNotFoundError(normalizedSymbol);
    }

    return equity;
  }
}

export class DatabentoMarketDataProvider implements MarketDataProvider {
  readonly source = "databento" as const;

  private readonly quoteCache = new Map<string, Promise<EquityQuote>>();
  private readonly historyCache = new Map<string, Promise<PricePoint[]>>();
  private readonly today: Date;

  constructor(private readonly options: DatabentoMarketDataProviderOptions) {
    this.today = options.today ?? new Date();
  }

  async search(query: string): Promise<EquitySearchResult[]> {
    const normalizedQuery = normalizeSymbol(query);

    if (!normalizedQuery) {
      return [];
    }

    return SEARCHABLE_US_EQUITIES.filter(
      (equity) =>
        equity.symbol.includes(normalizedQuery) ||
        equity.name.toUpperCase().includes(normalizedQuery),
    );
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
      return mapDatabentoQuote(
        symbol,
        await this.options.client.getRange(planDatabentoQuoteRequest(symbol, this.today)),
      );
    } catch (error) {
      throw toProviderError(`Unable to load Databento quote for ${symbol}.`, error);
    }
  }

  private async loadHistory(symbol: string, range: TimeRange) {
    try {
      const records = await this.options.client.getRange(
        planDatabentoHistoryRequest(symbol, range, this.today),
      );
      return mapDatabentoHistory(records, range);
    } catch (error) {
      throw toProviderError(`Unable to load Databento history for ${symbol}.`, error);
    }
  }
}

function basicAuth(apiKey: string) {
  const credentials = `${apiKey}:`;

  if (typeof btoa === "function") {
    return btoa(credentials);
  }

  return Buffer.from(credentials).toString("base64");
}

function parseJsonLines(text: string): DatabentoOhlcvRecord[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as DatabentoOhlcvRecord);
}

export function createDatabentoHistoricalClient(apiKey: string): DatabentoHistoricalClient {
  return {
    async getRange(request) {
      const response = await fetch("https://hist.databento.com/v0/timeseries.get_range", {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicAuth(apiKey)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(
          Object.entries(request).map(([key, value]) => [key, String(value)]),
        ),
      });

      if (!response.ok) {
        throw new Error(`Databento request failed with HTTP ${response.status}.`);
      }

      return parseJsonLines(await response.text());
    },
  };
}
