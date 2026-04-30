import { describe, expect, it } from "vitest";

import {
  formatCompactNumber,
  formatMarketAxisPrice,
  formatMarketChartTime,
  formatMarketTimestamp,
  formatMoney,
  formatSignedPercent,
} from "../formatting";

describe("market display formatting", () => {
  it("formats money with a stable market display currency fallback", () => {
    expect(formatMoney(209.44)).toBe("$209.44");
    expect(formatMoney(86.3, "EUR")).toBe("€86.30");
  });

  it("formats optional compact numbers for quote details", () => {
    expect(formatCompactNumber(48_102_344)).toBe("48.1M");
    expect(formatCompactNumber(undefined)).toBe("n/a");
  });

  it("formats signed percentages with explicit positive signs", () => {
    expect(formatSignedPercent(1.03)).toBe("+1.03%");
    expect(formatSignedPercent(0)).toBe("+0.00%");
    expect(formatSignedPercent(-2.5)).toBe("-2.50%");
  });

  it("formats optional timestamps for market status surfaces", () => {
    expect(formatMarketTimestamp("2026-04-30T12:00:00.000Z")).toMatch(/Apr 30/);
    expect(formatMarketTimestamp(undefined)).toBe("Pending");
  });

  it("formats chart labels without rendering the chart", () => {
    expect(formatMarketAxisPrice(209.44)).toBe("$209");
    expect(formatMarketAxisPrice(86.3, "EUR")).toBe("€86.30");
    expect(formatMarketChartTime("2026-04-30T12:00:00.000Z", "1D")).toMatch(/\d{2}:00/);
    expect(formatMarketChartTime("2026-04-30T12:00:00.000Z", "1M")).toMatch(/Apr 30/);
  });
});
