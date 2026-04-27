import { createMemo } from "solid-js";
import { createStore, produce } from "solid-js/store";

import { createStreamClient } from "@/features/stream/StreamClient";
import type {
  ConnectionState,
  OrderKind,
  OrderLifecycleEvent,
  OrderStatus,
  Side,
  StreamEnvelope,
  SymbolCode,
} from "@/protocol/events";

export interface QuoteState {
  symbol: SymbolCode;
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
  last?: number;
  lastSize?: number;
  lastSide?: Side;
  updatedAt: number;
  change: number;
}

export interface TapeRow {
  id: string;
  symbol: SymbolCode;
  label: string;
  value: string;
  side?: Side;
  receivedAt: number;
}

export interface ChartPoint {
  sequence: number;
  price: number;
  receivedAt: number;
}

export interface OrderRow {
  id: string;
  symbol: SymbolCode;
  side: Side;
  kind: OrderKind;
  quantity: number;
  limitPrice?: number;
  status: OrderStatus;
  submittedAt: number;
  updatedAt: number;
  fillPrice?: number;
  reason?: string;
  timeline: OrderTimelineEntry[];
}

export interface OrderTimelineEntry {
  status: OrderStatus;
  receivedAt: number;
  reason?: string;
}

export interface PositionRow {
  symbol: SymbolCode;
  quantity: number;
  avgEntry: number;
  markPrice: number;
  realizedPnl: number;
  updatedAt: number;
}

interface MarketState {
  selectedSymbol: SymbolCode;
  quotes: Partial<Record<SymbolCode, QuoteState>>;
  tape: TapeRow[];
  chart: Partial<Record<SymbolCode, ChartPoint[]>>;
}

interface StreamState {
  connection: ConnectionState;
  mode: "tape" | "live";
  source: string;
  lastEventAt: number;
  sequence: number;
  gapCount: number;
  sourceLagMs: number;
  eventRate: number;
  debugOpen: boolean;
  rawEvents: StreamEnvelope[];
}

interface TerminalState {
  market: MarketState;
  stream: StreamState;
  orders: OrderRow[];
  positions: Partial<Record<SymbolCode, PositionRow>>;
}

export interface OrderIntent {
  symbol: SymbolCode;
  side: Side;
  kind: OrderKind;
  quantity: number;
  limitPrice?: number;
}

const INITIAL_SYMBOLS: SymbolCode[] = [
  "ALCH",
  "TAPE",
  "WIRE",
  "PNL",
  "ZIGX",
  "RUST",
  "SOLI",
  "EDGE",
  "SEQ",
  "FILL",
];

const initialState: TerminalState = {
  market: {
    selectedSymbol: "ALCH",
    quotes: {},
    tape: [],
    chart: {},
  },
  stream: {
    connection: "offline",
    mode: "tape",
    source: "tape-replay",
    lastEventAt: Date.now(),
    sequence: 0,
    gapCount: 0,
    sourceLagMs: 0,
    eventRate: 0,
    debugOpen: false,
    rawEvents: [],
  },
  orders: [],
  positions: {},
};

