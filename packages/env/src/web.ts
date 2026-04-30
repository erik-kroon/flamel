import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const WEB_ENV_KEYS = {
  databentoApiKey: "VITE_DATABENTO_API_KEY",
  databentoExportUrl: "VITE_DATABENTO_EXPORT_URL",
  massiveApiKey: "VITE_MASSIVE_API_KEY",
} as const;

export interface WebRuntimeEnv extends Record<string, string | undefined> {
  VITE_DATABENTO_API_KEY?: string;
  VITE_DATABENTO_EXPORT_URL?: string;
  VITE_MASSIVE_API_KEY?: string;
}

export interface WebEnv {
  databentoApiKey?: string;
  databentoExportUrl?: string;
  massiveApiKey?: string;
}

const defaultRuntimeEnv = (import.meta as ImportMeta & { env?: WebRuntimeEnv }).env ?? {};

export function parseWebEnv(runtimeEnv: WebRuntimeEnv = defaultRuntimeEnv): WebEnv {
  const parsed = createEnv({
    clientPrefix: "VITE_",
    client: {
      VITE_DATABENTO_API_KEY: z.string().trim().optional(),
      VITE_DATABENTO_EXPORT_URL: z.string().trim().optional(),
      VITE_MASSIVE_API_KEY: z.string().trim().optional(),
    },
    runtimeEnv,
    emptyStringAsUndefined: true,
  });

  return {
    databentoApiKey: parsed.VITE_DATABENTO_API_KEY,
    databentoExportUrl: parsed.VITE_DATABENTO_EXPORT_URL,
    massiveApiKey: parsed.VITE_MASSIVE_API_KEY,
  };
}

export const env = parseWebEnv();

export const webEnv = env;
