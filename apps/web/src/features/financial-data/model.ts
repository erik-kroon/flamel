import { useQuery, type QueryClient } from "@tanstack/solid-query";
import { createEffect, createMemo, createSignal } from "solid-js";

import {
  DEFAULT_SYMBOLS,
  MarketDataNotFoundError,
  MarketDataProviderError,
  type EquityQuote,
  type EquitySymbol,
  type MarketDataSessionResult,
  type TimeRange,
} from "@/features/market-data/types";
import { isQuoteStale } from "@/features/market-data/finance-calculations";
import type { ProviderSelection } from "@/features/market-data/providers/provider-factory";
import {
  hasSymbolInput,
  includesSymbol,
  normalizeSymbol,
} from "@/features/market-data/symbols";

import type {
  FinancialDataStatus,
  FinancialDataWorkspaceViewModel,
  SelectedEquityViewModel,
} from "./types";
import { financialHistoryQuery, financialQuoteQuery, marketDataSelection } from "./queries";
import { financialDataSourceCopy } from "./source-copy";
import { createWatchlistQuotes } from "./watchlist-quotes";

export const FINANCIAL_DATA_CACHE_WINDOW_MS = 15 * 60 * 1000;

function toUserMessage(error: unknown, fallback: string) {
  if (error instanceof MarketDataNotFoundError) {
    return error.message;
  }

  if (error instanceof MarketDataProviderError || error instanceof Error) {
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

export function createFinancialDataWorkspace(
  selection: ProviderSelection = marketDataSelection,
  queryClient?: () => QueryClient,
): FinancialDataWorkspaceViewModel {
  const { session } = selection;
  const { sourceLabel, sourceDescription, fallbackReason } = financialDataSourceCopy(selection);
  const [watchlist, setWatchlist] = createSignal<EquitySymbol[]>([...DEFAULT_SYMBOLS]);
  const [selectedSymbol, setSelectedSymbol] = createSignal<EquitySymbol>(DEFAULT_SYMBOLS[0]);
  const [symbolInput, setSymbolInput] = createSignal("");
  const [timeRange, setTimeRange] = createSignal<TimeRange>("1D");
  const [intakeError, setIntakeError] = createSignal<string>();
  const [lastSessionResult, setLastSessionResult] =
    createSignal<MarketDataSessionResult<unknown>>();
  const watchlistQuotes = createWatchlistQuotes(watchlist, session);

  const quote = useQuery(() => financialQuoteQuery(session, selectedSymbol()), queryClient);
  const history = useQuery(
    () => financialHistoryQuery(session, selectedSymbol(), timeRange()),
    queryClient,
  );

  createEffect(() => {
    const quoteResult = quote.data;
    const currentQuote = quoteResult?.data;

    if (!currentQuote) {
      return;
    }

    setLastSessionResult(quoteResult);
    watchlistQuotes.rememberQuote(quoteResult);
  });

  createEffect(() => {
    const historyResult = history.data;

    if (historyResult) {
      setLastSessionResult(historyResult);
    }
  });

  createEffect(() => {
    const quoteResult = quote.data;
    const historyResult = history.data;

    if (!quoteResult || !historyResult || quoteResult.source === historyResult.source) {
      return;
    }

    void history.refetch();
  });

  const watchlistView = createMemo(() => watchlistQuotes.viewRows(selectedSymbol(), quote.data));

  const selectedEquity = createMemo<SelectedEquityViewModel>(() => {
    const currentQuote = quote.data?.data;
    const currentHistory = history.data?.data ?? [];
    const quoteError = quote.error as unknown;
    const historyError = history.error as unknown;

    return {
      symbol: selectedSymbol(),
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
    get watchlist() {
      return watchlistView();
    },
    get selectedEquity() {
      return selectedEquity();
    },
    get symbolInput() {
      return symbolInput();
    },
    get timeRange() {
      return timeRange();
    },
    sourceLabel,
    sourceDescription,
    get dataSource() {
      return lastSessionResult()?.source;
    },
    get fallbackReason() {
      return lastSessionResult()?.fallbackReason ?? fallbackReason;
    },
    get intakeError() {
      return intakeError();
    },
    get providerError() {
      return selectedEquity().error;
    },
    get canAddSymbol() {
      return hasSymbolInput(symbolInput());
    },
    setSymbolInput(value) {
      setSymbolInput(value);
      setIntakeError(undefined);
    },
    async addSymbol() {
      const symbol = normalizeSymbol(symbolInput());

      if (!symbol) {
        setIntakeError("Enter a symbol to add.");
        return;
      }

      if (includesSymbol(watchlist(), symbol)) {
        setSelectedSymbol(symbol);
        setSymbolInput("");
        setIntakeError(`${symbol} is already in the watchlist.`);
        return;
      }

      try {
        const result = await watchlistQuotes.loadQuote(symbol);

        setLastSessionResult(result);
        setWatchlist((symbols) => [...symbols, symbol]);
        setSelectedSymbol(symbol);
        setSymbolInput("");
        setIntakeError(undefined);
      } catch (error) {
        setIntakeError(toUserMessage(error, `Unable to add ${symbol}.`));
      }
    },
    selectSymbol(symbol) {
      setSelectedSymbol(normalizeSymbol(symbol));
      setIntakeError(undefined);
    },
    setTimeRange(range) {
      setTimeRange(range);
    },
    refresh() {
      void quote.refetch();
      void history.refetch();
    },
  };
}
