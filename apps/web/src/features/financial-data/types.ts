import type {
  DataSource,
  EquityQuote,
  EquitySearchResult,
  EquitySymbol,
  PricePoint,
  TimeRange,
} from "@/features/market-data/types";

export type FinancialDataStatus = "idle" | "loading" | "ready" | "error";

export interface WatchlistItemViewModel {
  symbol: EquitySymbol;
  quote?: EquityQuote;
  status: FinancialDataStatus;
  error?: string;
  source?: DataSource;
  selected: boolean;
}

export interface SelectedEquityViewModel {
  symbol?: EquitySymbol;
  quote?: EquityQuote;
  history: PricePoint[];
  quoteStatus: FinancialDataStatus;
  historyStatus: FinancialDataStatus;
  stale: boolean;
  error?: string;
}

export interface FinancialDataWorkspaceViewModel {
  watchlist: WatchlistItemViewModel[];
  selectedEquity: SelectedEquityViewModel;
  symbolInput: string;
  timeRange: TimeRange;
  dataSource?: DataSource;
  intakeError?: string;
  symbolSuggestions: EquitySearchResult[];
  symbolSuggestionMessage?: string;
  providerError?: string;
  canAddSymbol: boolean;
  setSymbolInput(value: string): void;
  addSymbol(symbolInput?: string): Promise<void>;
  selectSymbol(symbol: EquitySymbol): void;
  removeSymbol(symbol: EquitySymbol): void;
  setTimeRange(range: TimeRange): void;
  refresh(): void;
}
