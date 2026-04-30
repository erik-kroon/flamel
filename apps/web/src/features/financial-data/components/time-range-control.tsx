import { RefreshCw } from "lucide-solid";
import { For } from "solid-js";

import type { TimeRange } from "@/features/market-data/types";

const TIME_RANGES: TimeRange[] = ["1D", "1W", "1M"];

export function TimeRangeControl(props: {
  value: TimeRange;
  onChange(range: TimeRange): void;
  onRefresh(): void;
}) {
  return (
    <div class="flex items-center gap-1.5">
      <div class="flex items-center gap-0.5 rounded border border-[var(--border-default)] bg-[var(--surface-input)] p-0.5 shadow-[inset_0_1px_0_rgb(255_255_255/0.035)]">
        <For each={TIME_RANGES}>
          {(range) => (
            <button
              aria-pressed={props.value === range}
              class={`range-button h-8 rounded-sm px-3 text-sm font-medium focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--accent)] ${
                props.value === range
                  ? "bg-white/[0.12] text-[var(--text-primary)] shadow-[inset_0_1px_0_rgb(255_255_255/0.07),0_1px_6px_rgb(0_0_0/0.14)]"
                  : "text-[var(--text-secondary)] hover:bg-white/[0.045] hover:text-[var(--text-primary)]"
              }`}
              type="button"
              onClick={() => props.onChange(range)}
            >
              {range}
            </button>
          )}
        </For>
      </div>
      <button
        class="range-refresh-button grid size-8 place-items-center rounded-sm border border-transparent text-[var(--text-faint)] hover:border-[var(--border-subtle)] hover:bg-white/[0.035] hover:text-[var(--text-secondary)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--accent)]"
        type="button"
        title="Refresh"
        onClick={props.onRefresh}
      >
        <RefreshCw size={15} aria-hidden="true" strokeWidth={1.8} />
      </button>
    </div>
  );
}
