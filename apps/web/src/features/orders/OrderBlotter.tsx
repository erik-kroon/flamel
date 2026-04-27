import { For, Show } from "solid-js";

import { formatPrice, formatQuantity } from "@/lib/format";
import { formatClock } from "@/lib/time";
import type { OrderRow } from "@/features/terminal/createTerminalModel";

interface OrderBlotterProps {
  orders: OrderRow[];
}

export function OrderBlotter(props: OrderBlotterProps) {
  return (
    <section class="panel blotter-panel" aria-label="Order blotter">
      <div class="panel-heading">
        <h2>Blotter</h2>
        <span>{props.orders.length} orders</span>
      </div>
      <Show
        when={props.orders.length > 0}
        fallback={<div class="empty-state">No order intent submitted</div>}
      >
        <div class="blotter-rows">
          <For each={props.orders.slice(0, 9)}>
            {(order) => (
              <article class="blotter-row">
                <div class="blotter-main">
                  <strong>{order.id}</strong>
                  <span class={`status-badge status-${order.status}`}>{order.status}</span>
                </div>
                <div class="blotter-detail">
                  <span class={`side-${order.side}`}>{order.side.toUpperCase()}</span>
                  <span>{formatQuantity(order.quantity)}</span>
                  <span>{order.symbol}</span>
                  <span>{order.kind}</span>
                  <span>
                    {order.fillPrice
                      ? formatPrice(order.fillPrice)
                      : order.limitPrice
                        ? formatPrice(order.limitPrice)
                        : "touch"}
                  </span>
                </div>
                <div class="timeline">
                  <For each={order.timeline.slice(0, 4)}>
                    {(entry) => (
                      <span>
                        {formatClock(entry.receivedAt)} {entry.status}
                        {entry.reason ? `:${entry.reason}` : ""}
                      </span>
                    )}
                  </For>
                </div>
              </article>
            )}
          </For>
        </div>
      </Show>
    </section>
  );
}
