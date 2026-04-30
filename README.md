# Flamel: Financial Data View

Take-home project: design and build a web page for viewing equity data. Users can enter stock symbols and inspect relevant data for each symbol.

The app is a focused equity data workspace built with SolidJS. It uses a committed Databento-derived fixture by default, so reviewers can run the app without credentials while still seeing real historical OHLCV data. Optional Databento and Massive provider paths can be enabled with environment variables.

## What It Does

- Add stock symbols to a watchlist.
- Select a symbol and inspect quote details.
- View recent historical price movement.
- Show loading, error, fallback, and freshness states.
- Use real Databento-derived historical fixtures for offline or no-key review.
- Use Databento or Massive REST data when configured.

This is not a trading system. It does not place orders, manage accounts, stream live prices, or provide trading advice.

## Stack

- TypeScript
- SolidJS
- TanStack Router
- TanStack Query
- TailwindCSS
- Massive.com JavaScript client
- Vitest
- Bun
- Turborepo

## Getting Started

Install dependencies:

```bash
bun install
```

Run the web app:

```bash
bun run dev:web
```

Open the local URL printed by Vite.

Regenerate the Databento fixture after placing Databento JSON.zst exports under `data/raw/databento`:

```bash
bun scripts/build-databento-fixture.ts
```

The script writes `data/databento-market-data.json`.

## Market Data Configuration

With no market-data environment variables, the app uses the committed Databento fixture at `/data/databento-market-data.json`. This is intentional: reviewers can run the take-home without signing up for an API key.

Optional provider inputs:

```bash
VITE_DATABENTO_EXPORT_URL=/data/databento-market-data.json
VITE_DATABENTO_API_KEY=your_key_here
VITE_MASSIVE_API_KEY=your_key_here
```

For local development, create an `.env` file or export the variable before running the app.

Provider precedence is Databento export URL, Databento API key, Massive API key, then the bundled Databento fixture when none are configured.

## Market Data Approach

Databento OHLCV exports are normalized into a compact app-owned fixture at `data/databento-market-data.json`. The app does not load raw `.zst` vendor exports at runtime. Vite serves `/data/databento-market-data.json` during development and copies the same folder into the production build.

The submitted fixture contains 10 symbols: AAPL, AMZN, GOOG, META, MSFT, NVDA, QQQ, SPY, TSLA, and VOO.

Range-specific chart fixtures are derived from local Databento downloads:

- `1D`: 1-minute bars, extended hours.
- `1W`: 5-minute bars, regular session.
- `1M`: 1-hour bars, regular session.

Provider paths:

- `DatabentoExportMarketDataProvider`: committed fixture or configured export URL.
- `DatabentoMarketDataProvider`: Databento historical REST data when a Databento API key is present.
- `MassiveMarketDataProvider`: Massive REST data when a Massive API key is present.
- `MockMarketDataProvider`: deterministic data used in tests and development-only fallback construction.

The app avoids WebSockets, raw runtime downloads, and real-time polling in this milestone. API-backed requests are cached and kept bounded because free tiers are rate limited. The current UI treats quote and history responses as inspectable snapshots rather than a live tape.

## Architecture

The implementation is organized around a small market-data domain:

- Provider contract for `search`, `quote`, and `history`.
- `MarketDataSession` as the workspace seam, carrying normalized data with source, fallback, and status metadata.
- Databento fixture provider that maps app-owned OHLCV bars into quote and chart models.
- Databento historical provider that maps REST timeseries records into app-owned quote and price-point models.
- Massive mappers that convert REST responses into app-owned quote and price-point models.
- Mock provider with deterministic equities and history for tests.
- TanStack Query caching for quote and history requests.
- Focused watchlist quote state so the route component does not own request tracking and quote cache behavior.
- Solid view model for watchlist, selected symbol, time range, errors, and source state.
- UI surfaces for symbol entry, watchlist, selected equity details, and price history.

This keeps API-specific code out of the presentation layer and makes fallback behavior explicit.

## Tradeoffs

The prompt allows either mock data or a free API. This project uses committed Databento-derived fixtures for reliable review and keeps Massive REST support behind the same provider boundary for integration signal.

The chart is intentionally simple and SVG-based. That keeps the implementation inspectable and appropriate for the take-home. A production trading application would likely use a richer charting library and more complete market-data lifecycle handling.

The Databento 1D fixture includes extended-hours points. Multi-day ranges use regular-session bars so non-trading hours do not dominate the visual layout.

The app does not poll for live prices. On constrained free tiers, aggressive polling would create a worse demo and a weaker architecture story.

## Known Limitations

- No trading or order entry.
- No authentication or persisted watchlists.
- No backend service.
- No WebSocket streaming.
- No bulk data ingestion.
- No candlestick or indicator support.
- No market-data entitlement handling.
- Limited accessibility and keyboard-navigation pass.

## Future Improvements

- Persist the watchlist locally.
- Add richer quote rows for every watchlist symbol.
- Add compare mode for multiple symbols.
- Add candlestick charts or integrate a dedicated financial charting library.
- Add WebSocket streaming behind the same provider boundary if the API tier supports it.
- Add stronger accessibility coverage.
- Add a backend proxy if API-key protection or request coordination becomes important.

## Verification

Run tests:

```bash
bun --filter web test
```

Build:

```bash
bun run build
```

Format and lint fix:

```bash
bun run check
```

Type checking is exposed through the monorepo script:

```bash
bun run check-types
```

At the moment this repository template may report zero configured typecheck tasks. `bun run build` is the stronger verification command for the current app.

## Time Log

- 2026-04-30 16:00-18:00: 2h
- 2026-04-30 19:30-21:20: 1h 50m

Total: 3h 50m
Remaining from 8h: 4h 10m
