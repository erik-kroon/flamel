import { QueryClient } from "@tanstack/solid-query";
import { createRoot, createSignal } from "solid-js";
import { describe, expect, it } from "vitest";

import { ProviderMarketDataSession } from "@/features/market-data/providers/fallback-market-data";
import { MockMarketDataProvider } from "@/features/market-data/providers/mock-market-data";

import { createFinancialDataWorkspace } from "../model";
import { createWatchlistQuotes } from "../watchlist-quotes";

function createMockWorkspace() {
  const provider = new MockMarketDataProvider();
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return createRoot((dispose) => ({
    dispose: () => {
      dispose();
      queryClient.clear();
    },
    workspace: createFinancialDataWorkspace(
      {
        provider,
        session: new ProviderMarketDataSession(provider, "fallback", "test fallback"),
        configuredSource: "mock",
        fallbackReason: "test fallback",
      },
      () => queryClient,
    ),
  }));
}

function settlePromises() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("createFinancialDataWorkspace", () => {
  it("exposes defaults through the compact route view model", () => {
    const { dispose, workspace } = createMockWorkspace();

    expect(workspace.watchlist.map(({ symbol, selected }) => ({ symbol, selected }))).toEqual([
      { symbol: "AAPL", selected: true },
      { symbol: "MSFT", selected: false },
      { symbol: "NVDA", selected: false },
    ]);
    expect(workspace.selectedEquity.symbol).toBe("AAPL");
    expect(workspace.sourceLabel).toBe("Offline review");
    expect(workspace.sourceDescription).toBe(
      "Track equities, inspect quote details and review recent price movement.",
    );
    expect(workspace.fallbackReason).toBe("test fallback");

    dispose();
  });

  it("loads quote data for every watchlist row", async () => {
    const { dispose, workspace } = createMockWorkspace();

    await settlePromises();

    expect(workspace.watchlist).toEqual([
      expect.objectContaining({
        symbol: "AAPL",
        quote: expect.objectContaining({ name: "Apple Inc.", lastPrice: 209.44 }),
      }),
      expect.objectContaining({
        symbol: "MSFT",
        quote: expect.objectContaining({ name: "Microsoft Corporation", lastPrice: 427.18 }),
      }),
      expect.objectContaining({
        symbol: "NVDA",
        quote: expect.objectContaining({ name: "NVIDIA Corporation", lastPrice: 118.72 }),
      }),
    ]);

    dispose();
  });

  it("normalizes symbol intake, selects new symbols, and reports duplicates", async () => {
    const { dispose, workspace } = createMockWorkspace();

    workspace.setSymbolInput(" tsla ");
    await workspace.addSymbol();

    expect(workspace.watchlist.at(-1)).toMatchObject({
      symbol: "TSLA",
      selected: true,
      quote: {
        name: "Tesla, Inc.",
        lastPrice: 182.64,
        changePercent: -1.87,
      },
    });
    expect(workspace.symbolInput).toBe("");
    expect(workspace.intakeError).toBeUndefined();

    workspace.setSymbolInput("tsla");
    await workspace.addSymbol();

    expect(workspace.watchlist.filter((item) => item.symbol === "TSLA")).toHaveLength(1);
    expect(workspace.intakeError).toBe("TSLA is already in the watchlist.");

    dispose();
  });

  it("keeps unknown symbols out of the watchlist", async () => {
    const { dispose, workspace } = createMockWorkspace();

    workspace.setSymbolInput("NOPE");
    await workspace.addSymbol();

    expect(workspace.watchlist.some((item) => item.symbol === "NOPE")).toBe(false);
    expect(workspace.intakeError).toBe("No market data found for NOPE");

    dispose();
  });
});

describe("createWatchlistQuotes", () => {
  it("loads quote data for every watchlist row", async () => {
    const provider = new MockMarketDataProvider();
    const session = new ProviderMarketDataSession(provider, "fallback", "test fallback");

    const { dispose, watchlistQuotes } = createRoot((dispose) => {
      const [symbols] = createSignal(["AAPL", "MSFT"]);

      return {
        dispose,
        watchlistQuotes: createWatchlistQuotes(symbols, session),
      };
    });

    await settlePromises();

    expect(watchlistQuotes.rows()).toEqual([
      expect.objectContaining({
        symbol: "AAPL",
        quote: expect.objectContaining({ name: "Apple Inc.", lastPrice: 209.44 }),
        status: "ready",
        source: "mock",
        sourceStatus: "fallback",
      }),
      expect.objectContaining({
        symbol: "MSFT",
        quote: expect.objectContaining({ name: "Microsoft Corporation", lastPrice: 427.18 }),
        status: "ready",
        source: "mock",
        sourceStatus: "fallback",
      }),
    ]);

    dispose();
  });
});
