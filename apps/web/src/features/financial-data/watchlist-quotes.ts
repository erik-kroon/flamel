import { createEffect, createMemo, createSignal, type Accessor } from "solid-js";

import {
  type DataSource,
  type EquityQuote,
  type EquitySymbol,
  type MarketDataSession,
  type MarketDataSessionResult,
} from "@/features/market-data/types";

import type { FinancialDataStatus, WatchlistItemViewModel } from "./types";

export interface WatchlistQuoteState {
  quote?: EquityQuote;
  status: FinancialDataStatus;
  error?: string;
  source?: DataSource;
}

interface WatchlistQuoteRow extends WatchlistQuoteState {
  symbol: EquitySymbol;
}

export interface WatchlistQuotes {
  hydrateVisibleSymbols(): void;
  rowViewModels(
    selectedSymbol?: EquitySymbol,
    selectedQuote?: WatchlistQuoteState,
  ): WatchlistItemViewModel[];
  mergeSelectedQuoteUpdate(result: MarketDataSessionResult<EquityQuote>): void;
  addVerifiedSymbol(symbol: EquitySymbol): Promise<MarketDataSessionResult<EquityQuote>>;
}

export interface WatchlistQuoteOptions {
  maxConcurrentHydration?: number;
}

export const DEFAULT_WATCHLIST_QUOTE_CONCURRENCY = 2;

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to load quote.";
}

function statusFor(state?: WatchlistQuoteState): FinancialDataStatus {
  return state?.status ?? "idle";
}

export function createWatchlistQuotes(
  symbols: Accessor<EquitySymbol[]>,
  session: Pick<MarketDataSession, "quote">,
  options: WatchlistQuoteOptions = {},
): WatchlistQuotes {
  const [states, setStates] = createSignal<Record<EquitySymbol, WatchlistQuoteState>>({});
  const [requested, setRequested] = createSignal<Set<EquitySymbol>>(new Set());
  const maxConcurrentHydration = Math.max(
    1,
    Math.floor(options.maxConcurrentHydration ?? DEFAULT_WATCHLIST_QUOTE_CONCURRENCY),
  );
  const hydrationQueue: EquitySymbol[] = [];
  const inFlightQuotes = new Map<EquitySymbol, Promise<MarketDataSessionResult<EquityQuote>>>();
  let activeHydrationCount = 0;

  function mergeSelectedQuoteUpdate(result: MarketDataSessionResult<EquityQuote>) {
    const { data: quote } = result;

    setStates((currentStates) => ({
      ...currentStates,
      [quote.symbol]: {
        quote,
        status: "ready",
        source: result.source,
      },
    }));
  }

  function requestQuote(symbol: EquitySymbol) {
    const inFlightQuote = inFlightQuotes.get(symbol);

    if (inFlightQuote) {
      return inFlightQuote;
    }

    setStates((currentStates) => ({
      ...currentStates,
      [symbol]: {
        ...currentStates[symbol],
        status: "loading",
        error: undefined,
      },
    }));

    const request = session
      .quote(symbol)
      .then((result) => {
        mergeSelectedQuoteUpdate(result);

        return result;
      })
      .catch((error) => {
        setStates((currentStates) => ({
          ...currentStates,
          [symbol]: {
            ...currentStates[symbol],
            status: "error",
            error: errorMessage(error),
          },
        }));

        throw error;
      })
      .finally(() => {
        inFlightQuotes.delete(symbol);
      });

    inFlightQuotes.set(symbol, request);

    return request;
  }

  async function addVerifiedSymbol(symbol: EquitySymbol) {
    return requestQuote(symbol);
  }

  function processHydrationQueue() {
    while (activeHydrationCount < maxConcurrentHydration) {
      const symbol = hydrationQueue.shift();

      if (!symbol) {
        return;
      }

      activeHydrationCount += 1;
      void requestQuote(symbol)
        .catch(() => undefined)
        .finally(() => {
          activeHydrationCount -= 1;
          processHydrationQueue();
        });
    }
  }

  function hydrateVisibleSymbols() {
    const currentStates = states();
    const currentRequested = requested();
    const missingSymbols = symbols().filter((symbol) => {
      const state = currentStates[symbol];

      return !state?.quote && state?.status !== "loading" && !currentRequested.has(symbol);
    });

    if (missingSymbols.length === 0) {
      return;
    }

    setRequested((requestedSymbols) => {
      const nextSymbols = new Set(requestedSymbols);

      for (const symbol of missingSymbols) {
        nextSymbols.add(symbol);
      }

      return nextSymbols;
    });

    hydrationQueue.push(...missingSymbols);
    processHydrationQueue();
  }

  createEffect(() => {
    hydrateVisibleSymbols();
  });

  const rows = createMemo<WatchlistQuoteRow[]>(() =>
    symbols().map((symbol) => ({
      symbol,
      ...states()[symbol],
      status: statusFor(states()[symbol]),
    })),
  );

  function rowViewModels(
    selectedSymbol?: EquitySymbol,
    selectedQuote?: WatchlistQuoteState,
  ): WatchlistItemViewModel[] {
    return rows().map((row) => {
      const selected = row.symbol === selectedSymbol;
      const quote = selected ? (selectedQuote?.quote ?? row.quote) : row.quote;

      return {
        ...row,
        quote,
        status: quote ? "ready" : selected ? (selectedQuote?.status ?? row.status) : row.status,
        error: selected ? (selectedQuote?.error ?? row.error) : row.error,
        source: selected ? (selectedQuote?.source ?? row.source) : row.source,
        selected,
      };
    });
  }

  return {
    hydrateVisibleSymbols,
    rowViewModels,
    mergeSelectedQuoteUpdate,
    addVerifiedSymbol,
  };
}
