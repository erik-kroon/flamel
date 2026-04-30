# Agent Guide

This repo is a Bun/Turborepo workspace for a SolidJS financial data viewer.

## Start Here

- Read `README.md` for the product brief, setup commands, provider approach, and known limitations.
- Read `CONTEXT.md` for domain terms before changing market-data behavior.
- Read `CONTEXT-MAP.md` to find the relevant module.
- Put transient collaboration notes under `.context/`; that directory is gitignored.

## Working Rules

- Keep market-data provider code out of presentation components. UI code should consume app-owned quote, history, source, fallback, and status models.
- Preserve the fixture-first review path. With no market-data env vars, the app should use `/data/databento-market-data.json` and run without external credentials.
- Do not commit raw vendor exports unless the task explicitly requires it. Runtime code should use the compact fixture at `data/databento-market-data.json`.
- Treat the app as an inspectable snapshot workspace, not a live trading platform. Avoid adding polling, WebSockets, order entry, account state, or trading advice unless explicitly scoped.
- Generated TanStack route files are owned by the router tooling. Avoid hand-editing generated route artifacts unless there is no generated alternative.

## Commands

- Install: `bun install`
- Dev app: `bun run dev:web`
- Tests: `bun --filter web test`
- Build: `bun run build`
- Format/lint fix: `bun run check`
- Typecheck wrapper: `bun run check-types`

## Verification Expectations

- For provider, model, formatter, and query changes, run the focused Vitest tests when possible.
- For UI changes, run or build the app and inspect the affected viewport. Prefer the in-app browser for local frontend checks when available.
- For data fixture changes, regenerate via `bun scripts/build-databento-fixture.ts` and verify affected provider tests.

