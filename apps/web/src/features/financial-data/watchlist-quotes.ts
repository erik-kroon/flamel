import { createEffect, createMemo, createSignal, type Accessor } from "solid-js";

import {
  type DataSource,
  type EquityQuote,
  type EquitySymbol,
  type MarketDataSession,
  type MarketDataSourceStatus,
  type MarketDataSessionResult,
} from "@/features/market-data/types";

import type { FinancialDataStatus, WatchlistItemViewModel } from "./types";

export interface WatchlistQuoteState {
  quote?: EquityQuote;
  status: FinancialDataStatus;
  error?: string;
  source?: DataSource;
  sourceStatus?: MarketDataSourceStatus;
}

interface WatchlistQuoteRow extends WatchlistQuoteState {
  symbol: EquitySymbol;
}

export interface WatchlistQuotes {
  rows: Accessor<WatchlistQuoteRow[]>;
  viewRows(
    selectedSymbol: EquitySymbol,
    selectedResult?: MarketDataSessionResult<EquityQuote>,
  ): WatchlistItemViewModel[];
  rememberQuote(result: MarketDataSessionResult<EquityQuote>): void;
  loadQuote(symbol: EquitySymbol): Promise<MarketDataSessionResult<EquityQuote>>;
}

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
): WatchlistQuotes {
  const [states, setStates] = createSignal<Record<EquitySymbol, WatchlistQuoteState>>({});
  const [requested, setRequested] = createSignal<Set<EquitySymbol>>(new Set());

  function rememberQuote(result: MarketDataSessionResult<EquityQuote>) {
    const { data: quote } = result;

    setStates((currentStates) => ({
      ...currentStates,
      [quote.symbol]: {
        quote,
        status: "ready",
        source: result.source,
        sourceStatus: result.status,
      },
    }));
  }

  async function loadQuote(symbol: EquitySymbol) {
    setStates((currentStates) => ({
      ...currentStates,
      [symbol]: {
        ...currentStates[symbol],
        status: "loading",
        error: undefined,
      },
    }));

    try {
      const result = await session.quote(symbol);
      rememberQuote(result);

      return result;
    } catch (error) {
      setStates((currentStates) => ({
        ...currentStates,
        [symbol]: {
          ...currentStates[symbol],
          status: "error",
          error: errorMessage(error),
        },
      }));

      throw error;
    }
  }

  createEffect(() => {
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

    for (const symbol of missingSymbols) {
      void loadQuote(symbol).catch(() => undefined);
    }
  });

  const rows = createMemo<WatchlistQuoteRow[]>(() =>
    symbols().map((symbol) => ({
      symbol,
      ...states()[symbol],
      status: statusFor(states()[symbol]),
    })),
  );

  function viewRows(
    selectedSymbol: EquitySymbol,
    selectedResult?: MarketDataSessionResult<EquityQuote>,
  ): WatchlistItemViewModel[] {
    return rows().map((row) => {
      const selected = row.symbol === selectedSymbol;
      const selectedQuote = selectedResult?.data;
      const quote = selected ? (selectedQuote ?? row.quote) : row.quote;

      return {
        ...row,
        quote,
        status: quote ? "ready" : row.status,
        source: selected ? (selectedResult?.source ?? row.source) : row.source,
        sourceStatus: selected ? (selectedResult?.status ?? row.sourceStatus) : row.sourceStatus,
        selected,
      };
    });
  }

  return {
    rows,
    viewRows,
    rememberQuote,
    loadQuote,
  };
}
