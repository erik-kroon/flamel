import { MarketDataNotFoundError, type EquitySymbol } from "./types";

export interface SymbolValidationResult {
  symbol: EquitySymbol;
  valid: boolean;
  reason?: string;
}

export function normalizeSymbol(symbol: string): EquitySymbol {
  return symbol.trim().toUpperCase();
}

export function hasSymbolInput(symbol: string) {
  return normalizeSymbol(symbol).length > 0;
}

export function includesSymbol(symbols: readonly EquitySymbol[], symbol: string) {
  const normalizedSymbol = normalizeSymbol(symbol);

  return symbols.some((existingSymbol) => normalizeSymbol(existingSymbol) === normalizedSymbol);
}

function isSymbolArray(
  supportedSymbols: ReadonlySet<EquitySymbol> | readonly EquitySymbol[],
): supportedSymbols is readonly EquitySymbol[] {
  return Array.isArray(supportedSymbols);
}

export function assertSupportedSymbol(
  symbol: string,
  supportedSymbols: ReadonlySet<EquitySymbol> | readonly EquitySymbol[],
): EquitySymbol {
  const normalizedSymbol = normalizeSymbol(symbol);
  const supported = isSymbolArray(supportedSymbols)
    ? includesSymbol(supportedSymbols, normalizedSymbol)
    : supportedSymbols.has(normalizedSymbol);

  if (!supported) {
    throw new MarketDataNotFoundError(normalizedSymbol || symbol);
  }

  return normalizedSymbol;
}

export function validateSupportedSymbol(
  symbol: string,
  supportedSymbols: ReadonlySet<EquitySymbol> | readonly EquitySymbol[],
): SymbolValidationResult {
  const normalizedSymbol = normalizeSymbol(symbol);

  try {
    assertSupportedSymbol(normalizedSymbol, supportedSymbols);
    return {
      symbol: normalizedSymbol,
      valid: true,
    };
  } catch (error) {
    return {
      symbol: normalizedSymbol,
      valid: false,
      reason:
        error instanceof Error ? error.message : `No market data found for ${normalizedSymbol}`,
    };
  }
}
