import type {
  MassiveAggregatesResponse,
  MassiveSnapshotTicker,
  MassiveTickerResult,
  MassiveTickerSearchResponse,
} from "../providers/massive-mappers";

export const massiveTickerFixture: MassiveTickerResult = {
  ticker: "AAPL",
  name: "Apple Inc.",
  primary_exchange: "NASDAQ",
  currency_name: "usd",
  market_cap: 3_210_000_000_000,
};

export const massiveSearchFixture: MassiveTickerSearchResponse = {
  results: [
    massiveTickerFixture,
    {
      ticker: "MSFT",
      name: "Microsoft Corporation",
      primary_exchange: "NASDAQ",
      currency_name: "usd",
    },
  ],
};

export const massiveSnapshotFixture: MassiveSnapshotTicker = {
  ticker: "AAPL",
  session: {
    price: 209.44,
    open: 208.12,
    high: 211.88,
    low: 206.95,
    previous_close: 207.31,
    volume: 48_102_344,
    change: 2.13,
    change_percent: 1.03,
  },
  updated: 1_777_550_400_000,
};

export const massiveAggregatesFixture: MassiveAggregatesResponse = {
  results: [
    { t: 1_777_550_400_000, c: 209.44 },
    { t: 1_777_464_000_000, c: 207.31 },
    { t: 1_777_507_200_000, c: 208.88 },
  ],
};
