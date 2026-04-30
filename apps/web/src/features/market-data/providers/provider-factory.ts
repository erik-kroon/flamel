import { WEB_ENV_KEYS, webEnv, type WebEnv } from "@flamel/env/web";

import { type DataSource, type MarketDataProvider, type MarketDataSession } from "../types";
import {
  FallbackMarketDataProvider,
  FallbackMarketDataSession,
  ProviderMarketDataSession,
} from "./fallback-market-data";
import { MassiveMarketDataProvider, createMassiveRestClient } from "./massive-market-data";
import { MockMarketDataProvider } from "./mock-market-data";

export const MASSIVE_API_KEY_ENV = WEB_ENV_KEYS.massiveApiKey;

export interface ProviderSelection {
  provider: MarketDataProvider;
  session: MarketDataSession;
  configuredSource: DataSource;
  fallbackReason?: string;
}

export function createMarketDataProvider(env: WebEnv = webEnv): ProviderSelection {
  const apiKey = env.massiveApiKey;

  if (!apiKey) {
    const fallbackReason = `${MASSIVE_API_KEY_ENV} is not configured.`;
    const provider = new MockMarketDataProvider();

    return {
      provider,
      session: new ProviderMarketDataSession(provider, "fallback", fallbackReason),
      configuredSource: "mock",
      fallbackReason,
    };
  }

  const primary = new MassiveMarketDataProvider({
    client: createMassiveRestClient(apiKey),
  });
  const fallback = new MockMarketDataProvider();

  return {
    provider: new FallbackMarketDataProvider(primary, fallback),
    session: new FallbackMarketDataSession(primary, fallback),
    configuredSource: "massive",
  };
}
