import { For, Show } from "solid-js";

import { formatClock } from "@/lib/time";
import type { StreamEnvelope } from "@/protocol/events";

interface DebugDrawerProps {
  open: boolean;
  events: StreamEnvelope[];
}

export function DebugDrawer(props: DebugDrawerProps) {
  return (
    <Show when={props.open}>
      <section class="debug-drawer" aria-label="Debug drawer">
        <div class="panel-heading">
          <h2>Stream debug</h2>
          <a href="http://localhost:4000" target="_blank" rel="noreferrer">
            Open in Wiretap
          </a>
        </div>
        <div class="debug-grid">
          <For each={props.events.slice(0, 18)}>
            {(envelope) => (
              <div class="debug-row">
                <span>{formatClock(envelope.receivedAt)}</span>
                <span>#{envelope.sequence}</span>
                <strong>{envelope.event.type}</strong>
                <code>{JSON.stringify(envelope.event)}</code>
              </div>
            )}
          </For>
        </div>
      </section>
    </Show>
  );
}
