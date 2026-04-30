import type { ProviderSelection } from "@/features/market-data/providers/provider-factory";
import type { DataSource } from "@/features/market-data/types";

interface FinancialDataSourceCopy {
  sourceLabel: string;
  sourceDescription: string;
  fallbackReason?: string;
}

const SOURCE_COPY: Record<DataSource, Omit<FinancialDataSourceCopy, "fallbackReason">> = {
  massive: {
    sourceLabel: "Massive REST",
    sourceDescription: "Track equities, inspect quote details and review recent price movement.",
  },
  mock: {
    sourceLabel: "Offline review",
    sourceDescription: "Track equities, inspect quote details and review recent price movement.",
  },
};

export function financialDataSourceCopy(
  selection: Pick<ProviderSelection, "configuredSource" | "fallbackReason">,
): FinancialDataSourceCopy {
  return {
    ...SOURCE_COPY[selection.configuredSource],
    fallbackReason: selection.fallbackReason,
  };
}
