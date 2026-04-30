import { createFileRoute } from "@tanstack/solid-router";

import { preloadDefaultFinancialData } from "@/features/financial-data/queries";
import { FinancialDataWorkspace } from "../features/financial-data/workspace";

export const Route = createFileRoute("/")({
  loader: ({ context }) => {
    preloadDefaultFinancialData(context.queryClient);
  },
  component: App,
});

function App() {
  return <FinancialDataWorkspace />;
}
