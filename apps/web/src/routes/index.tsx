import { createFileRoute } from "@tanstack/solid-router";

import { Dashboard } from "@/features/terminal/Dashboard";

export const Route = createFileRoute("/")({
  component: App,
});

function App() {
  return <Dashboard />;
}
