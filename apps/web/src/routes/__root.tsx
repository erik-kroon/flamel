import type { QueryClient } from "@tanstack/solid-query";
import { Outlet, createRootRouteWithContext } from "@tanstack/solid-router";

export interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
});

function RootComponent() {
  return <Outlet />;
}
