import data from "../data/databento-market-data.json" with { type: "json" };
import { createPriceHistoryViewModel } from "../apps/web/src/features/financial-data/price-history-view-model";
import { mapDatabentoFixtureHistory } from "../apps/web/src/features/market-data/databento-fixture";
import type { EquityQuote, TimeRange } from "../apps/web/src/features/market-data/types";

const ranges: TimeRange[] = ["1D", "1W", "1M"];
const iterations = 1_000;
const fixture = data;
const equity = fixture.equities[0];

if (!equity) {
  throw new Error("Databento fixture must contain at least one equity.");
}

const quote: EquityQuote = {
  symbol: equity.symbol,
  name: equity.name,
  exchange: equity.exchange,
  currency: equity.currency,
  lastPrice: equity.quote.close,
  previousClose: equity.previousClose,
  open: equity.quote.open,
  high: equity.quote.high,
  low: equity.quote.low,
  volume: equity.quote.volume,
  change: equity.quote.close - equity.previousClose,
  changePercent: ((equity.quote.close - equity.previousClose) / equity.previousClose) * 100,
  updatedAt: equity.quote.timestamp,
  source: "databento",
};

for (const range of ranges) {
  const points = mapDatabentoFixtureHistory(equity.history[range]);
  const started = performance.now();
  let result: unknown;

  for (let index = 0; index < iterations; index += 1) {
    result = createPriceHistoryViewModel({
      points,
      quote,
      range,
      source: "databento",
    });
  }

  const elapsed = performance.now() - started;
  console.log(`${range}: ${points.length} points, ${(elapsed / iterations).toFixed(3)}ms/run`);
  void result;
}
