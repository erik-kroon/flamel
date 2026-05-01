import { describe, expect, it, vi } from "vitest";

import type {
  EquityQuote,
  EquitySymbol,
  MarketDataSession,
  MarketDataSessionResult,
  SymbolIntakePolicy,
} from "../types";
import { evaluateSymbolIntake, tryAddSymbolToWatchlist } from "../symbol-intake-policy";

const fixtureMessage = "Symbol not included in bundled fixture universe. Available: AAPL, MSFT.";

function createPolicy(overrides: Partial<SymbolIntakePolicy> = {}): SymbolIntakePolicy {
  return {
    fixtureSymbols: ["AAPL", "MSFT"],
    unsupportedMessage: fixtureMessage,
    ...overrides,
  };
}

function createSession(): MarketDataSession {
  return {
    search: vi.fn(),
    quote: vi.fn(),
    history: vi.fn(),
  };
}

function quoteFor(symbol: EquitySymbol): EquityQuote {
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

function quoteResultFor(symbol: EquitySymbol): MarketDataSessionResult<EquityQuote> {
  return {
    data: quoteFor(symbol),
    source: "mock",
  };
}

describe("evaluateSymbolIntake", () => {
  it("accepts configured fixture symbols without provider search", async () => {
    const session = createSession();

    await expect(evaluateSymbolIntake(session, createPolicy(), " msft ")).resolves.toEqual({
      accepted: true,
      symbol: "MSFT",
    });
    expect(session.search).not.toHaveBeenCalled();
  });

  it("accepts fixture-supported ETF symbols", async () => {
    const session = createSession();

    await expect(
      evaluateSymbolIntake(session, createPolicy({ fixtureSymbols: ["AAPL", "QQQ"] }), " qqq "),
    ).resolves.toEqual({
      accepted: true,
      symbol: "QQQ",
    });
    expect(session.search).not.toHaveBeenCalled();
  });

  it("rejects non-fixture symbols without provider search", async () => {
    const session = createSession();

    await expect(evaluateSymbolIntake(session, createPolicy(), "VOO")).resolves.toEqual({
      accepted: false,
      symbol: "VOO",
      message: fixtureMessage,
    });
    expect(session.search).not.toHaveBeenCalled();
  });
});

describe("tryAddSymbolToWatchlist", () => {
  it("rejects empty input without provider search or quote loading", async () => {
    const session = createSession();
    const loadInitialQuote = vi.fn(async (symbol: EquitySymbol) => quoteResultFor(symbol));

    await expect(
      tryAddSymbolToWatchlist({
        session,
        policy: createPolicy(),
        symbolInput: "   ",
        currentSymbols: ["AAPL"],
        loadInitialQuote,
      }),
    ).resolves.toEqual({
      status: "empty",
      message: "Enter a symbol to add.",
    });
    expect(session.search).not.toHaveBeenCalled();
    expect(loadInitialQuote).not.toHaveBeenCalled();
  });

  it("accepts fixture symbols and loads the initial quote without provider search", async () => {
    const session = createSession();
    const loadInitialQuote = vi.fn(async (symbol: EquitySymbol) => quoteResultFor(symbol));

    await expect(
      tryAddSymbolToWatchlist({
        session,
        policy: createPolicy(),
        symbolInput: " msft ",
        currentSymbols: ["AAPL"],
        loadInitialQuote,
      }),
    ).resolves.toEqual({
      status: "accepted",
      symbol: "MSFT",
      quoteResult: quoteResultFor("MSFT"),
    });
    expect(session.search).not.toHaveBeenCalled();
    expect(loadInitialQuote).toHaveBeenCalledWith("MSFT");
  });

  it("selects duplicate symbols without provider search or quote loading", async () => {
    const session = createSession();
    const loadInitialQuote = vi.fn(async (symbol: EquitySymbol) => quoteResultFor(symbol));

    await expect(
      tryAddSymbolToWatchlist({
        session,
        policy: createPolicy(),
        symbolInput: " msft ",
        currentSymbols: ["AAPL", "MSFT"],
        loadInitialQuote,
      }),
    ).resolves.toEqual({
      status: "duplicate",
      symbol: "MSFT",
      message: "MSFT is already in the watchlist. Selected existing symbol.",
    });
    expect(session.search).not.toHaveBeenCalled();
    expect(loadInitialQuote).not.toHaveBeenCalled();
  });

  it("rejects unsupported symbols without quote loading", async () => {
    const session = createSession();
    const loadInitialQuote = vi.fn(async (symbol: EquitySymbol) => quoteResultFor(symbol));

    await expect(
      tryAddSymbolToWatchlist({
        session,
        policy: createPolicy(),
        symbolInput: "NOPE",
        currentSymbols: ["AAPL"],
        loadInitialQuote,
      }),
    ).resolves.toEqual({
      status: "rejected",
      symbol: "NOPE",
      message: fixtureMessage,
    });
    expect(session.search).not.toHaveBeenCalled();
    expect(loadInitialQuote).not.toHaveBeenCalled();
  });
});
