import { describe, expect, it } from "vitest";

import {
  applySimulatedTick,
  calculateQuoteChange,
  isQuoteStale,
  resolveQuoteChange,
} from "../finance-calculations";
import type { EquityQuote } from "../types";

const baseQuote: EquityQuote = {
  symbol: "AAPL",
  name: "Apple Inc.",
  exchange: "NASDAQ",
  currency: "USD",
  lastPrice: 100,
  previousClose: 98,
  open: 99,
  high: 101,
  low: 97,
  change: 2,
  changePercent: 2.04,
  volume: 1000,
  updatedAt: "2026-04-30T12:00:00.000Z",
  source: "mock",
};

describe("finance calculations", () => {
  it("calculates rounded quote change and change percent", () => {
    expect(
      calculateQuoteChange({
        lastPrice: 209.44,
        previousClose: 207.31,
      }),
    ).toEqual({
      change: 2.13,
      changePercent: 1.03,
    });
  });

  it("uses zero percent change when previous close is zero", () => {
    expect(
      calculateQuoteChange({
        lastPrice: 10,
        previousClose: 0,
      }),
    ).toEqual({
      change: 10,
      changePercent: 0,
    });
  });

  it("resolves partial provider-supplied change fields through the same rounding rules", () => {
    expect(
      resolveQuoteChange({
        lastPrice: 105,
        previousClose: 100,
        change: 4.5,
      }),
    ).toEqual({
      change: 4.5,
      changePercent: 4.5,
    });
  });

  it("applies bounded simulated ticks and recalculates high, low, and change", () => {
    expect(
      applySimulatedTick({
        quote: baseQuote,
        movementPercent: 5,
        maxMovementPercent: 1,
        updatedAt: "2026-04-30T12:01:00.000Z",
      }),
    ).toMatchObject({
      lastPrice: 101,
      high: 101,
      low: 97,
      change: 3,
      changePercent: 3.06,
      updatedAt: "2026-04-30T12:01:00.000Z",
    });
  });

  it("detects stale and invalid quote timestamps", () => {
    const now = new Date("2026-04-30T12:01:01.000Z");

    expect(isQuoteStale("2026-04-30T12:00:00.000Z", now, 60_000)).toBe(true);
    expect(isQuoteStale("2026-04-30T12:00:30.000Z", now, 60_000)).toBe(false);
    expect(isQuoteStale("not a date", now, 60_000)).toBe(true);
  });
});
