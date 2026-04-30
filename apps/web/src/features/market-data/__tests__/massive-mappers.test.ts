import { describe, expect, it } from "vitest";

import {
  massiveAggregatesFixture,
  massiveSearchFixture,
  massiveSnapshotFixture,
  massiveTickerFixture,
} from "../fixtures/massive";
import {
  mapMassiveAggregates,
  mapMassiveQuote,
  mapMassiveTickerSearch,
} from "../providers/massive-mappers";

describe("Massive mapper functions", () => {
  it("maps ticker search results into app-owned search results", () => {
    expect(mapMassiveTickerSearch(massiveSearchFixture)).toEqual([
      {
        symbol: "AAPL",
        name: "Apple Inc.",
        exchange: "NASDAQ",
        currency: "USD",
      },
      {
        symbol: "MSFT",
        name: "Microsoft Corporation",
        exchange: "NASDAQ",
        currency: "USD",
      },
    ]);
  });

  it("maps snapshot and ticker data into the app quote model", () => {
    expect(mapMassiveQuote(massiveTickerFixture, massiveSnapshotFixture)).toEqual({
      symbol: "AAPL",
      name: "Apple Inc.",
      exchange: "NASDAQ",
      currency: "USD",
      lastPrice: 209.44,
      previousClose: 207.31,
      open: 208.12,
      high: 211.88,
      low: 206.95,
      change: 2.13,
      changePercent: 1.03,
      volume: 48_102_344,
      marketCap: 3_210_000_000_000,
      updatedAt: "2026-04-30T12:00:00.000Z",
      source: "massive",
    });
  });

  it("maps aggregate bars into sorted price points", () => {
    expect(mapMassiveAggregates(massiveAggregatesFixture)).toEqual([
      {
        timestamp: "2026-04-29T12:00:00.000Z",
        value: 207.31,
      },
      {
        timestamp: "2026-04-30T00:00:00.000Z",
        value: 208.88,
      },
      {
        timestamp: "2026-04-30T12:00:00.000Z",
        value: 209.44,
      },
    ]);
  });
});
