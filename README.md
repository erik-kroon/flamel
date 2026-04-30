# Financial Data View

Take-home project: design and build a web page for viewing equity data. Users can enter stock symbols and inspect relevant data for each symbol.

The app is a focused equity data workspace built with SolidJS. It uses Massive.com REST data when an API key is configured and falls back to deterministic mock data when no key is available, so the project remains easy to review.

## What It Does

- Add stock symbols to a watchlist.
- Select a symbol and inspect quote details.
- View recent historical price movement.
- Show loading, error, fallback, and freshness states.
- Use real Massive REST data when configured.
- Use deterministic mock data for offline or no-key review.

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

## Massive API Key

The app reads Massive credentials from:

```bash
VITE_MASSIVE_API_KEY=your_key_here
```

For local development, create an `.env` file or export the variable before running the app.

If `VITE_MASSIVE_API_KEY` is not configured, the app uses mock fallback data. This is intentional: reviewers can run the take-home without signing up for an API key.

## Market Data Approach

Massive REST is used through `@massive.com/client-js` for quote, reference, and aggregate history data. The app does not expose Massive response shapes directly to UI components. Data is normalized behind a small market data provider contract.

There are two provider paths:

- `MassiveMarketDataProvider`: real REST data when an API key is present.
- `MockMarketDataProvider`: deterministic fallback data for no-key review and tests.

The app avoids WebSockets, downloaded files, and real-time polling in this milestone. Massive free-tier usage is rate limited, so requests are cached and kept bounded. Frequent simulated live behavior is not part of the core take-home scope.

## Architecture

The implementation is organized around a small market-data domain:

- Provider contract for `search`, `quote`, and `history`.
- `MarketDataSession` as the main workspace seam, carrying normalized data with source, fallback, and status metadata.
- Massive mappers that convert REST responses into app-owned quote and price-point models.
- Mock provider with deterministic equities and history.
- TanStack Query caching for quote and history requests.
- Focused watchlist quote state so the route component does not own request tracking and quote cache behavior.
- Shared display formatting for prices, compact numbers, signed percent moves, timestamps, and chart labels.
- Solid view model for selected symbol, time range, errors, and source state.
- UI surfaces for symbol entry, watchlist, selected equity details, and price history.

This keeps API-specific code out of the presentation layer and makes fallback behavior explicit.

## Design Decisions

The UI is a compact equity workspace, not a generic dashboard. The layout separates symbol discovery, watchlist comparison, selected instrument identity, price history, and quote metadata so a reviewer can inspect data state quickly.

Implementation details stay in this README rather than becoming product copy. In the app, provider, freshness, transport, market session, and updated time are shown using financial-data language such as cached quote, mock provider, REST, and market closed.

Mock fallback exists for review reliability. The mock provider uses deterministic but denser range-specific history so the chart direction supports the displayed quote move and remains credible without an API key.

The chart is SVG-based to keep the implementation inspectable for the take-home. A production platform would likely use a dedicated charting layer depending on update frequency, data volume, overlays, and interaction requirements.

## Tradeoffs

The prompt allows either mock data or a free API. This project uses both: Massive REST for real integration signal, and mock fallback for reliable review.

The chart is intentionally simple and SVG-based. That keeps the implementation inspectable and appropriate for the take-home. A production trading application would likely use a richer charting library and more complete market-data lifecycle handling.

The app does not poll for live prices. On a constrained free tier, aggressive polling would create a worse demo and a weaker architecture story.

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
