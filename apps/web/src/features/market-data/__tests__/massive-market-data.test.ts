import { describe, expect, it, vi } from "vitest";
import { parseWebEnv } from "@flamel/env/web";

import { FallbackMarketDataSession } from "../providers/fallback-market-data";
import { DatabentoExportMarketDataProvider } from "../providers/databento-market-data";
import { MASSIVE_API_KEY_ENV, createMarketDataProvider } from "../providers/provider-factory";
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

const databentoFixture = {
  source: "databento",
  dataset: "XNAS.ITCH",
  schema: "app-chart-fixture-v1",
  requestId: "test-fixture",
  equities: [
    {
      symbol: "AAPL",
      name: "Apple Inc.",
      exchange: "NASDAQ",
      currency: "USD",
      previousClose: 207,
      quote: {
        timestamp: "2026-04-29T20:00:00.000Z",
        open: 207.5,
        high: 211,
        low: 206.5,
        close: 210,
        volume: 1200,
      },
      history: {
        "1D": {
          granularity: "1m",
          session: "extended",
          bars: [
            {
              timestamp: "2026-04-29T20:00:00.000Z",
              open: 207.5,
              high: 211,
              low: 206.5,
              close: 210,
              volume: 1200,
            },
          ],
        },
        "1W": [{ timestamp: "2026-04-29T20:00:00.000Z", value: 210 }],
        "1M": [{ timestamp: "2026-04-29T20:00:00.000Z", value: 210 }],
      },
    },
  ],
};

function stubDatabentoFixtureFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => databentoFixture,
    })),
  );
}

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
      databentoApiKey: undefined,
      databentoExportUrl: undefined,
      massiveApiKey: "test-key",
    });
    expect(parseWebEnv({ [MASSIVE_API_KEY_ENV]: "" })).toEqual({
      databentoApiKey: undefined,
      databentoExportUrl: undefined,
      massiveApiKey: undefined,
    });
  });

  it("uses the bundled Databento fixture when no market data API key is configured", () => {
    const selection = createMarketDataProvider(parseWebEnv({ [MASSIVE_API_KEY_ENV]: "" }));

    expect(selection.configuredSource).toBe("databento");
  });

  it("reports Databento fixture status when no market data API key is configured", async () => {
    stubDatabentoFixtureFetch();
    const selection = createMarketDataProvider(parseWebEnv({ [MASSIVE_API_KEY_ENV]: "" }));

    await expect(selection.session.quote("AAPL")).resolves.toMatchObject({
      source: "databento",
      status: "primary",
      data: {
        symbol: "AAPL",
        source: "databento",
      },
    });
    vi.unstubAllGlobals();
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

  it("falls back to the bundled Databento fixture when the primary provider fails", async () => {
    stubDatabentoFixtureFetch();
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
      new DatabentoExportMarketDataProvider({ url: "/data/databento-market-data.json" }),
    );

    await expect(fallbackSession.quote("AAPL")).resolves.toMatchObject({
      source: "databento",
      status: "fallback",
      fallbackReason: "rate limited",
      data: {
        symbol: "AAPL",
        source: "databento",
      },
    });
    await expect(fallbackSession.history("AAPL", "1D")).resolves.toMatchObject({
      source: "databento",
      status: "fallback",
      data: expect.any(Array),
    });
    await expect(fallbackSession.search("AAPL")).resolves.toMatchObject({
      source: "databento",
      status: "fallback",
      data: expect.any(Array),
    });
    vi.unstubAllGlobals();
  });

  it("reports actual source, status, and fallback reason from session calls", async () => {
    stubDatabentoFixtureFetch();
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
      new DatabentoExportMarketDataProvider({ url: "/data/databento-market-data.json" }),
    );

    await expect(fallbackSession.quote("AAPL")).resolves.toMatchObject({
      source: "databento",
      status: "fallback",
      fallbackReason: "rate limited",
      data: {
        symbol: "AAPL",
        source: "databento",
      },
    });
    await expect(fallbackSession.history("AAPL", "1D")).resolves.toMatchObject({
      source: "databento",
      status: "fallback",
      fallbackReason: "rate limited",
      data: expect.any(Array),
    });
    await expect(fallbackSession.search("AAPL")).resolves.toMatchObject({
      source: "databento",
      status: "fallback",
      fallbackReason: "rate limited",
      data: [
        {
          symbol: "AAPL",
        },
      ],
    });
    vi.unstubAllGlobals();
  });

  it("keeps parallel quote and history calls on the same source after quote fallback", async () => {
    stubDatabentoFixtureFetch();
    let releaseQuoteFailure: () => void = () => undefined;
    const quoteFailure = new Promise<void>((resolve) => {
      releaseQuoteFailure = resolve;
    });
    const fallbackSession = new FallbackMarketDataSession(
      {
        source: "massive",
        search: vi.fn(async () => []),
        quote: vi.fn(async () => {
          await quoteFailure;
          throw new Error("rate limited");
        }),
        history: vi.fn(async () => [
          {
            timestamp: "2026-04-29T20:00:00.000Z",
            value: 999,
          },
        ]),
      },
      new DatabentoExportMarketDataProvider({ url: "/data/databento-market-data.json" }),
    );

    const quote = fallbackSession.quote("AAPL");
    const history = fallbackSession.history("AAPL", "1D");
    releaseQuoteFailure();

    await expect(quote).resolves.toMatchObject({
      source: "databento",
      status: "fallback",
    });
    await expect(history).resolves.toMatchObject({
      source: "databento",
      status: "fallback",
      data: [
        expect.objectContaining({
          value: 210,
        }),
      ],
    });
    vi.unstubAllGlobals();
  });
});
