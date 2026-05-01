import { type DataSource, type MarketDataSession, type SymbolIntakePolicy } from "../types";
import { FIXTURE_SYMBOLS, unsupportedSymbolMessage } from "../symbol-universe";
import { DatabentoExportMarketDataProvider } from "./databento-market-data";
import { ProviderMarketDataSession } from "./session-market-data";

export const DEFAULT_DATABENTO_FIXTURE_URL = "/data/databento-market-data.json";

export interface MarketDataSessionSelection {
  session: MarketDataSession;
  configuredSource: DataSource;
  symbolIntakePolicy: SymbolIntakePolicy;
}

export function createMarketDataSession(): MarketDataSessionSelection {
  const provider = new DatabentoExportMarketDataProvider({
    url: DEFAULT_DATABENTO_FIXTURE_URL,
  });

  return {
    session: new ProviderMarketDataSession(provider),
    configuredSource: "databento",
    symbolIntakePolicy: createFixtureSymbolIntakePolicy(),
  };
}

function createFixtureSymbolIntakePolicy(): SymbolIntakePolicy {
  return {
    fixtureSymbols: FIXTURE_SYMBOLS,
    unsupportedMessage: unsupportedSymbolMessage(),
  };
}
