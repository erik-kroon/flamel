import { QueryClient } from "@tanstack/solid-query";
import { createRoot, createSignal } from "solid-js";
import { describe, expect, it, vi } from "vitest";

import { ProviderMarketDataSession } from "@/features/market-data/providers/session-market-data";
import { MockMarketDataProvider } from "@/features/market-data/providers/mock-market-data";
import { FIXTURE_SYMBOLS, unsupportedSymbolMessage } from "@/features/market-data/symbol-universe";
import type { EquityQuote, MarketDataSession } from "@/features/market-data/types";

import { chartAnnotationLayout, chartTooltipPosition } from "../chart-annotations";
import { createFinancialDataWorkspace, WATCHLIST_STORAGE_KEY } from "../model";
import { createWatchlistQuotes } from "../watchlist-quotes";

function createMemoryStorage(initialValues: Record<string, string> = {}) {
  const values = new Map(Object.entries(initialValues));

  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
    valueFor(key: string) {
      return values.get(key);
    },
  };
}

function createMockWorkspace(options: Parameters<typeof createFinancialDataWorkspace>[2] = {}) {
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
        session: new ProviderMarketDataSession(provider),
        configuredSource: "mock",
        symbolIntakePolicy: {
          fixtureSymbols: FIXTURE_SYMBOLS,
          unsupportedMessage: unsupportedSymbolMessage(),
        },
      },
      () => queryClient,
      options,
    ),
  }));
}

