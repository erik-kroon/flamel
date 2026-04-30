import { describe, expect, it } from "vitest";

import {
  analyzePriceSeries,
  appendPricePoint,
  getPriceSeriesMetadata,
  getPaddedPriceDomain,
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

  it("analyzes sorted points and metadata in one pass", () => {
    expect(analyzePriceSeries(unsortedPoints, "1D")).toEqual({
      sorted: [
        { timestamp: "2026-04-30T10:00:00.000Z", value: 100 },
        { timestamp: "2026-04-30T11:00:00.000Z", value: 104 },
        { timestamp: "2026-04-30T12:00:00.000Z", value: 102 },
      ],
      metadata: {
        range: "1D",
        count: 3,
        empty: false,
        min: 100,
        max: 104,
        first: { timestamp: "2026-04-30T10:00:00.000Z", value: 100 },
        last: { timestamp: "2026-04-30T12:00:00.000Z", value: 102 },
      },
    });
  });

  it("pads the chart domain around bar extremes and price references", () => {
    expect(
      getPaddedPriceDomain(
        [
          {
            timestamp: "2026-04-30T10:00:00.000Z",
            value: 102,
            open: 101,
            high: 110,
            low: 100,
            close: 102,
          },
          {
            timestamp: "2026-04-30T11:00:00.000Z",
            value: 108,
            open: 102,
            high: 112,
            low: 101,
            close: 108,
          },
        ],
        { previousClose: 99, open: 101, last: 112 },
      ),
    ).toMatchObject({
      visibleMin: 99,
      visibleMax: 112,
      padding: 1.56,
      min: 97.44,
      max: 113.56,
      spread: 16.120000000000005,
    });
  });

  it("keeps a minimum dollar cushion for very tight chart ranges", () => {
    const domain = getPaddedPriceDomain(
      [
        { timestamp: "2026-04-30T10:00:00.000Z", value: 371.98, high: 372, low: 371.95 },
        { timestamp: "2026-04-30T11:00:00.000Z", value: 371.99, high: 372.01, low: 371.97 },
      ],
      { previousClose: 371.96, open: 371.97, last: 371.99 },
    );

    expect(domain.visibleMin).toBe(371.95);
    expect(domain.visibleMax).toBe(372.01);
    expect(domain.padding).toBeCloseTo(0.37198, 5);
    expect(domain.min).toBeLessThan(domain.visibleMin);
    expect(domain.max).toBeGreaterThan(domain.visibleMax);
  });

  it("appends points in timestamp order and keeps the newest bounded window", () => {
    expect(
      appendPricePoint(unsortedPoints, { timestamp: "2026-04-30T13:00:00.000Z", value: 105 }, 2),
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
