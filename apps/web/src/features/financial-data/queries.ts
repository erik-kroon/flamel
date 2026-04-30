import { queryOptions, type QueryClient } from "@tanstack/solid-query";

import { type MarketDataSession, type TimeRange } from "@/features/market-data/types";
import {
  createMarketDataProvider,
  type ProviderSelection,
} from "@/features/market-data/providers/provider-factory";
import { normalizeSymbol } from "@/features/market-data/symbols";
import { DEFAULT_SYMBOLS } from "@/features/market-data/symbol-universe";

export const marketDataSelection = createMarketDataProvider();

export const FINANCIAL_DATA_STALE_TIME_MS = 15 * 60 * 1000;
export const FINANCIAL_DATA_GC_TIME_MS = 30 * 60 * 1000;

export function financialQuoteQuery(session: MarketDataSession, symbol: string) {
  const normalizedSymbol = normalizeSymbol(symbol);

  return queryOptions({
    queryKey: ["financial-data", "quote", normalizedSymbol] as const,
    queryFn: () => session.quote(normalizedSymbol),
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
    staleTime: FINANCIAL_DATA_STALE_TIME_MS,
    gcTime: FINANCIAL_DATA_GC_TIME_MS,
  });
}

export function preloadDefaultFinancialData(
  queryClient: QueryClient,
  selection: ProviderSelection = marketDataSelection,
) {
  const symbol = DEFAULT_SYMBOLS[0];

  void queryClient.prefetchQuery(financialQuoteQuery(selection.session, symbol));
  void queryClient.prefetchQuery(financialHistoryQuery(selection.session, symbol, "1D"));
}
