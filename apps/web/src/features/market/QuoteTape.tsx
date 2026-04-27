import { For } from "solid-js";

import { formatClock } from "@/lib/time";
import type { TapeRow } from "@/features/terminal/createTerminalModel";

interface QuoteTapeProps {
  rows: TapeRow[];
}

export function QuoteTape(props: QuoteTapeProps) {
  return (
    <section class="panel tape-panel" aria-label="Selected symbol event tape">
      <div class="panel-heading">
        <h2>Event tape</h2>
        <span>selected symbol</span>
      </div>
      <div class="tape-rows">
        <For each={props.rows}>
          {(row) => (
            <div class="tape-row">
              <span>{formatClock(row.receivedAt)}</span>
              <strong class={row.side ? `side-${row.side}` : ""}>{row.label}</strong>
              <span>{row.value}</span>
            </div>
          )}
        </For>
      </div>
    </section>
  );
}
