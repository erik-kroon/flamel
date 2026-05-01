import { describe, expect, it } from "vitest";

import {
  isRegularSession,
  marketDateKey,
  marketReferencePercent,
  marketSessionBandReferences,
  marketSessionLabel,
  marketSessionState,
  rangeSessionLabel,
  REGULAR_SESSION_OPEN_MINUTES,
} from "../market-session";

describe("market session utilities", () => {
  it("derives ET date keys across UTC day boundaries", () => {
    expect(marketDateKey("2026-05-01T01:30:00.000Z")).toBe("2026-04-30");
    expect(marketDateKey("2026-05-01T14:00:00.000Z")).toBe("2026-05-01");
  });

  it("classifies market session edges in Eastern Time", () => {
    expect(marketSessionState("2026-04-30T07:59:00.000Z")).toBe("closed");
    expect(marketSessionState("2026-04-30T08:00:00.000Z")).toBe("pre-market");
    expect(marketSessionState("2026-04-30T13:30:00.000Z")).toBe("regular");
    expect(marketSessionState("2026-04-30T20:00:00.000Z")).toBe("after-hours");
    expect(marketSessionState("2026-05-01T00:00:00.000Z")).toBe("closed");
  });

  it("uses the same session labels for UI callers", () => {
    expect(marketSessionLabel()).toBe("Session pending");
    expect(marketSessionLabel("2026-04-30T08:00:00.000Z")).toBe("Pre-market");
    expect(marketSessionLabel("2026-04-30T13:30:00.000Z")).toBe("Market open");
    expect(marketSessionLabel("2026-04-30T20:00:00.000Z")).toBe("After-hours");
    expect(marketSessionLabel("2026-05-01T00:00:00.000Z")).toBe("Closed");
  });

  it("centralizes regular-session checks for fixture generation", () => {
    expect(isRegularSession("2026-04-30T13:29:00.000Z")).toBe(false);
    expect(isRegularSession("2026-04-30T13:30:00.000Z")).toBe(true);
    expect(isRegularSession("2026-04-30T19:59:00.000Z")).toBe(true);
    expect(isRegularSession("2026-04-30T20:00:00.000Z")).toBe(false);
  });

  it("calculates 1D chart open and close references from plotted ET timestamps", () => {
    const points = [
      { timestamp: "2026-04-30T08:00:00.000Z", x: 0 },
      { timestamp: "2026-04-30T14:00:00.000Z", x: 50 },
      { timestamp: "2026-05-01T00:00:00.000Z", x: 100 },
    ];

    expect(marketReferencePercent(points, "1D", REGULAR_SESSION_OPEN_MINUTES)).toBeCloseTo(34.375);
    expect(marketSessionBandReferences(points, "1D")).toMatchObject({
      openX: 34.375,
      closeX: 75,
      preMarketBand: { left: 0, width: 34.375 },
      afterHoursBand: { left: 75, width: 25 },
    });
    expect(marketSessionBandReferences(points, "1W")).toEqual({
      openX: undefined,
      closeX: undefined,
      preMarketBand: undefined,
      afterHoursBand: undefined,
    });
  });

  it("keeps range session labels behind the market-session interface", () => {
    expect(rangeSessionLabel("1D")).toBe("Extended hours");
    expect(rangeSessionLabel("1W")).toBe("Regular session");
    expect(rangeSessionLabel("1M")).toBe("Regular session");
  });
});
