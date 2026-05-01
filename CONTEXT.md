# Context

## Product

This is a take-home financial data viewer for equities. Users maintain a small watchlist, select a symbol, inspect quote metadata, and view recent historical price movement.

The project is deliberately not a trading system. It has no order entry, accounts, authentication, entitlement model, live tape, or trading advice.

## Domain Terms

- `EquitySymbol`: app-owned symbol string such as `AAPL` or `MSFT`.
- `EquityQuote`: normalized quote detail used by the UI, including last price, previous close, open/high/low, change, volume, optional market cap and P/E, update time, and source.
- `PricePoint`: normalized historical chart point. Points may include OHLCV fields, but the chart currently reads a value series.
- `TimeRange`: supported chart ranges are `1D`, `1W`, and `1M`.
- `DataSource`: current provider identity, currently `databento` or `mock`.
- `MarketDataProvider`: provider contract for `search`, `quote`, and `history`.
- `MarketDataSession`: wrapper around providers that returns normalized data plus source metadata.
- `FinancialDataWorkspaceViewModel`: Solid-facing view model for watchlist, selected equity, symbol intake, range selection, source copy, and refresh behavior.

## Provider Model

The app uses `DatabentoExportMarketDataProvider` against `/data/databento-market-data.json`.

The fixture-backed market-data session is constructed in `apps/web/src/features/market-data/providers/provider-factory.ts`. Presentation code should not parse fixture response shapes directly.

## Operating Rules

- Keep the submitted runtime fixture-first unless a new ADR changes the data strategy.
- Keep raw vendor exports out of runtime and commits; `data/databento-market-data.json` is the browser-consumed artifact.
- Treat QQQ, SPY, and VOO as supported ETF fixture symbols, not default stocks.
- Chart labels are secondary to readability: hide persistent `Last` or reference labels when they collide with the visible price path, endpoint, or tooltip.
- Symbol intake must normalize lowercase input, select duplicates, reject unsupported symbols cleanly, and avoid empty watchlist rows.

## Fixture Model

Raw Databento exports live under `data/raw/databento` when present. The app runtime consumes the compact generated fixture at `data/databento-market-data.json`.

The committed fixture is meant to keep review reliable without API credentials. If fixture generation changes, update both the fixture and provider tests.

## UX Language

Use product-facing financial data language: quote, price history, watchlist, selected range, latest quote, historical snapshot, market session, source, and freshness.

Do not expose implementation details as promotional copy in the app. README and docs can explain tradeoffs; UI copy should help inspect data state.
