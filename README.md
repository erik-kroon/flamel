# Flamel: Financial Data View

Flamel is a focused equity market workspace for inspecting historical equity data. Users can add supported symbols to a watchlist, select an instrument, inspect normalized quote details, and view range-aware historical price movement.

The app is built with SolidJS and TypeScript. It uses a committed Databento-derived local fixture, so reviewers can run the project without API credentials while still seeing real historical OHLCV data.

## What It Does

- Add supported stock and ETF symbols to a watchlist.
- Select a symbol and inspect normalized quote details.
- View historical price movement across 1D, 1W, and 1M ranges.
- Show latest quote context separately from selected range context.
- Display OHLCV tooltip data, volume, session markers, and source/freshness information.
- Show loading, unsupported-symbol, error, and freshness states.
- Run deterministically without API credentials.

This is not a trading system. It does not place orders, manage accounts, stream live prices, or provide trading advice.

## Stack

- TypeScript
- SolidJS
- TanStack Router
- TanStack Query
- TailwindCSS
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

Optional fixture regeneration after placing Databento `.json.zst` exports under `data/raw/databento`:

```bash
bun scripts/build-databento-fixture.ts
```

The script writes `data/databento-market-data.json`.

## Data

The app uses the committed Databento-derived fixture at `/data/databento-market-data.json`. This keeps the review path deterministic and does not require API credentials.

Databento OHLCV exports are normalized into a compact app-owned JSON fixture. The browser does not load raw `.zst` vendor exports at runtime. Vite serves `/data/databento-market-data.json` during development and copies the same folder into the production build.

The default watchlist contains seven Nasdaq equities: AAPL, AMZN, GOOG, META, MSFT, NVDA, and TSLA.

The bundled fixture also includes three ETF symbols that can be added manually: QQQ, SPY, and VOO.

Unsupported symbols show an inline error instead of adding a decorative or empty row.

Range-specific chart fixtures are derived from local Databento downloads:

- `1D`: 1-minute bars, extended hours.
- `1W`: 5-minute bars, regular session.
- `1M`: 1-hour bars, regular session.

## Architecture

The UI consumes app-owned market-data models through a small data boundary. The committed fixture shape is normalized before reaching presentation components.

Data access paths:

- `DatabentoExportMarketDataProvider`: reads the committed fixture at `/data/databento-market-data.json`.
- `MockMarketDataProvider`: deterministic provider used by tests.

The submitted runtime path uses the Databento fixture provider.

The app avoids external provider credentials, WebSockets, raw runtime downloads, and real-time polling in this milestone. The current UI treats quote and history responses as inspectable historical snapshots rather than a live tape.

The app separates latest quote context, such as last price and return vs previous close, from selected range context, such as range return, high/low, volume, bar count, and granularity.

## Tradeoffs

The prompt allows mocked data or a free API source. I chose a fixture-only approach using real historical Databento-derived data so the review path is deterministic and does not require API credentials.

The chart is intentionally simple and SVG-based. That keeps the implementation inspectable and appropriate for the take-home. A production trading application would likely use a richer charting library and more complete market-data lifecycle handling.

The Databento 1D fixture includes extended-hours points. Multi-day ranges use regular-session bars so non-trading hours do not dominate the visual layout.

The app does not poll for live prices. On constrained free tiers, aggressive polling would create a worse demo and a weaker architecture story.

## Known Limitations

- Historical fixture data only; not live market data.
- No trading or order entry.
- No authentication or account model.
- No backend service.
- No WebSocket streaming or live tape.
- No production ingestion pipeline, market-data entitlement model, or licensing controls.
- No candlestick or indicator support.
- Accessibility and keyboard support are limited to the core workspace flows.

## Future Improvements

- Persist additional workspace preferences such as selected range and last selected symbol.
- Broaden accessibility and keyboard-navigation coverage.
- Expand E2E coverage for visual regressions, edge states, and fixture/provider failure states.
- Add configurable watchlist columns such as volume, session, and range return.
- Add compare mode for multiple symbols.
- Add candlestick rendering or integrate a dedicated financial charting library.
- Add broader symbol search beyond the bundled fixture universe.
- Add a backend market-data proxy for API-key protection, provider caching, request coordination, and rate-limit handling.
- Add live data subscriptions behind the existing data boundary.
- Add production market-data entitlement and licensing controls.

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