export function createTerminalModel() {
  const [state, setState] = createStore<TerminalState>(initialState);
  const client = createStreamClient(applyEnvelope);
  const eventWindow: number[] = [];

  const symbols = () => INITIAL_SYMBOLS;

  const selectedQuote = createMemo(() => state.market.quotes[state.market.selectedSymbol]);

  const selectedTape = createMemo(() =>
    state.market.tape.filter((event) => event.symbol === state.market.selectedSymbol).slice(0, 18),
  );

  const selectedChart = createMemo(
    () => state.market.chart[state.market.selectedSymbol]?.slice(-44) ?? [],
  );

  const positions = createMemo(() =>
    Object.values(state.positions)
      .filter((position): position is PositionRow => Boolean(position))
      .sort((a, b) => Math.abs(b.quantity * b.markPrice) - Math.abs(a.quantity * a.markPrice)),
  );

  const pnlSummary = createMemo(() => {
    let realized = 0;
    let unrealized = 0;
    let exposure = 0;

    positions().forEach((position) => {
      realized += position.realizedPnl;
      unrealized += (position.markPrice - position.avgEntry) * position.quantity;
      exposure += Math.abs(position.quantity * position.markPrice);
    });

    return { realized, unrealized, exposure };
  });

  function start() {
    client.start();
  }

  function stop() {
    client.stop();
  }

  function selectSymbol(symbol: SymbolCode) {
    setState("market", "selectedSymbol", symbol);
  }

  function toggleDebug() {
    setState("stream", "debugOpen", (open) => !open);
  }

  function submitOrder(intent: OrderIntent) {
    const orderId = `ORD-${String(state.orders.length + 1).padStart(4, "0")}`;
    const now = Date.now();
    const order: OrderLifecycleEvent = {
      type: "order",
      orderId,
      symbol: intent.symbol,
      side: intent.side,
      kind: intent.kind,
      quantity: intent.quantity,
      limitPrice: intent.limitPrice,
      status: "submitted",
    };

    applyEnvelope(localEnvelope(order, now));

    window.setTimeout(() => {
      const quote = state.market.quotes[intent.symbol];
      const mid = quote ? (quote.bid + quote.ask) / 2 : intent.limitPrice;
      const crosses =
        intent.kind === "market" ||
        (intent.side === "buy" && intent.limitPrice !== undefined && quote !== undefined
          ? intent.limitPrice >= quote.ask
          : intent.side === "sell" && intent.limitPrice !== undefined && quote !== undefined
            ? intent.limitPrice <= quote.bid
            : false);

      if (!quote || !mid) {
        applyEnvelope(
          localEnvelope(
            {
              ...order,
              status: "rejected",
              reason: "NO_MARK",
            },
            Date.now(),
          ),
        );
        return;
      }

      applyEnvelope(localEnvelope({ ...order, status: "accepted" }, Date.now()));

      window.setTimeout(() => {
        if (!crosses) {
          applyEnvelope(
            localEnvelope(
              {
                ...order,
                status: "rejected",
                reason: "LIMIT_AWAY_FROM_TOUCH",
              },
              Date.now(),
            ),
          );
          return;
        }

        applyEnvelope(
          localEnvelope(
            {
              ...order,
              status: "filled",
              fillPrice: intent.side === "buy" ? quote.ask : quote.bid,
            },
            Date.now(),
          ),
        );
      }, 620);
    }, 420);
  }

  function applyEnvelope(envelope: StreamEnvelope) {
    const now = envelope.receivedAt;
    eventWindow.push(now);
    while (eventWindow.length > 0 && now - (eventWindow[0] ?? now) > 5000) {
      eventWindow.shift();
    }

    setState(
      produce((draft) => {
        draft.stream.sequence = Math.max(draft.stream.sequence, envelope.sequence);
        draft.stream.mode = envelope.mode;
        draft.stream.source = envelope.source;
        draft.stream.lastEventAt = now;
        draft.stream.eventRate = eventWindow.length / 5;
        draft.stream.rawEvents.unshift(envelope);
        draft.stream.rawEvents = draft.stream.rawEvents.slice(0, 80);

        const event = envelope.event;

        if (event.type === "stream-health") {
          draft.stream.connection = event.state;
          draft.stream.sourceLagMs = event.sourceLagMs;
          draft.stream.gapCount += event.gapCount;
          return;
        }

        if (event.type === "quote") {
          const previous = draft.market.quotes[event.symbol];
          const mid = (event.bid + event.ask) / 2;
          draft.market.quotes[event.symbol] = {
            symbol: event.symbol,
            bid: event.bid,
            ask: event.ask,
            bidSize: event.bidSize,
            askSize: event.askSize,
            last: previous?.last,
            lastSize: previous?.lastSize,
            lastSide: previous?.lastSide,
            updatedAt: now,
            change: previous ? mid - (previous.bid + previous.ask) / 2 : 0,
          };
          draft.market.tape.unshift({
            id: `${envelope.sequence}-quote-${event.symbol}`,
            symbol: event.symbol,
            label: "QUOTE",
            value: `${event.bid.toFixed(2)} x ${event.ask.toFixed(2)}`,
            receivedAt: now,
          });
          draft.market.tape = draft.market.tape.slice(0, 140);
          draft.positions[event.symbol] = markPosition(
            draft.positions[event.symbol],
            event.symbol,
            mid,
            now,
          );
          return;
        }

        if (event.type === "trade") {
          const quote = draft.market.quotes[event.symbol];
          if (quote) {
            quote.last = event.price;
            quote.lastSize = event.size;
            quote.lastSide = event.aggressor;
            quote.updatedAt = now;
          }
          const chart = draft.market.chart[event.symbol] ?? [];
          chart.push({ sequence: envelope.sequence, price: event.price, receivedAt: now });
          draft.market.chart[event.symbol] = chart.slice(-120);
          draft.market.tape.unshift({
            id: `${envelope.sequence}-trade-${event.symbol}`,
            symbol: event.symbol,
            label: "TRADE",
            value: `${event.size} @ ${event.price.toFixed(2)}`,
            side: event.aggressor,
            receivedAt: now,
          });
          draft.market.tape = draft.market.tape.slice(0, 140);
          draft.positions[event.symbol] = markPosition(
            draft.positions[event.symbol],
            event.symbol,
            event.price,
            now,
          );
          return;
        }

        if (event.type === "portfolio-mark") {
          draft.positions[event.symbol] = markPosition(
            draft.positions[event.symbol],
            event.symbol,
            event.markPrice,
            now,
          );
          return;
        }

        upsertOrder(draft, event, now);
      }),
    );
  }

  return {
    state,
    symbols,
    selectedQuote,
    selectedTape,
    selectedChart,
    positions,
    pnlSummary,
    start,
    stop,
    selectSymbol,
    submitOrder,
    toggleDebug,
  };
}

