import {
  type DataSource,
  type EquityQuote,
  type EquitySearchResult,
  type MarketDataProvider,
  type MarketDataSession,
  type MarketDataSessionResult,
  type PricePoint,
  type TimeRange,
} from "../types";

export class FallbackMarketDataProvider implements MarketDataProvider {
  readonly source: MarketDataProvider["source"];

  constructor(
    private readonly primary: MarketDataProvider,
    private readonly fallback: MarketDataProvider,
    private readonly onFallback?: (error: unknown) => void,
  ) {
    this.source = primary.source;
  }

  async search(query: string): Promise<EquitySearchResult[]> {
    try {
      return await this.primary.search(query);
    } catch (error) {
      this.onFallback?.(error);
      return this.fallback.search(query);
    }
  }

  async quote(symbol: string): Promise<EquityQuote> {
    try {
      return await this.primary.quote(symbol);
    } catch (error) {
      this.onFallback?.(error);
      return this.fallback.quote(symbol);
    }
  }

  async history(symbol: string, range: TimeRange): Promise<PricePoint[]> {
    try {
      return await this.primary.history(symbol, range);
    } catch (error) {
      this.onFallback?.(error);
      return this.fallback.history(symbol, range);
    }
  }
}

function fallbackReason(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Primary market data provider failed.";
}

function quoteSource(quote: EquityQuote, fallback: DataSource) {
  return quote.source ?? fallback;
}

export class ProviderMarketDataSession implements MarketDataSession {
  constructor(
    private readonly provider: MarketDataProvider,
    private readonly status: MarketDataSessionResult<unknown>["status"] = "primary",
    private readonly reason?: string,
  ) {}

  async search(query: string): Promise<MarketDataSessionResult<EquitySearchResult[]>> {
    return {
      data: await this.provider.search(query),
      source: this.provider.source,
      status: this.status,
      fallbackReason: this.reason,
    };
  }

  async quote(symbol: string): Promise<MarketDataSessionResult<EquityQuote>> {
    const data = await this.provider.quote(symbol);

    return {
      data,
      source: quoteSource(data, this.provider.source),
      status: this.status,
      fallbackReason: this.reason,
    };
  }

  async history(symbol: string, range: TimeRange): Promise<MarketDataSessionResult<PricePoint[]>> {
    return {
      data: await this.provider.history(symbol, range),
      source: this.provider.source,
      status: this.status,
      fallbackReason: this.reason,
    };
  }
}

export class FallbackMarketDataSession implements MarketDataSession {
  private readonly symbolSources = new Map<string, DataSource>();
  private readonly symbolFallbackReasons = new Map<string, string>();

  constructor(
    private readonly primary: MarketDataProvider,
    private readonly fallback: MarketDataProvider,
    private readonly onFallback?: (error: unknown) => void,
  ) {}

  async search(query: string): Promise<MarketDataSessionResult<EquitySearchResult[]>> {
    try {
      return {
        data: await this.primary.search(query),
        source: this.primary.source,
        status: "primary",
      };
    } catch (error) {
      this.onFallback?.(error);

      return {
        data: await this.fallback.search(query),
        source: this.fallback.source,
        status: "fallback",
        fallbackReason: fallbackReason(error),
      };
    }
  }

  async quote(symbol: string): Promise<MarketDataSessionResult<EquityQuote>> {
    try {
      const data = await this.primary.quote(symbol);
      const source = quoteSource(data, this.primary.source);
      this.symbolSources.set(symbol, source);

      return {
        data,
        source,
        status: "primary",
      };
    } catch (error) {
      this.onFallback?.(error);
      const data = await this.fallback.quote(symbol);
      const source = quoteSource(data, this.fallback.source);
      const reason = fallbackReason(error);
      this.symbolSources.set(symbol, source);
      this.symbolFallbackReasons.set(symbol, reason);

      return {
        data,
        source,
        status: "fallback",
        fallbackReason: reason,
      };
    }
  }

  async history(symbol: string, range: TimeRange): Promise<MarketDataSessionResult<PricePoint[]>> {
    if (this.symbolSources.get(symbol) === this.fallback.source) {
      return {
        data: await this.fallback.history(symbol, range),
        source: this.fallback.source,
        status: "fallback",
        fallbackReason: this.symbolFallbackReasons.get(symbol),
      };
    }

    try {
      return {
        data: await this.primary.history(symbol, range),
        source: this.primary.source,
        status: "primary",
      };
    } catch (error) {
      this.onFallback?.(error);

      return {
        data: await this.fallback.history(symbol, range),
        source: this.fallback.source,
        status: "fallback",
        fallbackReason: fallbackReason(error),
      };
    }
  }
}
