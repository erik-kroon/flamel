import {
  type EquityQuote,
  type EquitySearchResult,
  type MarketDataProvider,
  type MarketDataSession,
  type MarketDataSessionResult,
  type PricePoint,
  type TimeRange,
} from "../types";

function quoteSource(quote: EquityQuote, fallback: MarketDataProvider["source"]) {
  return quote.source ?? fallback;
}

export class ProviderMarketDataSession implements MarketDataSession {
  constructor(private readonly provider: MarketDataProvider) {}

  async search(query: string): Promise<MarketDataSessionResult<EquitySearchResult[]>> {
    return {
      data: await this.provider.search(query),
      source: this.provider.source,
    };
  }

  async quote(symbol: string): Promise<MarketDataSessionResult<EquityQuote>> {
    const data = await this.provider.quote(symbol);

    return {
      data,
      source: quoteSource(data, this.provider.source),
    };
  }

  async history(symbol: string, range: TimeRange): Promise<MarketDataSessionResult<PricePoint[]>> {
    return {
      data: await this.provider.history(symbol, range),
      source: this.provider.source,
    };
  }
}
