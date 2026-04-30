import { describe, expect, it, vi } from "vitest";
import { parseWebEnv } from "@flamel/env/web";

import {
  FallbackMarketDataSession,
  FallbackMarketDataProvider,
} from "../providers/fallback-market-data";
import {
  MASSIVE_API_KEY_ENV,
  createMarketDataProvider,
} from "../providers/provider-factory";
import {
  MassiveMarketDataProvider,
  planMassiveHistoryRequest,
  planMassiveHistoryWindow,
  planMassiveQuoteRequests,
  planMassiveSearchRequest,
  type MassiveRestClient,
} from "../providers/massive-market-data";
import { MarketDataProviderError } from "../types";
import {
  massiveAggregatesFixture,
  massiveSnapshotFixture,
  massiveTickerFixture,
} from "../fixtures/massive";

function createClient(): MassiveRestClient {
  return {
    getTicker: vi.fn(async () => ({ results: massiveTickerFixture })),
    listTickers: vi.fn(async () => ({
      results: [massiveTickerFixture],
    })),
    getStocksSnapshotTicker: vi.fn(async () => ({
      ticker: massiveSnapshotFixture,
    })),
    getStocksAggregates: vi.fn(async () => massiveAggregatesFixture),
  };
}

describe("MassiveMarketDataProvider", () => {
  it("plans Massive search, quote, and history requests without transport", () => {
    const today = new Date("2026-04-30T12:00:00.000Z");

    expect(planMassiveSearchRequest(" apple ")).toEqual({
      active: true,
      limit: 10,
      market: "stocks",
      order: "asc",
      search: "APPLE",
      sort: "ticker",
      type: "CS",
    });
    expect(planMassiveSearchRequest(" ")).toBeUndefined();
    expect(planMassiveQuoteRequests("aapl")).toEqual({
      ticker: { ticker: "AAPL" },
      snapshot: { stocksTicker: "AAPL" },
    });
    expect(planMassiveHistoryWindow("1M", today)).toEqual({
      from: "2026-03-30",
      to: "2026-04-30",
    });
    expect(planMassiveHistoryRequest("aapl", "1D", today)).toEqual({
      adjusted: true,
      from: "2026-04-29",
      limit: 120,
      multiplier: 30,
      sort: "asc",
      stocksTicker: "AAPL",
      timespan: "minute",
      to: "2026-04-30",
    });
    expect(planMassiveHistoryRequest("aapl", "1W", today)).toEqual({
      adjusted: true,
      from: "2026-04-23",
      limit: 40,
      multiplier: 1,
      sort: "asc",
      stocksTicker: "AAPL",
      timespan: "day",
      to: "2026-04-30",
    });
  });

  it("normalizes Massive quote and search responses", async () => {
    const client = createClient();
    const provider = new MassiveMarketDataProvider({ client });

    await expect(provider.search("apple")).resolves.toEqual([
      {
        symbol: "AAPL",
        name: "Apple Inc.",
        exchange: "NASDAQ",
        currency: "USD",
      },
    ]);
    await expect(provider.quote("aapl")).resolves.toMatchObject({
      symbol: "AAPL",
      lastPrice: 209.44,
      source: "massive",
    });
    expect(client.listTickers).toHaveBeenCalledWith({
      active: true,
      limit: 10,
      market: "stocks",
      order: "asc",
      search: "APPLE",
      sort: "ticker",
      type: "CS",
    });
  });

  it("normalizes and caches aggregate history by symbol and range", async () => {
    const client = createClient();
    const provider = new MassiveMarketDataProvider({
      client,
      today: new Date("2026-04-30T12:00:00.000Z"),
    });

    const first = await provider.history("AAPL", "1W");
    const second = await provider.history("aapl", "1W");

    expect(first).toBe(second);
    expect(client.getStocksAggregates).toHaveBeenCalledTimes(1);
    expect(client.getStocksAggregates).toHaveBeenCalledWith({
      adjusted: true,
      from: "2026-04-23",
      limit: 40,
      multiplier: 1,
      sort: "asc",
      stocksTicker: "AAPL",
      timespan: "day",
      to: "2026-04-30",
    });
  });

  it("wraps unexpected client failures in UI-safe provider errors", async () => {
    const client = createClient();
    (client.getTicker as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("401 secret"));
    const provider = new MassiveMarketDataProvider({ client });

    await expect(provider.quote("AAPL")).rejects.toBeInstanceOf(MarketDataProviderError);
  });
});

