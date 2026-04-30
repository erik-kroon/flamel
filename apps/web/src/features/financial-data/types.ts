import type {
  DataSource,
  EquityQuote,
  EquitySymbol,
  MarketDataSourceStatus,
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
  sourceStatus?: MarketDataSourceStatus;
  selected: boolean;
}

export interface SelectedEquityViewModel {
  symbol: EquitySymbol;
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
  fallbackReason?: string;
  intakeError?: string;
  providerError?: string;
  canAddSymbol: boolean;
  setSymbolInput(value: string): void;
  addSymbol(): Promise<void>;
  selectSymbol(symbol: EquitySymbol): void;
  setTimeRange(range: TimeRange): void;
  refresh(): void;
}
