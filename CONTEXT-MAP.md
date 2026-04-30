# Context Map

## Top-Level Layout

- `apps/web`: SolidJS web application.
- `packages/env`: typed Vite client env parsing.
- `packages/config`: shared TypeScript config.
- `data`: generated Databento fixture and optional raw local exports.
- `scripts`: fixture generation utilities.
- `docs/adr`: durable architecture decisions.
- `docs/agents`: repo-local workflow notes for agents.

## Web App Routing

- `apps/web/src/routes/index.tsx`: main route surface for the financial data workspace.
- `apps/web/src/routes/__root.tsx`: root route shell.
- `apps/web/src/routeTree.gen.ts`: generated TanStack route tree.

## Financial Data Feature

- `apps/web/src/features/financial-data/workspace.tsx`: main UI composition.
- `apps/web/src/features/financial-data/model.ts`: Solid view model and user actions.
- `apps/web/src/features/financial-data/queries.ts`: TanStack Query integration.
- `apps/web/src/features/financial-data/watchlist-quotes.ts`: watchlist quote state and cache behavior.
- `apps/web/src/features/financial-data/source-copy.ts`: source and fallback display copy.
- `apps/web/src/features/financial-data/components`: focused UI controls and metric cells.

## Market Data Domain

- `apps/web/src/features/market-data/types.ts`: app-owned provider and data contracts.
- `apps/web/src/features/market-data/providers/provider-factory.ts`: env-based provider selection.
- `apps/web/src/features/market-data/providers/databento-market-data.ts`: Databento fixture and API provider.
- `apps/web/src/features/market-data/providers/massive-market-data.ts`: Massive REST provider.
- `apps/web/src/features/market-data/providers/fallback-market-data.ts`: primary/fallback session behavior.
- `apps/web/src/features/market-data/providers/mock-market-data.ts`: deterministic test/fallback provider.
- `apps/web/src/features/market-data/finance-calculations.ts`: quote calculations and freshness helpers.
- `apps/web/src/features/market-data/price-series.ts`: history transformation helpers.
- `apps/web/src/features/market-data/symbols.ts`: symbol normalization and membership helpers.

## Display Helpers

- `apps/web/src/features/market-display/formatting.ts`: shared financial display formatting.
- `apps/web/src/features/financial-data/chart-annotations.ts`: chart label and annotation helpers.

## Tests

Tests live next to feature modules under `__tests__`. Prefer focused tests for provider mapping, fallback behavior, symbol handling, price-series behavior, and display formatting.

