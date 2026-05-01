import { describe, expect, it } from "vitest";

import { createPriceHistoryDisplayLabels } from "../display-labels";
import { createPriceHistoryViewModel } from "../price-history-view-model";

describe("createPriceHistoryViewModel", () => {
  it("builds chart geometry, labels, volume bars, and range metrics without JSX", () => {
    const chart = createPriceHistoryViewModel({
      points: [
        {
          timestamp: "2026-04-30T12:00:00.000Z",
          value: 101,
          open: 100,
          high: 102,
          low: 99,
          close: 101,
          volume: 100,
        },
        {
          timestamp: "2026-04-30T14:00:00.000Z",
          value: 104,
          open: 101,
          high: 105,
          low: 100,
          close: 104,
          volume: 400,
        },
        {
          timestamp: "2026-04-30T20:00:00.000Z",
          value: 103,
          open: 104,
          high: 106,
          low: 102,
          close: 103,
          volume: 900,
        },
      ],
      quote: {
        symbol: "AAPL",
        name: "Apple Inc.",
        exchange: "NASDAQ",
        currency: "USD",
        lastPrice: 103,
        previousClose: 100,
        open: 101,
        high: 106,
        low: 99,
        change: 3,
        changePercent: 3,
        volume: 1400,
        updatedAt: "2026-04-30T20:00:00.000Z",
        source: "databento",
      },
      range: "1D",
      source: "databento",
    });

    expect(chart.metadata.count).toBe(3);
    expect(chart.normalized.map(({ x, value }) => ({ x, value }))).toEqual([
      { x: 0, value: 101 },
      { x: 50, value: 104 },
      { x: 100, value: 103 },
    ]);
    expect(chart.path).toMatch(/^M 0\.00 \d+\.\d{2} L 50\.00 \d+\.\d{2} L 100\.00 \d+\.\d{2}$/);
    expect(chart.axis.map(({ value }) => value)).toEqual([106, 104, 102, 100, 98]);
    expect(chart.axisPrecision).toBe(0);
    expect(chart.volumeBars).toHaveLength(3);
    expect(chart.rangeMove).toBeCloseTo(1.980198);
    expect(chart.rangeHigh).toBe(104);
    expect(chart.rangeLow).toBe(101);
    expect(chart.rangeVolume).toBe(1400);
    expect(chart.hasVolume).toBe(true);
    expect(chart.openX).toBeDefined();
    expect(chart.closeX).toBeDefined();
    expect(chart.nearestPointIndex(60)).toBe(1);
    expect(chart.returnVsPreviousClose({ value: 104 })).toBe(4);
  });

  it("projects display copy from chart state", () => {
    const chart = createPriceHistoryViewModel({
      points: [
        { timestamp: "2026-04-30T12:00:00.000Z", value: 101 },
        { timestamp: "2026-04-30T14:00:00.000Z", value: 104 },
        { timestamp: "2026-04-30T20:00:00.000Z", value: 103 },
      ],
      range: "1D",
      source: "databento",
    });

    expect(
      createPriceHistoryDisplayLabels({
        chart,
        range: "1D",
        source: "databento",
        formatTimeLabel: (timestamp, range) => `${range}:${timestamp.slice(11, 16)}`,
      }),
    ).toEqual({
      session: "Extended hours",
      granularity: "1m bars",
      countLabel: "3 OHLCV bars",
      firstLabel: "1D:12:00",
      middleLabel: "1D:14:00",
      lastLabel: "1D:20:00",
    });
  });

  it("uses whole-dollar y-axis ticks for narrow price ranges", () => {
    const chart = createPriceHistoryViewModel({
      points: [
        { timestamp: "2026-04-30T12:00:00.000Z", value: 269.12 },
        { timestamp: "2026-04-30T13:00:00.000Z", value: 269.44 },
        { timestamp: "2026-04-30T14:00:00.000Z", value: 269.76 },
      ],
      range: "1D",
      source: "databento",
    });

    expect(chart.axis.map(({ value }) => value)).toEqual([271, 270, 269, 268]);
    expect(chart.axisPrecision).toBe(0);
  });

  it("uses whole-dollar y-axis ticks for medium price ranges", () => {
    const chart = createPriceHistoryViewModel({
      points: [
        { timestamp: "2026-04-30T12:00:00.000Z", value: 264.03 },
        { timestamp: "2026-04-30T13:00:00.000Z", value: 270.39 },
        { timestamp: "2026-04-30T14:00:00.000Z", value: 273.57 },
      ],
      range: "1D",
      source: "databento",
    });

    expect(chart.axis.map(({ value }) => value)).toEqual([276, 273, 270, 267, 264]);
    expect(chart.axisPrecision).toBe(0);
  });
});
