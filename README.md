# Flamel

Flamel is a real-time trading terminal frontend built to make market state, order flow and portfolio state legible.

It consumes deterministic market-event streams from Tape, renders live quote/trade state, supports simulated order intent, tracks order lifecycle, derives portfolio/PnL from fills and marks, and makes stale/reconnect state explicit in the UI.

Flamel is not a broker and does not execute real trades.

## What to look at

- Tape-driven WebSocket stream ingestion
- explicit market-data vs order-state separation
- stale quote and stale valuation UX
- order ticket + blotter lifecycle
- portfolio read model derived from fills and marks
- selected-symbol chart and event tape
- compact stream health/debug drawer
