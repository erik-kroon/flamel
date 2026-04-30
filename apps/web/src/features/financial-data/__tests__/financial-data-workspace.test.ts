import { QueryClient } from "@tanstack/solid-query";
import { createRoot, createSignal } from "solid-js";
import { describe, expect, it } from "vitest";

import { ProviderMarketDataSession } from "@/features/market-data/providers/fallback-market-data";
import { MockMarketDataProvider } from "@/features/market-data/providers/mock-market-data";

import { chartAnnotationLayout } from "../chart-annotations";
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
        session: new ProviderMarketDataSession(provider, "fallback", "test fallback"),
        configuredSource: "mock",
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
      { symbol: "AMZN", selected: false },
      { symbol: "GOOG", selected: false },
      { symbol: "META", selected: false },
      { symbol: "MSFT", selected: false },
      { symbol: "NVDA", selected: false },
      { symbol: "TSLA", selected: false },
    ]);
    expect(workspace.selectedEquity.symbol).toBe("AAPL");
    expect(workspace.fallbackReason).toBeUndefined();

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
        symbol: "AMZN",
        quote: expect.objectContaining({ name: "Amazon.com, Inc.", lastPrice: 186.11 }),
      }),
      expect.objectContaining({
        symbol: "GOOG",
        quote: expect.objectContaining({ name: "Alphabet Inc.", lastPrice: 371.99 }),
      }),
      expect.objectContaining({
        symbol: "META",
        quote: expect.objectContaining({ name: "Meta Platforms, Inc.", lastPrice: 531.28 }),
      }),
      expect.objectContaining({
        symbol: "MSFT",
        quote: expect.objectContaining({ name: "Microsoft Corporation", lastPrice: 427.18 }),
      }),
      expect.objectContaining({
        symbol: "NVDA",
        quote: expect.objectContaining({ name: "NVIDIA Corporation", lastPrice: 118.72 }),
      }),
      expect.objectContaining({
        symbol: "TSLA",
        quote: expect.objectContaining({ name: "Tesla, Inc.", lastPrice: 182.64 }),
      }),
    ]);

    dispose();
  });

  it("normalizes symbol intake, selects existing fixture symbols, and reports duplicates", async () => {
    const { dispose, workspace } = createMockWorkspace();

    workspace.selectSymbol("AAPL");
    workspace.setSymbolInput(" msft ");
    await workspace.addSymbol();

    expect(workspace.watchlist.find((item) => item.symbol === "MSFT")).toMatchObject({
      symbol: "MSFT",
      selected: true,
    });
    expect(workspace.symbolInput).toBe("");
    expect(workspace.watchlist.filter((item) => item.symbol === "MSFT")).toHaveLength(1);
    expect(workspace.intakeError).toBe(
      "MSFT is already in the watchlist. Selected existing symbol.",
    );

    dispose();
  });

  it("keeps unknown symbols out of the watchlist", async () => {
    const { dispose, workspace } = createMockWorkspace();

    workspace.setSymbolInput("NOPE");
    await workspace.addSymbol();

    expect(workspace.watchlist.some((item) => item.symbol === "NOPE")).toBe(false);
    expect(workspace.intakeError).toBe(
      "Symbol not included in bundled fixture universe. Available: AAPL, AMZN, GOOG, META, MSFT, NVDA, TSLA.",
    );

    dispose();
  });
});

describe("chartAnnotationLayout", () => {
  it("keeps last visible and hides open when reference labels are crowded", () => {
    const layout = chartAnnotationLayout({
      last: 12,
      open: 13.5,
      previousClose: 54,
      axis: [{ top: 6 }, { top: 23.5 }, { top: 41 }, { top: 58.5 }, { top: 76 }],
    });

    expect(layout.referenceLabelVisible.last).toBe(true);
    expect(layout.referenceLabelVisible.previousClose).toBe(true);
    expect(layout.referenceLabelVisible.open).toBe(false);
    expect(layout.referenceLabelY.previousClose).toBe(54);
  });

  it("stacks lower-priority labels before hiding them and suppresses colliding axis labels", () => {
    const layout = chartAnnotationLayout({
      last: 50,
      previousClose: 53,
      open: 68,
      axis: [{ top: 6 }, { top: 23.5 }, { top: 41 }, { top: 58.5 }, { top: 76 }],
    });

    expect(layout.referenceLabelVisible.last).toBe(true);
    expect(layout.referenceLabelVisible.previousClose).toBe(true);
    expect(layout.referenceLabelY.previousClose).not.toBe(53);
    expect(layout.axisLabelVisible).toEqual([true, true, true, false, true]);
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