describe("market data provider fallback", () => {
  it("parses web env into named provider configuration", () => {
    expect(parseWebEnv({ [MASSIVE_API_KEY_ENV]: " test-key " })).toEqual({
      massiveApiKey: "test-key",
    });
    expect(parseWebEnv({ [MASSIVE_API_KEY_ENV]: "" })).toEqual({
      massiveApiKey: undefined,
    });
  });

  it("uses mock fallback when no Massive API key is configured", () => {
    const selection = createMarketDataProvider(parseWebEnv({ [MASSIVE_API_KEY_ENV]: "" }));

    expect(selection.configuredSource).toBe("mock");
    expect(selection.fallbackReason).toContain(MASSIVE_API_KEY_ENV);
  });

  it("reports mock session status when no Massive API key is configured", async () => {
    const selection = createMarketDataProvider(parseWebEnv({ [MASSIVE_API_KEY_ENV]: "" }));

    await expect(selection.session.quote("AAPL")).resolves.toMatchObject({
      source: "mock",
      status: "fallback",
      fallbackReason: expect.stringContaining(MASSIVE_API_KEY_ENV),
      data: {
        symbol: "AAPL",
        source: "mock",
      },
    });
  });

  it("selects Massive REST when an API key is configured", () => {
    const selection = createMarketDataProvider(
      parseWebEnv({
        [MASSIVE_API_KEY_ENV]: "test-key",
      }),
    );

    expect(selection.configuredSource).toBe("massive");
    expect(selection.session).toBeDefined();
  });

  it("falls back to deterministic mock data when the primary provider fails", async () => {
    const fallbackProvider = new FallbackMarketDataProvider(
      {
        source: "massive",
        search: vi.fn(async () => {
          throw new Error("rate limited");
        }),
        quote: vi.fn(async () => {
          throw new Error("rate limited");
        }),
        history: vi.fn(async () => {
          throw new Error("rate limited");
        }),
      },
      createMarketDataProvider(parseWebEnv({})).provider,
    );

    await expect(fallbackProvider.quote("AAPL")).resolves.toMatchObject({
      symbol: "AAPL",
      source: "mock",
    });
    await expect(fallbackProvider.history("AAPL", "1D")).resolves.not.toEqual([]);
    await expect(fallbackProvider.search("AAPL")).resolves.toHaveLength(1);
  });

  it("reports actual source, status, and fallback reason from session calls", async () => {
    const fallbackSession = new FallbackMarketDataSession(
      {
        source: "massive",
        search: vi.fn(async () => {
          throw new Error("rate limited");
        }),
        quote: vi.fn(async () => {
          throw new Error("rate limited");
        }),
        history: vi.fn(async () => {
          throw new Error("rate limited");
        }),
      },
      createMarketDataProvider(parseWebEnv({})).provider,
    );

    await expect(fallbackSession.quote("AAPL")).resolves.toMatchObject({
      source: "mock",
      status: "fallback",
      fallbackReason: "rate limited",
      data: {
        symbol: "AAPL",
        source: "mock",
      },
    });
    await expect(fallbackSession.history("AAPL", "1D")).resolves.toMatchObject({
      source: "mock",
      status: "fallback",
      fallbackReason: "rate limited",
      data: expect.any(Array),
    });
    await expect(fallbackSession.search("AAPL")).resolves.toMatchObject({
      source: "mock",
      status: "fallback",
      fallbackReason: "rate limited",
      data: [
        {
          symbol: "AAPL",
        },
      ],
    });
  });
});
