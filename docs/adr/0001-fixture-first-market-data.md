# ADR 0001: Fixture-First Market Data Boundary

## Status

Accepted.

## Context

The project must be reviewable without credentials while still showing realistic equity data. Vendor APIs and raw exports have different shapes, availability constraints, and credential requirements.

## Decision

The app owns normalized market-data contracts in `apps/web/src/features/market-data/types.ts`.

The default market-data session uses the committed Databento-derived fixture at `/data/databento-market-data.json`.

Raw Databento exports are generation inputs, not runtime dependencies.

## Consequences

- Reviewers can run the app without external provider credentials.
- UI code can inspect source metadata without parsing fixture responses.
- Fixture generation must stay aligned with provider tests.
- Future live data should be added behind the provider/session boundary instead of bypassing it from UI components.
