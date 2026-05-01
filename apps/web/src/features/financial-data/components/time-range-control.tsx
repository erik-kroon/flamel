import RefreshCw from "lucide-solid/icons/refresh-cw";
import { For } from "solid-js";

import type { TimeRange } from "@/features/market-data/types";

const TIME_RANGES: TimeRange[] = ["1D", "1W", "1M"];

function moveFocusToRange(range: TimeRange) {
  document.querySelector<HTMLButtonElement>(`[data-time-range="${range}"]`)?.focus();
}

export function TimeRangeControl(props: {
  value: TimeRange;
  onChange(range: TimeRange): void;
  onRefresh(): void;
}) {
  const selectRange = (range: TimeRange) => {
    props.onChange(range);
    queueMicrotask(() => moveFocusToRange(range));
  };
  const onRangeKeyDown = (event: KeyboardEvent, range: TimeRange) => {
    const currentIndex = TIME_RANGES.indexOf(range);
    const next = (offset: number) =>
      TIME_RANGES[(currentIndex + offset + TIME_RANGES.length) % TIME_RANGES.length];
    let nextRange: TimeRange | undefined;

    switch (event.key) {
      case "ArrowLeft":
      case "ArrowUp":
        nextRange = next(-1);
        break;
      case "ArrowRight":
      case "ArrowDown":
        nextRange = next(1);
        break;
      case "Home":
        nextRange = TIME_RANGES[0];
        break;
      case "End":
        nextRange = TIME_RANGES[TIME_RANGES.length - 1];
        break;
    }

    if (nextRange) {
      event.preventDefault();
      selectRange(nextRange);
    }
  };

  return (
    <div class="flex items-center">
      <div
        aria-label="Chart time range"
        class="flex items-center gap-0.5 rounded border border-[var(--border-default)] bg-[var(--surface-input)] p-0.5 shadow-[inset_0_1px_0_rgb(255_255_255/0.035)]"
        role="group"
      >
        <For each={TIME_RANGES}>
          {(range) => (
            <button
              aria-pressed={props.value === range}
              aria-label={`Show ${range} price history`}
              class={`range-button h-8 rounded-sm px-3 text-sm font-medium focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--accent)] ${
                props.value === range
                  ? "bg-white/[0.12] text-[var(--text-primary)] shadow-[inset_0_1px_0_rgb(255_255_255/0.07),0_1px_6px_rgb(0_0_0/0.14)]"
                  : "text-[var(--text-secondary)] hover:bg-white/[0.045] hover:text-[var(--text-primary)]"
              }`}
              data-time-range={range}
              type="button"
              onClick={() => props.onChange(range)}
              onKeyDown={(event) => onRangeKeyDown(event, range)}
            >
              {range}
            </button>
          )}
        </For>
        <button
          aria-label="Refresh market data"
          class="range-refresh-button grid size-8 place-items-center rounded-sm text-[var(--text-faint)] hover:bg-white/[0.045] hover:text-[var(--text-primary)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--accent)]"
          type="button"
          title="Refresh"
          onClick={props.onRefresh}
        >
          <RefreshCw size={15} aria-hidden="true" strokeWidth={1.8} />
        </button>
      </div>
    </div>
  );
}