function settlePromises() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function quoteFor(symbol: string): EquityQuote {
  return {
    symbol,
    name: `${symbol} Inc.`,
    exchange: "NASDAQ",
    currency: "USD",
    lastPrice: 100,
    previousClose: 99,
    open: 99,
    high: 101,
    low: 98,
    change: 1,
    changePercent: 1.01,
    volume: 1000,
    updatedAt: "2026-04-30T20:00:00.000Z",
    source: "mock",
  };
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
    expect(workspace.intakeError).toBe(unsupportedSymbolMessage());

    dispose();
  });

  it("adds bundled fixture symbols outside the default watchlist", async () => {
    const { dispose, workspace } = createMockWorkspace();

    workspace.setSymbolInput(" voo ");
    await workspace.addSymbol();

    expect(workspace.watchlist.find((item) => item.symbol === "VOO")).toMatchObject({
      symbol: "VOO",
      selected: true,
    });
    expect(workspace.intakeError).toBeUndefined();

    dispose();
  });

  it("suggests bundled fixture symbols that are not already visible", () => {
    const { dispose, workspace } = createMockWorkspace();

    expect(workspace.symbolSuggestions.map(({ symbol, name }) => ({ symbol, name }))).toEqual([
      { symbol: "QQQ", name: "Invesco QQQ Trust" },
      { symbol: "SPY", name: "SPDR S&P 500 ETF Trust" },
      { symbol: "VOO", name: "Vanguard S&P 500 ETF" },
    ]);

    workspace.setSymbolInput("vo");

    expect(workspace.symbolSuggestions.map(({ symbol }) => symbol)).toEqual(["VOO"]);
    expect(workspace.symbolSuggestionMessage).toBeUndefined();

    dispose();
  });

  it("reports unsupported typed symbols without treating visible symbols as unsupported", () => {
    const { dispose, workspace } = createMockWorkspace();

    workspace.setSymbolInput("IBM");

    expect(workspace.symbolSuggestions).toEqual([]);
    expect(workspace.symbolSuggestionMessage).toBe("No bundled fixture for IBM");

    workspace.setSymbolInput("MSFT");

    expect(workspace.symbolSuggestions).toEqual([]);
    expect(workspace.symbolSuggestionMessage).toBeUndefined();

    dispose();
  });

  it("adds a selected suggestion without requiring the input value first", async () => {
    const { dispose, workspace } = createMockWorkspace();

    await workspace.addSymbol("QQQ");

    expect(workspace.watchlist.find((item) => item.symbol === "QQQ")).toMatchObject({
      symbol: "QQQ",
      selected: true,
    });
    expect(workspace.symbolInput).toBe("");
    expect(workspace.symbolSuggestions.map(({ symbol }) => symbol)).toEqual(["SPY", "VOO"]);

    dispose();
  });

  it("removes symbols and selects the next available row", () => {
    const { dispose, workspace } = createMockWorkspace();

    workspace.selectSymbol("MSFT");
    workspace.removeSymbol("MSFT");

    expect(workspace.watchlist.map(({ symbol }) => symbol)).toEqual([
      "AAPL",
      "AMZN",
      "GOOG",
      "META",
      "NVDA",
      "TSLA",
    ]);
    expect(workspace.selectedEquity.symbol).toBe("NVDA");
    expect(workspace.symbolSuggestions.map(({ symbol }) => symbol)).toContain("MSFT");

    dispose();
  });

  it("clears the selection when the last watchlist symbol is removed", () => {
    const storage = createMemoryStorage({
      [WATCHLIST_STORAGE_KEY]: JSON.stringify(["AAPL"]),
    });
    const { dispose, workspace } = createMockWorkspace({ watchlistStorage: storage });

    workspace.removeSymbol("AAPL");

    expect(workspace.watchlist).toEqual([]);
    expect(workspace.selectedEquity.symbol).toBeUndefined();
    expect(JSON.parse(storage.valueFor(WATCHLIST_STORAGE_KEY) ?? "[]")).toEqual([]);

    dispose();
  });

  it("restores a locally persisted watchlist", () => {
    const storage = createMemoryStorage({
      [WATCHLIST_STORAGE_KEY]: JSON.stringify(["voo", "AAPL", "voo", "", 123, "NOPE"]),
    });
    const { dispose, workspace } = createMockWorkspace({ watchlistStorage: storage });

    expect(workspace.watchlist.map(({ symbol, selected }) => ({ symbol, selected }))).toEqual([
      { symbol: "VOO", selected: true },
      { symbol: "AAPL", selected: false },
    ]);
    expect(workspace.selectedEquity.symbol).toBe("VOO");

    dispose();
  });

  it("persists accepted watchlist additions locally", async () => {
    const storage = createMemoryStorage();
    const { dispose, workspace } = createMockWorkspace({ watchlistStorage: storage });

    workspace.setSymbolInput("voo");
    await workspace.addSymbol();

    expect(JSON.parse(storage.valueFor(WATCHLIST_STORAGE_KEY) ?? "[]")).toEqual([
      "AAPL",
      "AMZN",
      "GOOG",
      "META",
      "MSFT",
      "NVDA",
      "TSLA",
      "VOO",
    ]);

    dispose();
  });

  it("uses the default watchlist when local persistence is unreadable", () => {
    const storage = createMemoryStorage({
      [WATCHLIST_STORAGE_KEY]: "{not json",
    });
    const { dispose, workspace } = createMockWorkspace({ watchlistStorage: storage });

    expect(workspace.watchlist.map(({ symbol }) => symbol)).toEqual([
      "AAPL",
      "AMZN",
      "GOOG",
      "META",
      "MSFT",
      "NVDA",
      "TSLA",
    ]);

    dispose();
  });
});

