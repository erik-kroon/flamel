import type { StreamEnvelope, StreamEvent, SymbolCode } from "@/protocol/events";

type StreamHandler = (envelope: StreamEnvelope) => void;

const SYMBOLS: SymbolCode[] = [
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

const BASE_PRICES: Record<SymbolCode, number> = {
  ALCH: 184.2,
  TAPE: 92.4,
  WIRE: 47.6,
  PNL: 126.1,
  ZIGX: 31.3,
  RUST: 74.8,
  SOLI: 58.9,
  EDGE: 203.7,
  SEQ: 18.4,
  FILL: 67.2,
};

export interface StreamClient {
  start: () => void;
  stop: () => void;
}

export function createStreamClient(onEnvelope: StreamHandler): StreamClient {
  const tapeUrl = import.meta.env.VITE_TAPE_WS_URL as string | undefined;
  if (tapeUrl) {
    return createTapeWebSocketClient(tapeUrl, onEnvelope);
  }

  return createDeterministicReplayClient(onEnvelope);
}

function createTapeWebSocketClient(url: string, onEnvelope: StreamHandler): StreamClient {
  let socket: WebSocket | undefined;
  let reconnectTimer: number | undefined;

  const connect = () => {
    socket = new WebSocket(url);
    socket.addEventListener("open", () => {
      onEnvelope({
        sequence: 0,
        source: "tape-ws",
        mode: "live",
        receivedAt: Date.now(),
        event: {
          type: "stream-health",
          state: "connected",
          sourceLagMs: 0,
          gapCount: 0,
        },
      });
    });

    socket.addEventListener("message", (message) => {
      const parsed = JSON.parse(String(message.data)) as StreamEnvelope;
      onEnvelope({ ...parsed, source: "tape-ws", mode: "live", receivedAt: Date.now() });
    });

    socket.addEventListener("close", () => {
      onEnvelope({
        sequence: 0,
        source: "tape-ws",
        mode: "live",
        receivedAt: Date.now(),
        event: {
          type: "stream-health",
          state: "reconnecting",
          sourceLagMs: 0,
          gapCount: 0,
        },
      });
      reconnectTimer = window.setTimeout(connect, 1600);
    });
  };

  return {
    start: connect,
    stop: () => {
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
      }
      socket?.close();
    },
  };
}

function createDeterministicReplayClient(onEnvelope: StreamHandler): StreamClient {
  let sequence = 0;
  let step = 0;
  let timer: number | undefined;

  const emit = (event: StreamEvent) => {
    sequence += 1;
    onEnvelope({
      sequence,
      source: "tape-replay",
      mode: "tape",
      receivedAt: Date.now(),
      event,
    });
  };

  const tick = () => {
    const symbol = SYMBOLS[step % SYMBOLS.length] ?? "ALCH";
    const phase = step / 3;
    const base = BASE_PRICES[symbol];
    const drift = Math.sin(phase) * 0.72 + Math.cos(phase / 2) * 0.38;
    const mid = Number((base + drift).toFixed(2));
    const spread = Number((0.05 + ((step + symbol.length) % 5) * 0.01).toFixed(2));

    emit({
      type: "quote",
      symbol,
      bid: Number((mid - spread / 2).toFixed(2)),
      ask: Number((mid + spread / 2).toFixed(2)),
      bidSize: 100 + ((step * 19) % 900),
      askSize: 120 + ((step * 23) % 800),
    });

    if (step % 2 === 0) {
      emit({
        type: "trade",
        symbol,
        price: mid,
        size: 25 + ((step * 13) % 275),
        aggressor: step % 4 === 0 ? "buy" : "sell",
      });
    }

    if (step % 7 === 0) {
      emit({
        type: "stream-health",
        state: step % 29 === 0 && step > 0 ? "stale" : "connected",
        sourceLagMs: 18 + ((step * 17) % 160),
        gapCount: step > 0 && step % 37 === 0 ? 1 : 0,
      });
    }

    step += 1;
  };

  return {
    start: () => {
      emit({
        type: "stream-health",
        state: "connected",
        sourceLagMs: 22,
        gapCount: 0,
      });
      SYMBOLS.forEach((symbol, index) => {
        const base = BASE_PRICES[symbol];
        emit({
          type: "quote",
          symbol,
          bid: base - 0.03,
          ask: base + 0.03,
          bidSize: 300 + index * 30,
          askSize: 280 + index * 28,
        });
      });
      timer = window.setInterval(tick, 520);
    },
    stop: () => {
      if (timer) {
        window.clearInterval(timer);
      }
    },
  };
}
