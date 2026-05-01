# Repository Map

## Top-Level Layout

- `apps/web`: SolidJS web application.
- `packages/config`: shared TypeScript config.
- `data`: committed Databento fixture. Raw local exports under `data/raw` are ignored.
- `scripts`: fixture generation utilities.
- `docs/adr`: durable architecture decisions.

## Web App Routing

- `apps/web/src/routes/index.tsx`: main route surface for the financial data workspace.
- `apps/web/src/routes/__root.tsx`: root route shell.
- `apps/web/src/routeTree.gen.ts`: generated TanStack route tree.

## Financial Data Feature

- `apps/web/src/features/financial-data/workspace.tsx`: main UI composition.
- `apps/web/src/features/financial-data/model.ts`: Solid view model and user actions.
- `apps/web/src/features/financial-data/queries.ts`: TanStack Query integration.
- `apps/web/src/features/financial-data/watchlist-quotes.ts`: watchlist quote state and cache behavior.
- `apps/web/src/features/financial-data/display-labels.ts`: source, session, freshness, and range display copy.
- `apps/web/src/features/financial-data/price-history-view-model.ts`: chart geometry, range metrics, axis ticks, and volume model.
- `apps/web/src/features/financial-data/components`: focused UI controls and metric cells.

## Market Data Domain

- `apps/web/src/features/market-data/types.ts`: app-owned provider and data contracts.
- `apps/web/src/features/market-data/providers/provider-factory.ts`: constructs the fixture-backed market-data session.
- `apps/web/src/features/market-data/providers/databento-market-data.ts`: Databento fixture provider.
- `apps/web/src/features/market-data/providers/session-market-data.ts`: provider-to-session adapter.
- `apps/web/src/features/market-data/providers/mock-market-data.ts`: deterministic test provider.
- `apps/web/src/features/market-data/finance-calculations.ts`: quote calculations and freshness helpers.
- `apps/web/src/features/market-data/price-series.ts`: history transformation helpers.
- `apps/web/src/features/market-data/symbols.ts`: symbol normalization and membership helpers.
- `apps/web/src/features/market-data/symbol-intake-policy.ts`: fixture symbol acceptance rules.
- `apps/web/src/features/market-data/databento-fixture.ts`: compact fixture parsing and OHLCV mapping.
- `apps/web/src/features/market-data/market-session.ts`: market-session labels and chart reference positions.

## Display Helpers

- `apps/web/src/features/market-display/formatting.ts`: shared financial display formatting.
- `apps/web/src/features/financial-data/chart-annotations.ts`: chart label and annotation helpers.

## Developer Entry Points

- Start with `apps/web/src/features/financial-data/workspace.tsx` for the rendered workspace.
- Start with `apps/web/src/features/financial-data/model.ts` for watchlist, symbol intake, range selection, and refresh behavior.
- Start with `apps/web/src/features/market-data/providers/provider-factory.ts` for fixture-backed session construction.
- Start with `apps/web/src/features/market-data/types.ts` for app-owned market-data contracts.

## Tests

Tests live next to feature modules under `__tests__`. Prefer focused tests for provider mapping, symbol handling, price-series behavior, chart view-model behavior, and display formatting.
