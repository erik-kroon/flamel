import { describe, expect, it, vi } from "vitest";

import { createMarketDataSession } from "../providers/provider-factory";
import { DatabentoExportMarketDataProvider } from "../providers/databento-market-data";
import {
  aggregateDatabentoFixtureBars,
  mapDatabentoFixtureHistory,
  parseDatabentoFixtureFile,
  parseDatabentoOhlcvBar,
} from "../databento-fixture";

describe("Databento fixture market data", () => {
  it("normalizes raw Databento OHLCV records through the fixture parser", () => {
    expect(
      parseDatabentoOhlcvBar({
        hd: { ts_event: "2026-04-29T20:00:00.000000000Z" },
        open: "207.515",
        high: "211.004",
        low: "206.499",
        close: "210.001",
        volume: "1200",
        symbol: "AAPL",
      }),
    ).toEqual({
      symbol: "AAPL",
      bar: {
        timestamp: "2026-04-29T20:00:00.000Z",
        open: 207.51,
        high: 211,
        low: 206.5,
        close: 210,
        volume: 1200,
      },
    });
  });

  it("aggregates Databento fixture bars without losing OHLCV semantics", () => {
    expect(
      aggregateDatabentoFixtureBars(
        [
          {
            timestamp: "2026-04-29T20:00:00.000Z",
            open: 100,
            high: 102,
            low: 99,
            close: 101,
            volume: 10,
          },
          {
            timestamp: "2026-04-29T20:01:00.000Z",
            open: 101,
            high: 105,
            low: 100,
            close: 104,
            volume: 15,
          },
        ],
        5 * 60 * 1000,
      ),
    ).toEqual([
      {
        timestamp: "2026-04-29T20:00:00.000Z",
        open: 100,
        high: 105,
        low: 99,
        close: 104,
        volume: 25,
      },
    ]);
  });

  it("parses and maps the compact Databento fixture schema", () => {
    const fixture = parseDatabentoFixtureFile({
      source: "databento",
      dataset: "XNAS.ITCH",
      schema: "app-chart-fixture-v1",
      requestId: "test",
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
    });

    expect(mapDatabentoFixtureHistory(fixture.equities[0]?.history["1D"])).toEqual([
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
    expect(() =>
      parseDatabentoFixtureFile({
        source: "databento",
        dataset: "XNAS.ITCH",
        schema: "app-chart-fixture-v1",
        requestId: "test",
        equities: [],
      }),
    ).not.toThrow();
    expect(() => parseDatabentoFixtureFile({ source: "mock", equities: [] })).toThrow(
      "Databento fixture source must be databento.",
    );
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

  it("keeps the startup watchlist separate from the full fixture intake universe", () => {
    const selection = createMarketDataSession();

    expect(selection.symbolIntakePolicy.fixtureSymbols).toEqual([
      "AAPL",
      "AMZN",
      "GOOG",
      "META",
      "MSFT",
      "NVDA",
      "QQQ",
      "SPY",
      "TSLA",
      "VOO",
    ]);
    expect(selection.symbolIntakePolicy.unsupportedMessage).toContain("QQQ");
    expect(selection.symbolIntakePolicy.unsupportedMessage).toContain("SPY");
    expect(selection.symbolIntakePolicy.unsupportedMessage).toContain("VOO");
  });

  it("always selects the bundled Databento fixture provider", () => {
    expect(createMarketDataSession().configuredSource).toBe("databento");
  });
});
