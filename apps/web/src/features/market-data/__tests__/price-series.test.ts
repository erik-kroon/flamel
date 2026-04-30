import { describe, expect, it } from "vitest";

import {
  appendPricePoint,
  getPriceSeriesMetadata,
  normalizePriceSeriesForSvg,
  priceSeriesToSvgPath,
  sortPriceSeries,
} from "../price-series";
import type { PricePoint } from "../types";

const unsortedPoints: PricePoint[] = [
  { timestamp: "2026-04-30T12:00:00.000Z", value: 102 },
  { timestamp: "2026-04-30T10:00:00.000Z", value: 100 },
  { timestamp: "2026-04-30T11:00:00.000Z", value: 104 },
];

describe("price series utilities", () => {
  it("sorts price points by timestamp without mutating the input", () => {
    expect(sortPriceSeries(unsortedPoints)).toEqual([
      { timestamp: "2026-04-30T10:00:00.000Z", value: 100 },
      { timestamp: "2026-04-30T11:00:00.000Z", value: 104 },
      { timestamp: "2026-04-30T12:00:00.000Z", value: 102 },
    ]);
    expect(unsortedPoints[0]?.timestamp).toBe("2026-04-30T12:00:00.000Z");
  });

  it("returns empty-series metadata without min or max", () => {
    expect(getPriceSeriesMetadata([], "1D")).toEqual({
      range: "1D",
      count: 0,
      empty: true,
    });
  });

  it("returns sorted range metadata for non-empty series", () => {
    expect(getPriceSeriesMetadata(unsortedPoints, "1D")).toEqual({
      range: "1D",
      count: 3,
      empty: false,
      min: 100,
      max: 104,
      first: { timestamp: "2026-04-30T10:00:00.000Z", value: 100 },
      last: { timestamp: "2026-04-30T12:00:00.000Z", value: 102 },
    });
  });

  it("appends points in timestamp order and keeps the newest bounded window", () => {
    expect(
      appendPricePoint(
        unsortedPoints,
        { timestamp: "2026-04-30T13:00:00.000Z", value: 105 },
        2,
      ),
    ).toEqual([
      { timestamp: "2026-04-30T12:00:00.000Z", value: 102 },
      { timestamp: "2026-04-30T13:00:00.000Z", value: 105 },
    ]);
  });

  it("normalizes price points into SVG coordinates with stable empty handling", () => {
    expect(normalizePriceSeriesForSvg([])).toEqual([]);
    expect(normalizePriceSeriesForSvg([unsortedPoints[0]!])).toEqual([]);
    expect(normalizePriceSeriesForSvg(unsortedPoints)).toEqual([
      {
        timestamp: "2026-04-30T10:00:00.000Z",
        value: 100,
        x: 0,
        y: 48,
      },
      {
        timestamp: "2026-04-30T11:00:00.000Z",
        value: 104,
        x: 50,
        y: 4,
      },
      {
        timestamp: "2026-04-30T12:00:00.000Z",
        value: 102,
        x: 100,
        y: 26,
      },
    ]);
  });

  it("creates the same SVG path contract expected by chart renderers", () => {
    expect(priceSeriesToSvgPath(unsortedPoints)).toBe("M 0.00 48.00 L 50.00 4.00 L 100.00 26.00");
    expect(priceSeriesToSvgPath([])).toBe("");
  });
});
