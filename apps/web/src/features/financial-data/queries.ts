import { queryOptions, useQuery, type QueryClient } from "@tanstack/solid-query";
import { createEffect, createMemo, createSignal, type Accessor } from "solid-js";

import { isQuoteStale } from "@/features/market-data/finance-calculations";
import {
  type EquityQuote,
  type EquitySymbol,
  type MarketDataSession,
  type MarketDataSessionResult,
  type TimeRange,
} from "@/features/market-data/types";
import {
  createMarketDataSession,
  type MarketDataSessionSelection,
} from "@/features/market-data/providers/provider-factory";
import { normalizeSymbol } from "@/features/market-data/symbols";
import { DEFAULT_WATCHLIST_SYMBOLS } from "@/features/market-data/symbol-universe";

import type { FinancialDataStatus, SelectedEquityViewModel } from "./types";

export const marketDataSelection = createMarketDataSession();

export const FINANCIAL_DATA_STALE_TIME_MS = 15 * 60 * 1000;
export const FINANCIAL_DATA_GC_TIME_MS = 30 * 60 * 1000;
export const FINANCIAL_DATA_CACHE_WINDOW_MS = 15 * 60 * 1000;

export interface SelectedEquityLoader {
  readonly viewModel: SelectedEquityViewModel;
  readonly lastSessionResult?: MarketDataSessionResult<unknown>;
  readonly quoteResult?: MarketDataSessionResult<EquityQuote>;
  readonly error?: string;
  refresh(): void;
}

function toUserMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

function toStatus(loading: boolean, error: unknown, hasValue: boolean): FinancialDataStatus {
  if (loading) {
    return "loading";
  }

  if (error) {
    return "error";
  }

  return hasValue ? "ready" : "idle";
}

function isStale(quote?: EquityQuote) {
  if (!quote) {
    return false;
  }

  return isQuoteStale(quote.updatedAt, new Date(), FINANCIAL_DATA_CACHE_WINDOW_MS);
}

export function financialQuoteQuery(session: MarketDataSession, symbol: string) {
  const normalizedSymbol = normalizeSymbol(symbol);

  return queryOptions({
    queryKey: ["financial-data", "quote", normalizedSymbol] as const,
    queryFn: () => session.quote(normalizedSymbol),
    enabled: normalizedSymbol.length > 0,
    staleTime: FINANCIAL_DATA_STALE_TIME_MS,
    gcTime: FINANCIAL_DATA_GC_TIME_MS,
  });
}

export function financialHistoryQuery(
  session: MarketDataSession,
  symbol: string,
  range: TimeRange,
) {
  const normalizedSymbol = normalizeSymbol(symbol);

  return queryOptions({
    queryKey: ["financial-data", "history", normalizedSymbol, range] as const,
    queryFn: () => session.history(normalizedSymbol, range),
    enabled: normalizedSymbol.length > 0,
    staleTime: FINANCIAL_DATA_STALE_TIME_MS,
    gcTime: FINANCIAL_DATA_GC_TIME_MS,
  });
}

export function preloadDefaultFinancialData(
  queryClient: QueryClient,
  selection: MarketDataSessionSelection = marketDataSelection,
) {
  const symbol = DEFAULT_WATCHLIST_SYMBOLS[0];

  void queryClient.prefetchQuery(financialQuoteQuery(selection.session, symbol));
  void queryClient.prefetchQuery(financialHistoryQuery(selection.session, symbol, "1D"));
}

export function createSelectedEquityLoader(
  session: MarketDataSession,
  symbol: Accessor<EquitySymbol | undefined>,
  range: Accessor<TimeRange>,
  queryClient?: () => QueryClient,
): SelectedEquityLoader {
  const [lastSessionResult, setLastSessionResult] =
    createSignal<MarketDataSessionResult<unknown>>();
  const quote = useQuery(() => financialQuoteQuery(session, symbol() ?? ""), queryClient);
  const history = useQuery(
    () => financialHistoryQuery(session, symbol() ?? "", range()),
    queryClient,
  );

  createEffect(() => {
    const result = quote.data;

    if (result?.data) {
      setLastSessionResult(result);
    }
  });

  createEffect(() => {
    const result = history.data;

    if (result) {
      setLastSessionResult(result);
    }
  });

  const viewModel = createMemo<SelectedEquityViewModel>(() => {
    const currentQuote = quote.data?.data;
    const currentHistory = history.data?.data ?? [];
    const quoteError = quote.error as unknown;
    const historyError = history.error as unknown;

    return {
      symbol: symbol(),
      quote: currentQuote,
      history: currentHistory,
      quoteStatus: toStatus(quote.isPending, quoteError, Boolean(currentQuote)),
      historyStatus: toStatus(history.isPending, historyError, currentHistory.length > 0),
      stale: isStale(currentQuote),
      error: quoteError
        ? toUserMessage(quoteError, "Unable to load quote.")
        : historyError
          ? toUserMessage(historyError, "Unable to load price history.")
          : undefined,
    };
  });

  return {
    get viewModel() {
      return viewModel();
    },
    get lastSessionResult() {
      return lastSessionResult();
    },
    get quoteResult() {
      return quote.data;
    },
    get error() {
      return viewModel().error;
    },
    refresh() {
      void quote.refetch();
      void history.refetch();
    },
  };
}
