import { describe, expect, it, vi } from "vitest";
import { parseWebEnv } from "@flamel/env/web";

import {
  createMarketDataProvider,
  DATABENTO_API_KEY_ENV,
  DATABENTO_EXPORT_URL_ENV,
} from "../providers/provider-factory";
import {
  DatabentoExportMarketDataProvider,
  DatabentoMarketDataProvider,
  mapDatabentoHistory,
  mapDatabentoQuote,
  planDatabentoHistoryRequest,
  planDatabentoQuoteRequest,
  type DatabentoHistoricalClient,
  type DatabentoOhlcvRecord,
} from "../providers/databento-market-data";

const records: DatabentoOhlcvRecord[] = [
  {
    hd: { ts_event: "2026-04-28T20:00:00.000000000Z" },
    open: "205.00",
    high: "208.00",
    low: "204.00",
    close: "207.00",
    volume: "1000",
    symbol: "AAPL",
  },
  {
    hd: { ts_event: "2026-04-29T20:00:00.000000000Z" },
    open: "207.50",
    high: "211.00",
    low: "206.50",
    close: "210.00",
    volume: "1200",
    symbol: "AAPL",
  },
];

function createClient(): DatabentoHistoricalClient {
  return {
    getRange: vi.fn(async () => records),
  };
}

describe("DatabentoMarketDataProvider", () => {
  it("plans historical requests for Databento HTTP timeseries", () => {
    const today = new Date("2026-04-30T12:00:00.000Z");

    expect(planDatabentoHistoryRequest("aapl", "1D", today)).toEqual({
      dataset: "XNAS.ITCH",
      symbols: "AAPL",
      schema: "ohlcv-1m",
      start: "2026-04-29T12:00:00.000Z",
      end: "2026-04-30T12:00:00.000Z",
      stype_in: "raw_symbol",
      stype_out: "raw_symbol",
      encoding: "json",
      compression: "none",
      pretty_px: "true",
      pretty_ts: "true",
      map_symbols: "true",
      limit: 390,
    });
    expect(planDatabentoHistoryRequest("aapl", "1W", today)).toMatchObject({
      schema: "ohlcv-1m",
      start: "2026-04-23T12:00:00.000Z",
      limit: 2200,
    });
    expect(planDatabentoQuoteRequest("aapl", today)).toMatchObject({
      schema: "ohlcv-1m",
      start: "2026-04-20T12:00:00.000Z",
      limit: 2,
    });
  });

  it("maps Databento OHLCV records into app quote and history models", () => {
    expect(mapDatabentoHistory(records)).toEqual([
      {
        timestamp: "2026-04-28T20:00:00.000Z",
        value: 207,
        open: 205,
        high: 208,
        low: 204,
        close: 207,
        volume: 1000,
      },
      {
        timestamp: "2026-04-29T20:00:00.000Z",
        value: 210,
        open: 207.5,
        high: 211,
        low: 206.5,
        close: 210,
        volume: 1200,
      },
    ]);
    expect(mapDatabentoHistory(records, "1W")).toEqual([
      {
        timestamp: "2026-04-28T20:00:00.000Z",
        value: 207,
        open: 205,
        high: 208,
        low: 204,
        close: 207,
        volume: 1000,
      },
      {
        timestamp: "2026-04-29T20:00:00.000Z",
        value: 210,
        open: 207.5,
        high: 211,
        low: 206.5,
        close: 210,
        volume: 1200,
      },
    ]);
    expect(mapDatabentoQuote("aapl", records)).toMatchObject({
      symbol: "AAPL",
      name: "Apple Inc.",
      lastPrice: 210,
      previousClose: 207,
      change: 3,
      source: "databento",
      updatedAt: "2026-04-29T20:00:00.000Z",
    });
  });

  it("loads and caches quotes and history through the Databento client", async () => {
    const client = createClient();
    const provider = new DatabentoMarketDataProvider({
      client,
      today: new Date("2026-04-30T12:00:00.000Z"),
    });

    const firstQuote = await provider.quote("aapl");
    const secondQuote = await provider.quote("AAPL");
    const firstHistory = await provider.history("aapl", "1W");
    const secondHistory = await provider.history("AAPL", "1W");

    expect(firstQuote).toBe(secondQuote);
    expect(firstHistory).toBe(secondHistory);
    expect(client.getRange).toHaveBeenCalledTimes(2);
  });

  it("loads quote, history, and search data from the compact Databento export", async () => {
    const provider = new DatabentoExportMarketDataProvider({ url: "/databento-export.json" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          source: "databento",
          dataset: "XNAS.ITCH",
          schema: "ohlcv-1s",
          requestId: "XNAS-20260430-FSYTDGY7D4",
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
                "1D": [{ timestamp: "2026-04-29T20:00:00.000Z", value: 210 }],
                "1W": [{ timestamp: "2026-04-29T20:00:00.000Z", value: 210 }],
                "1M": [{ timestamp: "2026-04-29T20:00:00.000Z", value: 210 }],
              },
            },
          ],
        }),
      })),
    );

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
      lastPrice: 210,
      previousClose: 207,
      source: "databento",
    });
    await expect(provider.history("AAPL", "1D")).resolves.toEqual([
      { timestamp: "2026-04-29T20:00:00.000Z", value: 210 },
    ]);
    await expect(provider.quote("AAPL")).resolves.toBe(await provider.quote("aapl"));
    await expect(provider.history("AAPL", "1D")).resolves.toBe(
      await provider.history("aapl", "1D"),
    );
    expect(fetch).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });

  it("selects Databento before Massive when a Databento key is configured", () => {
    const selection = createMarketDataProvider(
      parseWebEnv({
        [DATABENTO_API_KEY_ENV]: "test-key",
      }),
    );

    expect(selection.configuredSource).toBe("databento");
  });

  it("selects a Databento export before hosted providers when configured", () => {
    const selection = createMarketDataProvider(
      parseWebEnv({
        [DATABENTO_EXPORT_URL_ENV]: "/data/databento-export.json",
        [DATABENTO_API_KEY_ENV]: "test-key",
      }),
    );

    expect(selection.configuredSource).toBe("databento");
  });
});
