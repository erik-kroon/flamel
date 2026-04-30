import { describe, expect, it } from "vitest";

import { MarketDataNotFoundError } from "../types";
import { DEFAULT_SYMBOLS } from "../symbol-universe";
import { MockMarketDataProvider, SUPPORTED_MOCK_SYMBOLS } from "../providers/mock-market-data";

describe("MockMarketDataProvider", () => {
  const provider = new MockMarketDataProvider();

  it("supports the required mock symbol universe and defaults", () => {
    expect(SUPPORTED_MOCK_SYMBOLS).toEqual([
      "AAPL",
      "AMZN",
      "GOOG",
      "META",
      "MSFT",
      "NFLX",
      "NVDA",
      "QQQ",
      "SPY",
      "TSLA",
      "ERIC-B.ST",
      "VOO",
      "VOLV-B.ST",
    ]);
    expect(DEFAULT_SYMBOLS).toEqual(["AAPL", "AMZN", "GOOG", "META", "MSFT", "NVDA", "TSLA"]);
  });

  it("returns deterministic quotes for known symbols", async () => {
    const quote = await provider.quote("aapl");

    expect(quote).toMatchObject({
      symbol: "AAPL",
      name: "Apple Inc.",
      source: "mock",
      lastPrice: 209.44,
      previousClose: 207.31,
      change: 2.13,
      changePercent: 1.03,
    });
  });

  it("fails unknown symbols through a predictable not-found path", async () => {
    await expect(provider.quote("NOPE")).rejects.toBeInstanceOf(MarketDataNotFoundError);
  });

  it("returns sorted history for every supported range", async () => {
    for (const range of ["1D", "1W", "1M"] as const) {
      const history = await provider.history("MSFT", range);
      const timestamps = history.map((point) => Date.parse(point.timestamp));

      expect(history.length).toBeGreaterThan(0);
      expect(timestamps).toEqual([...timestamps].sort((a, b) => a - b));
      expect(history.at(-1)?.value).toBeTypeOf("number");
    }
  });

  it("searches by symbol or company name", async () => {
    await expect(provider.search("volv")).resolves.toEqual([
      {
        symbol: "VOLV-B.ST",
        name: "Volvo AB",
        exchange: "NASDAQ Stockholm",
        currency: "SEK",
      },
    ]);
  });
});
