# Context

## Product

This is a take-home financial data viewer for equities. Users maintain a small watchlist, select a symbol, inspect quote metadata, and view recent historical price movement.

The project is deliberately not a trading system. It has no order entry, accounts, authentication, entitlement model, live tape, or trading advice.

## Domain Terms

- `EquitySymbol`: app-owned symbol string such as `AAPL` or `MSFT`.
- `EquityQuote`: normalized quote detail used by the UI, including last price, previous close, open/high/low, change, volume, optional market cap and P/E, update time, and source.
- `PricePoint`: normalized historical chart point. Points may include OHLCV fields, but the chart currently reads a value series.
- `TimeRange`: supported chart ranges are `1D`, `1W`, and `1M`.
- `DataSource`: current provider identity, currently `databento`, `massive`, or `mock`.
- `MarketDataProvider`: provider contract for `search`, `quote`, and `history`.
- `MarketDataSession`: wrapper around providers that returns normalized data plus source and fallback status metadata.
- `MarketDataSourceStatus`: `primary` or `fallback`; this is separate from the provider source.
- `FinancialDataWorkspaceViewModel`: Solid-facing view model for watchlist, selected equity, symbol intake, range selection, source copy, and refresh behavior.

## Provider Model

The default no-credentials path uses `DatabentoExportMarketDataProvider` against `/data/databento-market-data.json`.

Optional provider inputs are configured with:

- `VITE_DATABENTO_EXPORT_URL`
- `VITE_DATABENTO_API_KEY`
- `VITE_MASSIVE_API_KEY`

Provider selection lives in `apps/web/src/features/market-data/providers/provider-factory.ts`. Presentation code should not branch directly on env vars or vendor response shapes.

## Fixture Model

Raw Databento exports live under `data/raw/databento` when present. The app runtime consumes the compact generated fixture at `data/databento-market-data.json`.

The committed fixture is meant to keep review reliable without API credentials. If fixture generation changes, update both the fixture and provider tests.

## UX Language

Use product-facing financial data language: quote, price history, watchlist, source, fallback, cached quote, market session, market closed, provider, and transport.

Do not expose implementation details as promotional copy in the app. README and docs can explain tradeoffs; UI copy should help inspect data state.

