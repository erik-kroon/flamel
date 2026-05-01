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
    if (priority() === "strong") {
      return props.positive ? "text-[var(--positive)]" : "text-[var(--negative)]";
    }
    if (priority() === "secondary") return "text-[var(--text-muted)]";
    return "text-[var(--text-primary)]";
  };

  return (
    <div
      class={`min-w-0 border-l border-[color:rgb(255_255_255_/_2.5%)] px-3 first:border-l-0 sm:first:pl-0 ${
        priority() === "secondary" ? "opacity-70" : "py-0.5"
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
            ? "text-[1.35rem] font-bold"
            : priority() === "strong"
              ? "text-[1.0625rem] font-bold"
              : "text-[0.875rem] font-medium"
        } ${valueTone()}`}
      >
        {props.value}
      </p>
      <Show when={props.subvalue}>
        <p
          class={`financial-value mt-0.5 h-4 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-semibold ${
            props.positive ? "text-[var(--positive)]" : "text-[var(--negative)]"
          }`}
        >
          {props.subvalue}
        </p>
      </Show>
    </div>
  );
}
