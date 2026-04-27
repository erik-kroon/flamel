import { For, Show } from "solid-js";

import { formatMoney, formatPrice, formatQuantity, formatSignedMoney } from "@/lib/format";
import { formatAge } from "@/lib/time";
import type { PositionRow } from "@/features/terminal/createTerminalModel";

interface PositionsTableProps {
  positions: PositionRow[];
  realized: number;
  unrealized: number;
  exposure: number;
  now: number;
}

export function PositionsTable(props: PositionsTableProps) {
  return (
    <section class="panel positions-panel" aria-label="Portfolio and PnL">
      <div class="panel-heading">
        <h2>Portfolio / PnL</h2>
        <span>{formatMoney(props.exposure)} gross</span>
      </div>

      <div class="pnl-summary">
        <PnlBox
          label="Realized"
          value={formatSignedMoney(props.realized)}
          tone={props.realized >= 0 ? "up" : "down"}
        />
        <PnlBox
          label="Unrealized"
          value={formatSignedMoney(props.unrealized)}
          tone={props.unrealized >= 0 ? "up" : "down"}
        />
      </div>

      <Show
        when={props.positions.length > 0}
        fallback={<div class="empty-state">Positions appear after fills</div>}
      >
        <div class="positions-table">
          <div class="table-head positions-grid">
            <span>Symbol</span>
            <span>Qty</span>
            <span>Avg</span>
            <span>Mark</span>
            <span>uPnL</span>
          </div>
          <For each={props.positions}>
            {(position) => {
              const unrealized = () => (position.markPrice - position.avgEntry) * position.quantity;
              const stale = () => props.now - position.updatedAt > 3000;
              return (
                <div class="position-row positions-grid">
                  <span>
                    {position.symbol}
                    <small class={stale() ? "stale-text" : ""}>
                      {stale() ? "STALE " : ""}
                      {formatAge(position.updatedAt, props.now)}
                    </small>
                  </span>
                  <span>{formatQuantity(position.quantity)}</span>
                  <span>{formatPrice(position.avgEntry)}</span>
                  <span>{formatPrice(position.markPrice)}</span>
                  <strong class={unrealized() >= 0 ? "positive" : "negative"}>
                    {formatSignedMoney(unrealized())}
                  </strong>
                </div>
              );
            }}
          </For>
        </div>
      </Show>
    </section>
  );
}

function PnlBox(props: { label: string; value: string; tone: "up" | "down" }) {
  return (
    <div class={`pnl-box tone-${props.tone}`}>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}
