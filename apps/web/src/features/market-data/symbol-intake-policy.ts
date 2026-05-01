import type {
  EquityQuote,
  EquitySymbol,
  MarketDataSession,
  MarketDataSessionResult,
  SymbolIntakePolicy,
} from "./types";
import { includesSymbol, normalizeSymbol } from "./symbols";

export interface SymbolIntakeAccepted {
  accepted: true;
  symbol: EquitySymbol;
}

export interface SymbolIntakeRejected {
  accepted: false;
  symbol: EquitySymbol;
  message: string;
}

export type SymbolIntakeResult = SymbolIntakeAccepted | SymbolIntakeRejected;

export interface TryAddSymbolToWatchlistRequest {
  session: MarketDataSession;
  policy: SymbolIntakePolicy;
  symbolInput: string;
  currentSymbols: readonly EquitySymbol[];
  loadInitialQuote(symbol: EquitySymbol): Promise<MarketDataSessionResult<EquityQuote>>;
}

export interface SymbolWatchlistAddEmpty {
  status: "empty";
  message: string;
}

export interface SymbolWatchlistAddDuplicate {
  status: "duplicate";
  symbol: EquitySymbol;
  message: string;
}

export interface SymbolWatchlistAddRejected {
  status: "rejected";
  symbol: EquitySymbol;
  message: string;
}

export interface SymbolWatchlistAddAccepted {
  status: "accepted";
  symbol: EquitySymbol;
  quoteResult: MarketDataSessionResult<EquityQuote>;
}

export type SymbolWatchlistAddResult =
  | SymbolWatchlistAddEmpty
  | SymbolWatchlistAddDuplicate
  | SymbolWatchlistAddRejected
  | SymbolWatchlistAddAccepted;

export async function evaluateSymbolIntake(
  _session: MarketDataSession,
  policy: SymbolIntakePolicy,
  symbolInput: string,
): Promise<SymbolIntakeResult> {
  const symbol = normalizeSymbol(symbolInput);

  if (includesSymbol(policy.fixtureSymbols, symbol)) {
    return { accepted: true, symbol };
  }

  return {
    accepted: false,
    symbol,
    message: policy.unsupportedMessage,
  };
}

export async function tryAddSymbolToWatchlist({
  session,
  policy,
  symbolInput,
  currentSymbols,
  loadInitialQuote,
}: TryAddSymbolToWatchlistRequest): Promise<SymbolWatchlistAddResult> {
  const symbol = normalizeSymbol(symbolInput);

  if (!symbol) {
    return {
      status: "empty",
      message: "Enter a symbol to add.",
    };
  }

  if (includesSymbol(currentSymbols, symbol)) {
    return {
      status: "duplicate",
      symbol,
      message: `${symbol} is already in the watchlist. Selected existing symbol.`,
    };
  }

  const intake = await evaluateSymbolIntake(session, policy, symbol);

  if (!intake.accepted) {
    return {
      status: "rejected",
      symbol: intake.symbol,
      message: intake.message,
    };
  }

  return {
    status: "accepted",
    symbol: intake.symbol,
    quoteResult: await loadInitialQuote(intake.symbol),
  };
}
