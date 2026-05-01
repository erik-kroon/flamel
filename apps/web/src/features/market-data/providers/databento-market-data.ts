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
import { normalizeSymbol } from "../symbols";
import {
  type DatabentoFixtureEquity,
  type DatabentoFixtureFile,
  mapDatabentoFixtureHistory,
  parseDatabentoFixtureFile,
} from "../databento-fixture";

export type { DatabentoOhlcvRecord } from "../databento-fixture";

interface DatabentoExportProviderOptions {
  data?: DatabentoFixtureFile;
  url?: string;
}

function mapExportQuote(equity: DatabentoFixtureEquity): EquityQuote {
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

export class DatabentoExportMarketDataProvider implements MarketDataProvider {
  readonly source = "databento" as const;

  private exportPromise?: Promise<DatabentoFixtureFile>;
  private exportIndexPromise?: Promise<Map<string, DatabentoFixtureEquity>>;
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
      mapDatabentoFixtureHistory(equity.history[range]),
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

      return parseDatabentoFixtureFile(await response.json());
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
