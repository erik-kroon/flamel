import { describe, expect, it } from "vitest";

import {
  assertSupportedSymbol,
  hasSymbolInput,
  includesSymbol,
  normalizeSymbol,
  validateSupportedSymbol,
} from "../symbols";
import { MarketDataNotFoundError } from "../types";

const supportedSymbols = ["AAPL", "MSFT", "ERIC-B.ST"] as const;

describe("symbol helpers", () => {
  it("normalizes symbols by trimming and uppercasing", () => {
    expect(normalizeSymbol(" eric-b.st ")).toBe("ERIC-B.ST");
    expect(normalizeSymbol(" aapl ")).toBe("AAPL");
  });

  it("detects empty symbol input after normalization", () => {
    expect(hasSymbolInput("   ")).toBe(false);
    expect(hasSymbolInput(" msft ")).toBe(true);
  });

  it("checks duplicates using normalized symbols", () => {
    expect(includesSymbol(["AAPL", "ERIC-B.ST"], " eric-b.st ")).toBe(true);
    expect(includesSymbol(["AAPL"], "MSFT")).toBe(false);
  });

  it("validates supported symbols using one normalized rule", () => {
    expect(assertSupportedSymbol(" eric-b.st ", supportedSymbols)).toBe("ERIC-B.ST");
    expect(() => assertSupportedSymbol(" nope ", supportedSymbols)).toThrow(MarketDataNotFoundError);
  });

  it("returns structured validation results for UI callers", () => {
    expect(validateSupportedSymbol(" aapl ", supportedSymbols)).toEqual({
      symbol: "AAPL",
      valid: true,
    });
    expect(validateSupportedSymbol(" nope ", supportedSymbols)).toMatchObject({
      symbol: "NOPE",
      valid: false,
      reason: "No market data found for NOPE",
    });
  });
});
