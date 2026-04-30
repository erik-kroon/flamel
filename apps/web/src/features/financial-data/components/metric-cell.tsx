import { Show } from "solid-js";

export function MetricCell(props: {
  label: string;
  value: string;
  subvalue?: string;
  positive?: boolean;
  loading?: boolean;
  priority?: "primary" | "strong" | "secondary";
}) {
  const priority = () => props.priority ?? "secondary";
  const valueTone = () => {
    if (props.loading) return "text-[var(--text-muted)]";
    if (priority() === "secondary") return "text-[var(--text-secondary)]";
    return "text-[var(--text-primary)]";
  };

  return (
    <div
      class={`min-w-0 border-l border-[color:rgb(255_255_255_/_4%)] px-3 first:border-l-0 sm:first:pl-0 ${
        priority() === "secondary" ? "opacity-90" : ""
      } ${
        priority() === "secondary"
          ? ""
          : "rounded-sm bg-white/[0.025] py-1 shadow-[inset_0_1px_0_rgb(255_255_255_/_3%)]"
      }`}
    >
      <p
        class={`metric-label min-h-4 overflow-hidden text-ellipsis whitespace-nowrap ${
          priority() === "secondary" ? "text-[var(--text-faint)]" : ""
        }`}
      >
        {props.label}
      </p>
      <p
        class={`financial-value mt-1 h-6 overflow-hidden text-ellipsis whitespace-nowrap ${
          priority() === "primary"
            ? "text-lg font-bold"
            : priority() === "strong"
              ? "text-lg font-semibold"
              : "text-[0.95rem] font-medium"
        } ${valueTone()}`}
      >
        {props.value}
      </p>
      <Show when={props.subvalue}>
        <p
          class={`financial-value mt-0.5 h-4 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-medium ${
            props.positive ? "text-[var(--positive)]" : "text-[var(--negative)]"
          }`}
        >
          {props.subvalue}
        </p>
      </Show>
    </div>
  );
}