function localEnvelope(event: OrderLifecycleEvent, receivedAt: number): StreamEnvelope {
  return {
    sequence: receivedAt,
    source: "local-execution",
    mode: "tape",
    receivedAt,
    event,
  };
}

function upsertOrder(draft: TerminalState, event: OrderLifecycleEvent, now: number) {
  const existing = draft.orders.find((order) => order.id === event.orderId);
  const timelineEntry = {
    status: event.status,
    receivedAt: now,
    reason: event.reason,
  };

  if (!existing) {
    draft.orders.unshift({
      id: event.orderId,
      symbol: event.symbol,
      side: event.side,
      kind: event.kind,
      quantity: event.quantity,
      limitPrice: event.limitPrice,
      status: event.status,
      submittedAt: now,
      updatedAt: now,
      fillPrice: event.fillPrice,
      reason: event.reason,
      timeline: [timelineEntry],
    });
  } else {
    existing.status = event.status;
    existing.updatedAt = now;
    existing.fillPrice = event.fillPrice ?? existing.fillPrice;
    existing.reason = event.reason;
    existing.timeline.unshift(timelineEntry);
  }

  if (event.status === "filled" && event.fillPrice) {
    draft.positions[event.symbol] = applyFill(
      draft.positions[event.symbol],
      event.symbol,
      event.side,
      event.quantity,
      event.fillPrice,
      now,
    );
  }
}

function applyFill(
  position: PositionRow | undefined,
  symbol: SymbolCode,
  side: Side,
  quantity: number,
  price: number,
  now: number,
): PositionRow {
  const signedQuantity = side === "buy" ? quantity : -quantity;
  if (!position || position.quantity === 0) {
    return {
      symbol,
      quantity: signedQuantity,
      avgEntry: price,
      markPrice: price,
      realizedPnl: 0,
      updatedAt: now,
    };
  }

  const nextQuantity = position.quantity + signedQuantity;
  const sameDirection = Math.sign(position.quantity) === Math.sign(signedQuantity);
  const realizedPnl = sameDirection
    ? position.realizedPnl
    : position.realizedPnl +
      (price - position.avgEntry) *
        Math.min(Math.abs(position.quantity), quantity) *
        Math.sign(position.quantity);

  const avgEntry =
    sameDirection && nextQuantity !== 0
      ? (position.avgEntry * Math.abs(position.quantity) + price * quantity) /
        Math.abs(nextQuantity)
      : nextQuantity === 0
        ? price
        : position.avgEntry;

  return {
    ...position,
    quantity: nextQuantity,
    avgEntry,
    markPrice: price,
    realizedPnl,
    updatedAt: now,
  };
}

function markPosition(
  position: PositionRow | undefined,
  symbol: SymbolCode,
  markPrice: number,
  now: number,
): PositionRow | undefined {
  if (!position) {
    return undefined;
  }

  return {
    ...position,
    symbol,
    markPrice,
    updatedAt: now,
  };
}
