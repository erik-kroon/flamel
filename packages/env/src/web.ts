import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const WEB_ENV_KEYS = {
  massiveApiKey: "VITE_MASSIVE_API_KEY",
} as const;

export interface WebRuntimeEnv extends Record<string, string | undefined> {
  VITE_MASSIVE_API_KEY?: string;
}

export interface WebEnv {
  massiveApiKey?: string;
}

const defaultRuntimeEnv = (import.meta as ImportMeta & { env?: WebRuntimeEnv }).env ?? {};

export function parseWebEnv(runtimeEnv: WebRuntimeEnv = defaultRuntimeEnv): WebEnv {
  const parsed = createEnv({
    clientPrefix: "VITE_",
    client: {
      VITE_MASSIVE_API_KEY: z.string().trim().optional(),
    },
    runtimeEnv,
    emptyStringAsUndefined: true,
  });

  return {
    massiveApiKey: parsed.VITE_MASSIVE_API_KEY,
  };
}

export const env = parseWebEnv();

export const webEnv = env;