describe("chartAnnotationLayout", () => {
  it("keeps last visible when previous close is very close", () => {
    const layout = chartAnnotationLayout({
      last: 50,
      previousClose: 51,
      axis: [{ top: 6 }, { top: 23.5 }, { top: 41 }, { top: 58.5 }, { top: 76 }],
    });

    expect(layout.referenceLabelVisible.last).toBe(true);
    expect(layout.referenceLabelY.last).toBe(50);
    expect(layout.referenceLabelVisible.previousClose).toBe(true);
    expect(layout.referenceLabelY.previousClose).not.toBe(51);
  });

  it("keeps last visible when reference labels are crowded near the top", () => {
    const layout = chartAnnotationLayout({
      last: 12,
      previousClose: 14,
      axis: [{ top: 6 }, { top: 23.5 }, { top: 41 }, { top: 58.5 }, { top: 76 }],
    });

    expect(layout.referenceLabelVisible.last).toBe(true);
    expect(layout.referenceLabelVisible.previousClose).toBe(true);
    expect(layout.referenceLabelY.previousClose).not.toBe(14);
  });

  it("stacks lower-priority labels without suppressing axis labels", () => {
    const layout = chartAnnotationLayout({
      last: 50,
      previousClose: 53,
      axis: [{ top: 6 }, { top: 23.5 }, { top: 41 }, { top: 58.5 }, { top: 76 }],
    });

    expect(layout.referenceLabelVisible.last).toBe(true);
    expect(layout.referenceLabelVisible.previousClose).toBe(true);
    expect(layout.referenceLabelY.previousClose).not.toBe(53);
    expect(layout.axisLabelVisible).toEqual([true, true, true, true, true]);
  });

  it("does not reserve right-edge annotation space for the open price", () => {
    const layout = chartAnnotationLayout({
      last: 42,
      axis: [{ top: 6 }, { top: 23.5 }, { top: 41 }, { top: 58.5 }, { top: 76 }],
    });

    expect(layout.referenceLabelVisible.last).toBe(true);
    expect(layout.referenceLabelY.last).toBe(42);
    expect(layout.referenceLabelVisible).toEqual({
      last: true,
      previousClose: false,
    });
  });

  it("keeps the last label in bounds when the line endpoint is near the top", () => {
    const layout = chartAnnotationLayout({
      last: 1,
      previousClose: 76,
      axis: [{ top: 6 }, { top: 23.5 }, { top: 41 }, { top: 58.5 }, { top: 76 }],
    });

    expect(layout.referenceLabelVisible.last).toBe(true);
    expect(layout.referenceLabelY.last).toBeGreaterThanOrEqual(7);
  });

  it("keeps sparse 1M-style axis labels visible even when references are nearby", () => {
    const layout = chartAnnotationLayout({
      last: 88,
      previousClose: 28,
      axis: [{ top: 6 }, { top: 23.5 }, { top: 41 }, { top: 58.5 }, { top: 76 }],
    });

    expect(layout.referenceLabelVisible.last).toBe(true);
    expect(layout.axisLabelVisible).toHaveLength(5);
    expect(layout.axisLabelVisible).toEqual([true, true, true, true, true]);
  });

  it("handles a large negative drop without hiding the last label", () => {
    const layout = chartAnnotationLayout({
      last: 89,
      previousClose: 7,
      axis: [{ top: 6 }, { top: 23.5 }, { top: 41 }, { top: 58.5 }, { top: 76 }],
    });

    expect(layout.referenceLabelVisible.last).toBe(true);
    expect(layout.referenceLabelY.last).toBe(89);
    expect(layout.referenceLabelVisible.previousClose).toBe(true);
  });

  it("hides the last label when it would collide with the right-edge price path", () => {
    const layout = chartAnnotationLayout({
      last: 50,
      previousClose: 72,
      axis: [{ top: 6 }, { top: 23.5 }, { top: 41 }, { top: 58.5 }, { top: 76 }],
      pricePath: [
        { x: 0, y: 62 },
        { x: 74, y: 48 },
        { x: 100, y: 50 },
      ],
    });

    expect(layout.referenceLabelVisible.last).toBe(false);
    expect(layout.referenceLabelY.last).toBeUndefined();
    expect(layout.referenceLabelVisible.previousClose).toBe(true);
  });

  it("keeps the last label when the right-edge price path leaves clean vertical space", () => {
    const layout = chartAnnotationLayout({
      last: 50,
      previousClose: 72,
      axis: [{ top: 6 }, { top: 23.5 }, { top: 41 }, { top: 58.5 }, { top: 76 }],
      pricePath: [
        { x: 0, y: 62 },
        { x: 74, y: 64 },
        { x: 100, y: 66 },
      ],
    });

    expect(layout.referenceLabelVisible.last).toBe(true);
    expect(layout.referenceLabelY.last).toBe(50);
    expect(layout.referenceLabelVisible.previousClose).toBe(true);
  });
});

describe("chartTooltipPosition", () => {
  it("places edge tooltips away from the selected point", () => {
    expect(chartTooltipPosition({ x: 98, y: 8 })).toEqual({
      right: "calc(2% + 1rem)",
      top: "calc(8% + 1rem)",
    });
    expect(chartTooltipPosition({ x: 4, y: 94 })).toEqual({
      left: "calc(4% + 1rem)",
      bottom: "calc(6% + 1rem)",
    });
  });
});

