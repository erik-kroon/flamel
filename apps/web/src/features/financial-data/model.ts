import type { QueryClient } from "@tanstack/solid-query";
import { createEffect, createMemo, createSignal } from "solid-js";

import {
  MarketDataNotFoundError,
  MarketDataProviderError,
  type EquitySymbol,
  type MarketDataSessionResult,
  type TimeRange,
} from "@/features/market-data/types";
import type { MarketDataSessionSelection } from "@/features/market-data/providers/provider-factory";
import { tryAddSymbolToWatchlist } from "@/features/market-data/symbol-intake-policy";
import { hasSymbolInput, normalizeSymbol } from "@/features/market-data/symbols";
import {
  DEFAULT_WATCHLIST_SYMBOLS,
  SEARCHABLE_US_EQUITIES,
  unsupportedSymbolMessage,
} from "@/features/market-data/symbol-universe";

import type { FinancialDataWorkspaceViewModel } from "./types";
import { createSelectedEquityLoader, marketDataSelection } from "./queries";
import { createWatchlistQuotes } from "./watchlist-quotes";

export { FINANCIAL_DATA_CACHE_WINDOW_MS } from "./queries";
export const UNSUPPORTED_SYMBOL_MESSAGE = unsupportedSymbolMessage();
export const WATCHLIST_STORAGE_KEY = "flamel.watchlist.symbols";

interface WatchlistStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface FinancialDataWorkspaceOptions {
  watchlistStorage?: WatchlistStorage;
}

function defaultWatchlistStorage(): WatchlistStorage | undefined {
  return globalThis.localStorage;
}

function normalizeWatchlistSymbols(
  symbols: unknown,
  allowedSymbols?: ReadonlySet<EquitySymbol>,
): EquitySymbol[] {
  if (!Array.isArray(symbols)) {
    return [...DEFAULT_WATCHLIST_SYMBOLS];
  }

  const normalizedSymbols = symbols
    .filter((symbol): symbol is string => typeof symbol === "string")
    .map(normalizeSymbol)
    .filter((symbol) => symbol.length > 0)
    .filter((symbol) => !allowedSymbols || allowedSymbols.has(symbol));
  const uniqueSymbols = [...new Set(normalizedSymbols)];

  return uniqueSymbols.length > 0 ? uniqueSymbols : [...DEFAULT_WATCHLIST_SYMBOLS];
}

function readStoredWatchlist(
  storage?: WatchlistStorage,
  allowedSymbols?: ReadonlySet<EquitySymbol>,
) {
  if (!storage) {
    return [...DEFAULT_WATCHLIST_SYMBOLS];
  }

  try {
    const storedWatchlist = storage.getItem(WATCHLIST_STORAGE_KEY);

    return storedWatchlist
      ? normalizeWatchlistSymbols(JSON.parse(storedWatchlist), allowedSymbols)
      : [...DEFAULT_WATCHLIST_SYMBOLS];
  } catch {
    return [...DEFAULT_WATCHLIST_SYMBOLS];
  }
}

function persistWatchlist(storage: WatchlistStorage | undefined, symbols: readonly EquitySymbol[]) {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(symbols));
  } catch {
    // Local persistence is best-effort; storage failures should not block market data use.
  }
}

function toUserMessage(error: unknown, fallback: string) {
  if (error instanceof MarketDataNotFoundError) {
    return error.message;
  }

  if (error instanceof MarketDataProviderError || error instanceof Error) {
    return error.message;
  }

  return fallback;
}

function toSymbolIntakeMessage(error: unknown, symbol: EquitySymbol) {
  if (error instanceof MarketDataNotFoundError) {
    return UNSUPPORTED_SYMBOL_MESSAGE;
  }

  return toUserMessage(error, `Unable to add ${symbol}.`);
}

