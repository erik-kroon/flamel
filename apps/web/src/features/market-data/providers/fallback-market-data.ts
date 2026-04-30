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
  private readonly symbolAffinities = new Map<
    string,
    Pick<MarketDataSessionResult<unknown>, "source" | "status" | "fallbackReason">
  >();
  private readonly quoteRequests = new Map<string, Promise<MarketDataSessionResult<EquityQuote>>>();

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
    const pending = this.quoteRequests.get(symbol);
    if (pending) {
      return pending;
    }

    const request = this.loadQuote(symbol).finally(() => {
      this.quoteRequests.delete(symbol);
    });
    this.quoteRequests.set(symbol, request);
    return request;
  }

  private async loadQuote(symbol: string): Promise<MarketDataSessionResult<EquityQuote>> {
    try {
      const data = await this.primary.quote(symbol);
      const source = quoteSource(data, this.primary.source);
      this.rememberSymbolAffinity(symbol, { source, status: "primary" });

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
      this.rememberSymbolAffinity(symbol, {
        source,
        status: "fallback",
        fallbackReason: reason,
      });

      return {
        data,
        source,
        status: "fallback",
        fallbackReason: reason,
      };
    }
  }

  async history(symbol: string, range: TimeRange): Promise<MarketDataSessionResult<PricePoint[]>> {
    await this.quoteRequests.get(symbol)?.catch(() => undefined);

    const affinity = this.symbolAffinities.get(symbol);

    if (affinity?.source === this.fallback.source) {
      return {
        data: await this.fallback.history(symbol, range),
        source: affinity.source,
        status: affinity.status,
        fallbackReason: affinity.fallbackReason,
      };
    }

    try {
      const data = await this.primary.history(symbol, range);
      this.rememberSymbolAffinity(symbol, {
        source: this.primary.source,
        status: "primary",
      });

      return {
        data,
        source: this.primary.source,
        status: "primary",
      };
    } catch (error) {
      this.onFallback?.(error);
      const reason = fallbackReason(error);
      this.rememberSymbolAffinity(symbol, {
        source: this.fallback.source,
        status: "fallback",
        fallbackReason: reason,
      });

      return {
        data: await this.fallback.history(symbol, range),
        source: this.fallback.source,
        status: "fallback",
        fallbackReason: reason,
      };
    }
  }

  private rememberSymbolAffinity(
    symbol: string,
    affinity: Pick<MarketDataSessionResult<unknown>, "source" | "status" | "fallbackReason">,
  ) {
    this.symbolAffinities.set(symbol, affinity);
  }
}
