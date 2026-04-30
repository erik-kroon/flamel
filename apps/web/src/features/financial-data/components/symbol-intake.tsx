import { Plus } from "lucide-solid";
import { Show } from "solid-js";

export function SymbolIntake(props: {
  value: string;
  error?: string;
  canSubmit: boolean;
  onInput(value: string): void;
  onSubmit(): void;
}) {
  return (
    <form
      class="mb-5 shrink-0"
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
          class="h-10 min-w-0 flex-1 bg-transparent px-3 text-sm font-semibold uppercase financial-value tracking-normal text-[var(--text-primary)] outline-none placeholder:font-medium placeholder:text-[var(--text-faint)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-3px] focus-visible:outline-[var(--accent)]"
          placeholder="AAPL"
          value={props.value}
          onInput={(event) => props.onInput(event.currentTarget.value)}
        />
        <button
          class="grid size-10 shrink-0 place-items-center border-l border-[var(--border-subtle)] text-[var(--accent)] transition hover:bg-[var(--surface-elevated)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:text-[var(--text-faint)]"
          type="submit"
          disabled={!props.canSubmit}
          title="Add symbol"
        >
          <Plus size={18} aria-hidden="true" />
        </button>
      </div>
      <Show when={props.error}>
        <p class="mt-2 min-h-8 border-l border-[color:var(--accent-border)] bg-[var(--accent-soft)] px-2.5 py-1.5 text-xs leading-5 text-[var(--text-secondary)]">
          {props.error}
        </p>
      </Show>
    </form>
  );
}
