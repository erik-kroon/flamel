import { WEB_ENV_KEYS, webEnv, type WebEnv } from "@flamel/env/web";

import {
  type DataSource,
  MarketDataProviderError,
  type MarketDataSession,
} from "../types";
import {
  DatabentoExportMarketDataProvider,
  DatabentoMarketDataProvider,
  createDatabentoHistoricalClient,
} from "./databento-market-data";
import { FallbackMarketDataSession, ProviderMarketDataSession } from "./fallback-market-data";
import { MassiveMarketDataProvider, createMassiveRestClient } from "./massive-market-data";

export const DATABENTO_API_KEY_ENV = WEB_ENV_KEYS.databentoApiKey;
export const DATABENTO_EXPORT_URL_ENV = WEB_ENV_KEYS.databentoExportUrl;
export const MASSIVE_API_KEY_ENV = WEB_ENV_KEYS.massiveApiKey;
export const DEFAULT_DATABENTO_FIXTURE_URL = "/data/databento-market-data.json";

export interface ProviderSelection {
  session: MarketDataSession;
  configuredSource: DataSource;
}

export function createMarketDataProvider(env: WebEnv = webEnv): ProviderSelection {
  const databentoApiKey = env.databentoApiKey;
  const databentoExportUrl = env.databentoExportUrl;
  const massiveApiKey = env.massiveApiKey;

  if (!databentoExportUrl && !databentoApiKey && !massiveApiKey) {
    const provider = new DatabentoExportMarketDataProvider({
      url: DEFAULT_DATABENTO_FIXTURE_URL,
    });

    return {
      session: new ProviderMarketDataSession(provider, "primary"),
      configuredSource: "databento",
    };
  }

  const primary = databentoExportUrl
    ? new DatabentoExportMarketDataProvider({ url: databentoExportUrl })
    : databentoApiKey
      ? new DatabentoMarketDataProvider({
          client: createDatabentoHistoricalClient(databentoApiKey),
        })
      : createMassiveProvider(massiveApiKey);
  const fallback = new DatabentoExportMarketDataProvider({
    url: DEFAULT_DATABENTO_FIXTURE_URL,
  });

  return {
    session: new FallbackMarketDataSession(primary, fallback),
    configuredSource: primary.source,
  };
}

function createMassiveProvider(apiKey: string | undefined) {
  if (!apiKey) {
    throw new MarketDataProviderError(`${MASSIVE_API_KEY_ENV} is not configured.`);
  }

  return new MassiveMarketDataProvider({
    client: createMassiveRestClient(apiKey),
  });
}