export function createFinancialDataWorkspace(
  selection: MarketDataSessionSelection = marketDataSelection,
  queryClient?: () => QueryClient,
  options: FinancialDataWorkspaceOptions = {},
): FinancialDataWorkspaceViewModel {
  const { session } = selection;
  const watchlistStorage = options.watchlistStorage ?? defaultWatchlistStorage();
  const storedWatchlistSymbols = new Set(selection.symbolIntakePolicy.fixtureSymbols);
  const initialWatchlist = readStoredWatchlist(watchlistStorage, storedWatchlistSymbols);
  const [watchlist, setWatchlist] = createSignal<EquitySymbol[]>(initialWatchlist);
  const [selectedSymbol, setSelectedSymbol] = createSignal<EquitySymbol | undefined>(
    initialWatchlist[0],
  );
  const [symbolInput, setSymbolInput] = createSignal("");
  const [timeRange, setTimeRange] = createSignal<TimeRange>("1D");
  const [intakeError, setIntakeError] = createSignal<string>();
  const [intakeSessionResult, setIntakeSessionResult] =
    createSignal<MarketDataSessionResult<unknown>>();
  const watchlistQuotes = createWatchlistQuotes(watchlist, session);
  const selectedEquity = createSelectedEquityLoader(
    session,
    selectedSymbol,
    timeRange,
    queryClient,
  );

  createEffect(() => {
    const quoteResult = selectedEquity.quoteResult;

    if (quoteResult?.data) {
      watchlistQuotes.mergeSelectedQuoteUpdate(quoteResult);
    }
  });

  createEffect(() => {
    persistWatchlist(watchlistStorage, watchlist());
  });

  const sessionResult = createMemo(() => selectedEquity.lastSessionResult ?? intakeSessionResult());
  const searchableFixtureSymbols = createMemo(() => {
    const fixtureSymbols = new Set(selection.symbolIntakePolicy.fixtureSymbols);
    const visibleSymbols = new Set(watchlist());
    const query = normalizeSymbol(symbolInput());

    return SEARCHABLE_US_EQUITIES.filter(({ symbol, name }) => {
      if (!fixtureSymbols.has(symbol) || visibleSymbols.has(symbol)) {
        return false;
      }

      return !query || symbol.includes(query) || name.toUpperCase().includes(query);
    });
  });
  const symbolSuggestionMessage = createMemo(() => {
    if (!hasSymbolInput(symbolInput())) {
      return undefined;
    }

    const symbol = normalizeSymbol(symbolInput());
    const fixtureSymbols = new Set(selection.symbolIntakePolicy.fixtureSymbols);

    return fixtureSymbols.has(symbol) || searchableFixtureSymbols().length > 0
      ? undefined
      : `No bundled fixture for ${symbol}`;
  });

  const watchlistView = createMemo(() =>
    watchlistQuotes.rowViewModels(selectedSymbol(), {
      quote: selectedEquity.viewModel.quote,
      status: selectedEquity.viewModel.quoteStatus,
      error: selectedEquity.error,
      source: selectedEquity.quoteResult?.source,
    }),
  );

  return {
    get watchlist() {
      return watchlistView();
    },
    get selectedEquity() {
      return selectedEquity.viewModel;
    },
    get symbolInput() {
      return symbolInput();
    },
    get timeRange() {
      return timeRange();
    },
    get dataSource() {
      return sessionResult()?.source;
    },
    get intakeError() {
      return intakeError();
    },
    get symbolSuggestions() {
      return searchableFixtureSymbols();
    },
    get symbolSuggestionMessage() {
      return symbolSuggestionMessage();
    },
    get providerError() {
      return selectedEquity.error;
    },
    get canAddSymbol() {
      return hasSymbolInput(symbolInput());
    },
    setSymbolInput(value) {
      setSymbolInput(value);
      setIntakeError(undefined);
    },
    async addSymbol(symbolInputOverride) {
      const submittedInput = symbolInputOverride ?? symbolInput();
      const symbol = normalizeSymbol(submittedInput);

      try {
        const intake = await tryAddSymbolToWatchlist({
          session,
          policy: selection.symbolIntakePolicy,
          symbolInput: submittedInput,
          currentSymbols: watchlist(),
          loadInitialQuote: (symbol) => watchlistQuotes.addVerifiedSymbol(symbol),
        });

        switch (intake.status) {
          case "empty":
            setIntakeError(intake.message);
            return;
          case "duplicate":
            setSelectedSymbol(intake.symbol);
            setSymbolInput("");
            setIntakeError(intake.message);
            return;
          case "rejected":
            setIntakeError(intake.message);
            return;
          case "accepted":
            setIntakeSessionResult(intake.quoteResult);
            setWatchlist((symbols) => [...symbols, intake.symbol]);
            setSelectedSymbol(intake.symbol);
            setSymbolInput("");
            setIntakeError(undefined);
            return;
        }
      } catch (error) {
        setIntakeError(toSymbolIntakeMessage(error, symbol));
      }
    },
    selectSymbol(symbol) {
      setSelectedSymbol(normalizeSymbol(symbol));
      setIntakeError(undefined);
    },
    removeSymbol(symbol) {
      const normalizedSymbol = normalizeSymbol(symbol);
      const currentWatchlist = watchlist();
      const removedIndex = currentWatchlist.findIndex((item) => item === normalizedSymbol);

      if (removedIndex === -1) {
        return;
      }

      const nextWatchlist = currentWatchlist.filter((item) => item !== normalizedSymbol);
      setWatchlist(nextWatchlist);
      setIntakeError(undefined);

      if (selectedSymbol() !== normalizedSymbol) {
        return;
      }

      setSelectedSymbol(
        nextWatchlist[removedIndex] ?? nextWatchlist[removedIndex - 1] ?? nextWatchlist[0],
      );
    },
    setTimeRange(range) {
      setTimeRange(range);
    },
    refresh() {
      selectedEquity.refresh();
    },
  };
}