describe("createWatchlistQuotes", () => {
  it("loads quote data for every watchlist row", async () => {
    const provider = new MockMarketDataProvider();
    const session = new ProviderMarketDataSession(provider);

    const { dispose, watchlistQuotes } = createRoot((dispose) => {
      const [symbols] = createSignal(["AAPL", "MSFT"]);

      return {
        dispose,
        watchlistQuotes: createWatchlistQuotes(symbols, session),
      };
    });

    await settlePromises();

    expect(watchlistQuotes.rowViewModels("AAPL")).toEqual([
      expect.objectContaining({
        symbol: "AAPL",
        quote: expect.objectContaining({ name: "Apple Inc.", lastPrice: 209.44 }),
        status: "ready",
        source: "mock",
        selected: true,
      }),
      expect.objectContaining({
        symbol: "MSFT",
        quote: expect.objectContaining({ name: "Microsoft Corporation", lastPrice: 427.18 }),
        status: "ready",
        source: "mock",
        selected: false,
      }),
    ]);

    dispose();
  });

  it("caps automatic watchlist hydration concurrency", async () => {
    const releaseQueue: Array<() => void> = [];
    let activeRequests = 0;
    let maxActiveRequests = 0;
    const session = {
      quote: vi.fn(async (symbol: string) => {
        activeRequests += 1;
        maxActiveRequests = Math.max(maxActiveRequests, activeRequests);

        await new Promise<void>((resolve) => releaseQueue.push(resolve));
        activeRequests -= 1;

        return {
          data: quoteFor(symbol),
          source: "mock",
        } as const;
      }),
    } satisfies Pick<MarketDataSession, "quote">;

    const { dispose, watchlistQuotes } = createRoot((dispose) => {
      const [symbols] = createSignal(["AAPL", "MSFT", "NVDA"]);

      return {
        dispose,
        watchlistQuotes: createWatchlistQuotes(symbols, session, {
          maxConcurrentHydration: 2,
        }),
      };
    });

    await settlePromises();

    expect(session.quote).toHaveBeenCalledTimes(2);
    expect(maxActiveRequests).toBe(2);
    expect(watchlistQuotes.rowViewModels("AAPL").map(({ status }) => status)).toEqual([
      "loading",
      "loading",
      "idle",
    ]);

    releaseQueue.shift()?.();
    await settlePromises();

    expect(session.quote).toHaveBeenCalledTimes(3);
    expect(maxActiveRequests).toBe(2);

    releaseQueue.splice(0).forEach((release) => release());
    await settlePromises();

    expect(watchlistQuotes.rowViewModels("AAPL").map(({ status }) => status)).toEqual([
      "ready",
      "ready",
      "ready",
    ]);

    dispose();
  });

  it("projects selected quote updates and added symbols through the watchlist workflow", async () => {
    const session = {
      quote: vi.fn(
        async (symbol: string) =>
          ({
            data: quoteFor(symbol),
            source: "mock",
          }) as const,
      ),
    } satisfies Pick<MarketDataSession, "quote">;

    const { dispose, watchlistQuotes, setSymbols } = createRoot((dispose) => {
      const [symbols, setSymbols] = createSignal(["AAPL"]);

      return {
        dispose,
        setSymbols,
        watchlistQuotes: createWatchlistQuotes(symbols, session),
      };
    });

    await settlePromises();

    watchlistQuotes.mergeSelectedQuoteUpdate({
      data: { ...quoteFor("AAPL"), lastPrice: 125 },
      source: "mock",
    });

    expect(watchlistQuotes.rowViewModels("AAPL")[0]).toEqual(
      expect.objectContaining({
        quote: expect.objectContaining({ lastPrice: 125 }),
        status: "ready",
        selected: true,
      }),
    );

    const result = await watchlistQuotes.addVerifiedSymbol("MSFT");
    setSymbols((symbols) => [...symbols, result.data.symbol]);
    await settlePromises();

    expect(session.quote).toHaveBeenCalledWith("MSFT");
    expect(watchlistQuotes.rowViewModels("MSFT")).toEqual([
      expect.objectContaining({ symbol: "AAPL", selected: false }),
      expect.objectContaining({
        symbol: "MSFT",
        quote: expect.objectContaining({ name: "MSFT Inc." }),
        status: "ready",
        selected: true,
      }),
    ]);

    dispose();
  });
});
