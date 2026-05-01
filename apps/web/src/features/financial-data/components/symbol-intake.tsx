import Plus from "lucide-solid/icons/plus";
import { createEffect, createMemo, createSignal, For, on, Show } from "solid-js";

import type { EquitySearchResult, EquitySymbol } from "@/features/market-data/types";

export function SymbolIntake(props: {
  value: string;
  error?: string;
  suggestions: EquitySearchResult[];
  suggestionMessage?: string;
  canSubmit: boolean;
  onInput(value: string): void;
  onSubmit(symbolInput?: string): void;
}) {
  const [focused, setFocused] = createSignal(false);
  const [highlightedIndex, setHighlightedIndex] = createSignal(0);
  const hasDropdownContent = createMemo(
    () => props.suggestions.length > 0 || Boolean(props.suggestionMessage),
  );
  const showDropdown = createMemo(() => focused() && hasDropdownContent());

  createEffect(
    on(
      () => [props.value, props.suggestions.length],
      () => setHighlightedIndex(0),
    ),
  );

  const selectSuggestion = (symbol: EquitySymbol) => {
    props.onSubmit(symbol);
    setFocused(false);
  };

  return (
    <form
      class="relative mb-5 shrink-0"
      onSubmit={(event) => {
        event.preventDefault();
        props.onSubmit();
      }}
    >
      <label class="section-label mb-2 block text-[var(--text-muted)]" for="symbol-input">
        Add symbol
      </label>
      <div class="symbol-input-shell flex min-w-0 overflow-hidden rounded border border-[var(--border-subtle)] bg-[var(--surface-input)] shadow-[inset_0_1px_0_rgb(255_255_255/0.025)] focus-within:border-[var(--accent-border)] focus-within:bg-[var(--surface-panel)] focus-within:ring-1 focus-within:ring-[var(--accent-border)]">
        <input
          id="symbol-input"
          aria-describedby={props.error ? "symbol-input-error" : undefined}
          aria-invalid={props.error ? "true" : "false"}
          role="combobox"
          class="h-10 min-w-0 flex-1 bg-transparent px-3 text-sm font-semibold uppercase financial-value tracking-normal text-[var(--text-primary)] outline-none placeholder:font-medium placeholder:text-[var(--text-faint)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-3px] focus-visible:outline-[var(--accent)]"
          placeholder="AAPL"
          value={props.value}
          autocomplete="off"
          aria-autocomplete="list"
          aria-controls={showDropdown() ? "symbol-suggestions" : undefined}
          aria-expanded={showDropdown() ? "true" : "false"}
          onInput={(event) => props.onInput(event.currentTarget.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(event) => {
            if (!showDropdown()) {
              return;
            }

            if (event.key === "Escape") {
              event.preventDefault();
              setFocused(false);
              return;
            }

            if (props.suggestions.length === 0) {
              return;
            }

            if (event.key === "ArrowDown") {
              event.preventDefault();
              setHighlightedIndex((index) => (index + 1) % props.suggestions.length);
              return;
            }

            if (event.key === "ArrowUp") {
              event.preventDefault();
              setHighlightedIndex(
                (index) => (index - 1 + props.suggestions.length) % props.suggestions.length,
              );
              return;
            }

            if (event.key === "Enter") {
              event.preventDefault();
              selectSuggestion(props.suggestions[highlightedIndex()].symbol);
            }
          }}
        />
        <button
          class="grid size-10 shrink-0 place-items-center border-l border-[var(--border-subtle)] text-[var(--accent)] transition enabled:hover:bg-[var(--surface-elevated)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--accent)] disabled:text-[var(--text-faint)]"
          type="submit"
          disabled={!props.canSubmit}
        >
          <Plus size={18} aria-hidden="true" />
        </button>
      </div>
      <Show when={showDropdown()}>
        <div
          id="symbol-suggestions"
          class="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded border border-[var(--border-subtle)] bg-[var(--surface-panel)] shadow-xl shadow-black/30"
          role="listbox"
        >
          <Show
            when={props.suggestions.length > 0}
            fallback={
              <p class="px-3 py-2 text-xs leading-5 text-[var(--text-muted)]">
                {props.suggestionMessage}
              </p>
            }
          >
            <For each={props.suggestions}>
              {(suggestion, index) => (
                <button
                  aria-selected={highlightedIndex() === index() ? "true" : "false"}
                  class="grid w-full grid-cols-[4.5rem_minmax(0,1fr)] gap-2 px-3 py-2 text-left text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--accent)] aria-selected:bg-[var(--surface-elevated)]"
                  role="option"
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setHighlightedIndex(index())}
                  onClick={() => selectSuggestion(suggestion.symbol)}
                >
                  <span class="financial-value font-semibold tracking-normal text-[var(--text-primary)]">
                    {suggestion.symbol}
                  </span>
                  <span class="min-w-0 truncate">{suggestion.name}</span>
                </button>
              )}
            </For>
          </Show>
        </div>
      </Show>
      <Show when={props.error}>
        <p
          aria-live="polite"
          class="mt-2 min-h-8 border-l border-[color:var(--accent-border)] bg-[var(--accent-soft)] px-2.5 py-1.5 text-xs leading-5 text-[var(--text-secondary)]"
          id="symbol-input-error"
          role="status"
        >
          {props.error}
        </p>
      </Show>
    </form>
  );
}
