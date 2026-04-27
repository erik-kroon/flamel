export type SymbolCode =
  | "ALCH"
  | "TAPE"
  | "WIRE"
  | "PNL"
  | "ZIGX"
  | "RUST"
  | "SOLI"
  | "EDGE"
  | "SEQ"
  | "FILL";

export type StreamMode = "tape" | "live";
export type ConnectionState = "connected" | "reconnecting" | "stale" | "offline";
export type Side = "buy" | "sell";
export type OrderKind = "market" | "limit";
export type OrderStatus = "submitted" | "accepted" | "filled" | "rejected" | "cancelled";

export interface StreamEnvelope<TEvent extends StreamEvent = StreamEvent> {
  sequence: number;
  source: "tape-replay" | "tape-ws" | "local-execution";
  mode: StreamMode;
  receivedAt: number;
  event: TEvent;
}

export type StreamEvent =
  | QuoteEvent
  | TradeEvent
  | StreamHealthEvent
  | OrderLifecycleEvent
  | PortfolioMarkEvent;

export interface QuoteEvent {
  type: "quote";
  symbol: SymbolCode;
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
}

export interface TradeEvent {
  type: "trade";
  symbol: SymbolCode;
  price: number;
  size: number;
  aggressor: Side;
}

export interface StreamHealthEvent {
  type: "stream-health";
  state: ConnectionState;
  sourceLagMs: number;
  gapCount: number;
}

export interface OrderLifecycleEvent {
  type: "order";
  orderId: string;
  symbol: SymbolCode;
  side: Side;
  kind: OrderKind;
  quantity: number;
  limitPrice?: number;
  status: OrderStatus;
  fillPrice?: number;
  reason?: string;
}

export interface PortfolioMarkEvent {
  type: "portfolio-mark";
  symbol: SymbolCode;
  markPrice: number;
}
