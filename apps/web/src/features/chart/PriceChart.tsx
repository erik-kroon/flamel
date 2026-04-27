import { For, Show } from "solid-js";

import { formatPrice } from "@/lib/format";
import type { ChartPoint } from "@/features/terminal/createTerminalModel";

interface PriceChartProps {
  points: ChartPoint[];
}

export function PriceChart(props: PriceChartProps) {
  const width = 680;
  const height = 250;
  const padding = 20;

  const bounds = () => {
    const prices = props.points.map((point) => point.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const spread = Math.max(0.01, max - min);
    return { min: min - spread * 0.15, max: max + spread * 0.15 };
  };

  const path = () => {
    if (props.points.length < 2) {
      return "";
    }

    const { min, max } = bounds();
    return props.points
      .map((point, index) => {
        const x = padding + (index / (props.points.length - 1)) * (width - padding * 2);
        const y = height - padding - ((point.price - min) / (max - min)) * (height - padding * 2);
        return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");
  };

  const last = () => props.points.at(-1);

  return (
    <section class="panel chart-panel" aria-label="Selected symbol chart">
      <div class="panel-heading">
        <h2>Price</h2>
        <span>{last() ? formatPrice(last()!.price) : "waiting for trades"}</span>
      </div>
      <div class="chart-frame">
        <Show
          when={props.points.length > 1}
          fallback={<div class="empty-chart">Waiting for selected-symbol trades</div>}
        >
          <svg
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label="Selected symbol price chart"
          >
            <For each={[0, 1, 2, 3]}>
              {(line) => {
                const y = padding + line * ((height - padding * 2) / 3);
                return (
                  <line x1={padding} x2={width - padding} y1={y} y2={y} class="chart-gridline" />
                );
              }}
            </For>
            <path class="chart-line-shadow" d={path()} />
            <path class="chart-line" d={path()} />
          </svg>
        </Show>
      </div>
    </section>
  );
}
