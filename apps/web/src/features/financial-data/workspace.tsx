import { AlertTriangle, X } from "lucide-solid";
import { createMemo, createSignal, For, Show } from "solid-js";

import {
  formatCompactNumber,
  formatMarketAxisPrice,
  formatMarketChartTime,
  formatMarketTimestamp,
  formatMoney,
  formatSignedPercent,
} from "@/features/market-display/formatting";

import { chartTooltipPosition } from "./chart-annotations";
import { MetricCell } from "./components/metric-cell";
import { SymbolIntake } from "./components/symbol-intake";
import { TimeRangeControl } from "./components/time-range-control";
import {
  freshnessStateLabel,
  createPriceHistoryDisplayLabels,
  marketSessionLabel,
  sourceLabel,
  transportLabel,
  watchlistStatusLabel,
} from "./display-labels";
import { createFinancialDataWorkspace } from "./model";
import {
  createPriceHistoryViewModel,
  VOLUME_AREA_BOTTOM,
  VOLUME_AREA_TOP,
} from "./price-history-view-model";

const POSITIVE_CHART_COLOR = "var(--positive)";
const NEGATIVE_CHART_COLOR = "var(--negative-chart)";

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

function formatSignedMoney(value: number, currency?: string) {
  const formatted = formatMoney(Math.abs(value), currency);
  return `${value >= 0 ? "+" : "-"}${formatted}`;
}

function focusWatchlistSymbol(symbol: string) {
  document.querySelector<HTMLButtonElement>(`[data-watchlist-symbol="${symbol}"]`)?.focus();
}

function chartOverlayX(x: number) {
  return `${clampPercent(x)}%`;
}

function chartBandCenterX(band: { left: number; width: number }) {
  return chartOverlayX(band.left + band.width / 2);
}

export { createFinancialDataWorkspace } from "./model";
export { preloadDefaultFinancialData } from "./queries";
export type { FinancialDataWorkspaceViewModel } from "./types";

export function FinancialDataWorkspace() {
  const workspace = createFinancialDataWorkspace();
  const [hoveredPointIndex, setHoveredPointIndex] = createSignal<number>();
  const selected = () => workspace.selectedEquity;
  const quote = () => selected().quote;
  const selectedSource = () => quote()?.source ?? workspace.dataSource;
  const positive = () => (quote()?.change ?? 0) >= 0;
  const hasFundamentals = createMemo(() => {
    const currentQuote = quote();

    return currentQuote?.marketCap !== undefined || currentQuote?.peRatio !== undefined;
  });
  const rangePositive = () => (chart().rangeMove ?? 0) >= 0;
  const chartToneColor = () => (rangePositive() ? POSITIVE_CHART_COLOR : NEGATIVE_CHART_COLOR);
  const freshnessLabel = () =>
    freshnessStateLabel(selected().quoteStatus, selected().stale, selectedSource());
  const dayRangePosition = () => {
    const currentQuote = quote();
    if (!currentQuote || currentQuote.high <= currentQuote.low) return 50;

    return clampPercent(
      ((currentQuote.lastPrice - currentQuote.low) / (currentQuote.high - currentQuote.low)) * 100,
    );
  };
  const gapPercent = () => {
    const currentQuote = quote();
    if (!currentQuote || currentQuote.previousClose === 0) return 0;

    return ((currentQuote.open - currentQuote.previousClose) / currentQuote.previousClose) * 100;
  };
  const chart = createMemo(() =>
    createPriceHistoryViewModel({
      points: selected().history,
      quote: quote(),
      range: workspace.timeRange,
      source: selectedSource(),
    }),
  );
  const chartLabels = createMemo(() =>
    createPriceHistoryDisplayLabels({
      chart: chart(),
      range: workspace.timeRange,
      source: selectedSource(),
      formatTimeLabel: formatMarketChartTime,
    }),
  );
  const hoveredPoint = createMemo(() => {
    const index = hoveredPointIndex();
    if (index === undefined) return undefined;

    return chart().normalized[index];
  });
  const hoveredReturnVsPreviousClose = createMemo(() => {
    const point = hoveredPoint();
    return point ? chart().returnVsPreviousClose(point) : undefined;
  });
  const chartKeyboardLabel = createMemo(() => {
    const currentChart = chart();
    const rangeMove =
      currentChart.rangeMove === undefined
        ? "pending"
        : formatSignedPercent(currentChart.rangeMove);
    const lastValue = quote()
      ? formatMoney(quote()!.lastPrice, quote()!.currency)
      : currentChart.metadata.last
        ? formatMarketAxisPrice(currentChart.metadata.last.value, quote()?.currency, 2)
        : "pending";

    return `${selected().symbol} ${workspace.timeRange} price history. Last ${lastValue}. Range return ${rangeMove}. ${chartLabels().countLabel}.`;
  });
  const selectedWatchlistIndex = () =>
    Math.max(
      0,
      workspace.watchlist.findIndex((item) => item.selected),
    );
  const moveWatchlistSelection = (index: number) => {
    const item = workspace.watchlist[index];
    if (!item) return;

    workspace.selectSymbol(item.symbol);
    queueMicrotask(() => focusWatchlistSymbol(item.symbol));
  };
  const onWatchlistKeyDown = (event: KeyboardEvent) => {
    const lastIndex = workspace.watchlist.length - 1;
    if (lastIndex < 0) return;

    let nextIndex: number | undefined;
    switch (event.key) {
      case "ArrowUp":
        nextIndex = Math.max(0, selectedWatchlistIndex() - 1);
        break;
      case "ArrowDown":
        nextIndex = Math.min(lastIndex, selectedWatchlistIndex() + 1);
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = lastIndex;
        break;
    }

    if (nextIndex !== undefined) {
      event.preventDefault();
      moveWatchlistSelection(nextIndex);
    }
  };
  const onChartKeyDown = (event: KeyboardEvent) => {
    const points = chart().normalized;
    if (points.length === 0) return;

    const currentIndex = hoveredPointIndex() ?? points.length - 1;
    let nextIndex: number | undefined;
    switch (event.key) {
      case "ArrowLeft":
      case "ArrowDown":
        nextIndex = Math.max(0, currentIndex - 1);
        break;
      case "ArrowRight":
      case "ArrowUp":
        nextIndex = Math.min(points.length - 1, currentIndex + 1);
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = points.length - 1;
        break;
      case "Escape":
        event.preventDefault();
        setHoveredPointIndex(undefined);
        return;
    }

    if (nextIndex !== undefined) {
      event.preventDefault();
      setHoveredPointIndex(nextIndex);
    }
  };

  return (
    <>
      <a class="skip-link" href="#price-history-chart">
        Skip to chart
      </a>
      <main
        class="h-dvh min-h-0 w-full overflow-x-hidden overflow-y-auto bg-[var(--surface-app)] text-[var(--text-primary)] xl:overflow-hidden"
        id="financial-data-content"
      >
        <section class="grid min-h-full w-full min-w-0 gap-0 lg:grid-cols-[284px_minmax(0,1fr)] xl:h-full xl:min-h-0 xl:grid-cols-[284px_minmax(0,1fr)_264px] 2xl:grid-cols-[310px_minmax(0,1fr)_284px]">
          <aside
            aria-label="Watchlist"
            class="flex min-h-0 min-w-0 flex-col border-b border-white/10 p-4 lg:border-b-0 lg:border-r lg:border-white/10 lg:px-5 lg:py-4 xl:overflow-hidden"
          >
            <div class="-mx-4 mb-4 shrink-0 border-b border-[var(--border-hairline)] px-4 pb-3.5 lg:-mx-5 lg:px-5">
              <div class="flex min-w-0 items-center gap-2.5">
                <img
                  alt=""
                  aria-hidden="true"
                  class="size-6 shrink-0"
                  height="24"
                  src="/flamel-logo.svg"
                  width="24"
                />
                <h1 class="min-w-0 text-2xl font-semibold leading-7 tracking-normal">Flamel</h1>
              </div>
            </div>

            <SymbolIntake
              value={workspace.symbolInput}
              error={workspace.intakeError}
              suggestions={workspace.symbolSuggestions}
              suggestionMessage={workspace.symbolSuggestionMessage}
              canSubmit={workspace.canAddSymbol}
              onInput={(value) => workspace.setSymbolInput(value)}
              onSubmit={(symbolInput) => void workspace.addSymbol(symbolInput)}
            />

            <div class="section-label mb-2 grid shrink-0 grid-cols-1 gap-4 px-2 text-[var(--text-muted)] sm:grid-cols-[minmax(0,1fr)_minmax(104px,auto)]">
              <span>Symbol</span>
              <span class="hidden text-right sm:block">Last / Move</span>
            </div>
            <div
              aria-label="Symbols"
              class="-mx-4 min-h-0 divide-y divide-[var(--border-hairline)] overflow-y-auto border-y border-[var(--border-subtle)] lg:-mx-5"
              onKeyDown={onWatchlistKeyDown}
            >
              <For each={workspace.watchlist}>
                {(item) => (
                  <div
                    data-selected={item.selected}
                    class={`watchlist-row group grid h-14 w-full grid-cols-[minmax(0,1fr)_2.5rem] items-center text-sm ${
                      item.selected ? "text-[var(--accent)]" : "text-[var(--text-secondary)]"
                    }`}
                  >
                    <button
                      aria-label={`${item.symbol}, ${item.quote?.name ?? watchlistStatusLabel(item.status, item.source)}${item.quote ? `, ${formatMoney(item.quote.lastPrice, item.quote.currency)}, ${formatSignedPercent(item.quote.changePercent)}` : ""}`}
                      aria-current={item.selected ? "true" : undefined}
                      data-watchlist-symbol={item.symbol}
                      class="grid h-full min-w-0 grid-cols-1 items-center gap-4 px-6 py-2 text-left focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--accent)] sm:grid-cols-[minmax(0,1fr)_minmax(104px,auto)] lg:pl-7 lg:pr-3"
                      tabIndex={item.selected ? 0 : -1}
                      type="button"
                      onClick={() => workspace.selectSymbol(item.symbol)}
                    >
                      <span class="grid min-w-0 overflow-hidden">
                        <span class="flex min-w-0 items-baseline gap-2">
                          <span class="truncate font-semibold financial-value tracking-normal text-[var(--text-primary)]">
                            {item.symbol}
                          </span>
                          <span class="truncate text-[0.6875rem] font-medium financial-value text-[var(--text-muted)]">
                            {item.quote?.exchange ? `· ${item.quote.exchange}` : ""}
                          </span>
                        </span>
                        <span
                          class="mt-0.5 block min-w-0 truncate text-[0.6875rem] leading-4 text-[var(--text-muted)]"
                          title={item.quote?.name ?? watchlistStatusLabel(item.status, item.source)}
                        >
                          {item.quote?.name ?? watchlistStatusLabel(item.status, item.source)}
                        </span>
                      </span>
                      <span class="hidden min-w-[104px] text-right financial-value sm:block">
                        <span class="block font-semibold leading-5 text-[var(--text-primary)]">
                          {item.quote
                            ? formatMoney(item.quote.lastPrice, item.quote.currency)
                            : watchlistStatusLabel(item.status, item.source)}
                        </span>
                        <span
                          class={`mt-0.5 block text-xs leading-4 ${(item.quote?.changePercent ?? 0) >= 0 ? "text-[var(--positive)]" : "text-[var(--negative)]"}`}
                        >
                          {item.quote
                            ? formatSignedPercent(item.quote.changePercent)
                            : item.error
                              ? "Error"
                              : ""}
                        </span>
                      </span>
                    </button>
                    <button
                      aria-label={`Remove ${item.symbol} from watchlist`}
                      class="watchlist-remove-button mr-3 grid size-7 place-items-center text-[var(--text-faint)] transition hover:bg-[var(--negative-soft)] hover:text-[var(--negative)] focus-visible:bg-[var(--surface-elevated)] focus-visible:text-[var(--negative)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--accent)]"
                      title={`Remove ${item.symbol}`}
                      type="button"
                      onClick={() => workspace.removeSymbol(item.symbol)}
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  </div>
                )}
              </For>
            </div>
          </aside>

          <Show
            when={workspace.selectedEquity.symbol}
            fallback={
              <div class="flex min-h-[360px] min-w-0 flex-col items-center justify-center py-12 text-center lg:min-h-0 lg:px-6 lg:py-0">
                <div class="max-w-sm border-y border-[var(--border-subtle)] px-6 py-8">
                  <p class="text-sm font-semibold text-[var(--text-secondary)]">
                    No symbol selected
                  </p>
                  <p class="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                    Select a symbol from the watchlist or add one above.
                  </p>
                </div>
              </div>
            }
          >
            <div class="flex min-h-0 min-w-0 max-w-[calc(100vw-2rem)] flex-col p-4 lg:max-w-none lg:px-6 lg:py-4 xl:overflow-hidden">
              <div class="mb-4 flex flex-wrap items-start justify-between gap-4">
                <div class="min-w-0">
                  <div class="mb-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs font-medium text-[var(--text-muted)]">
                    <span class="financial-value text-sm font-semibold tracking-normal text-[var(--text-secondary)]">
                      {selected().symbol}
                    </span>
                    <span>·</span>
                    <span>{quote()?.exchange ?? "Market pending"}</span>
                    <span>·</span>
                    <span>{quote()?.currency ?? "USD"}</span>
                    <span>·</span>
                    <span>Equity</span>
                    <span class="ml-1 rounded-sm bg-[rgba(244,246,248,0.04)] px-1.5 py-0.5 text-[11px] font-medium leading-4 text-[var(--text-faint)]">
                      {freshnessLabel()}
                    </span>
                  </div>
                  <h2 class="max-w-3xl truncate text-[1.625rem] font-semibold leading-tight tracking-normal md:text-[2rem]">
                    {quote()?.name ?? selected().symbol}
                  </h2>
                  <div class="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs font-medium text-[var(--text-faint)]">
                    <span>{marketSessionLabel(quote()?.updatedAt)}</span>
                    <span>·</span>
                    <span>{sourceLabel(selectedSource())}</span>
                    <span>·</span>
                    <span>Updated {formatMarketTimestamp(quote()?.updatedAt)}</span>
                  </div>
                </div>
                <TimeRangeControl
                  value={workspace.timeRange}
                  onChange={(range) => workspace.setTimeRange(range)}
                  onRefresh={() => workspace.refresh()}
                />
              </div>

              <Show when={workspace.providerError}>
                <div class="mb-4 flex items-start gap-3 border border-[color:var(--negative-border)] bg-[color:var(--negative-soft)] p-3 text-sm leading-5 text-[var(--negative)]">
                  <AlertTriangle class="mt-0.5 shrink-0" size={18} aria-hidden="true" />
                  <p>{workspace.providerError}</p>
                </div>
              </Show>

              <div class="numeric -mx-4 mb-3 grid min-w-0 grid-cols-2 gap-x-0 gap-y-4 border-y border-[color:rgb(255_255_255_/_3%)] bg-white/[0.008] px-4 py-3 sm:grid-cols-4 lg:-mx-6 lg:px-6 2xl:grid-cols-6">
                <MetricCell
                  label="Last"
                  value={quote() ? formatMoney(quote()!.lastPrice, quote()!.currency) : "Loading"}
                  loading={!quote()}
                  priority="primary"
                />
                <MetricCell
                  label="Change"
                  value={
                    quote() ? formatSignedMoney(quote()!.change, quote()!.currency) : "Pending"
                  }
                  subvalue={quote() ? formatSignedPercent(quote()!.changePercent) : undefined}
                  positive={positive()}
                  loading={!quote()}
                  priority="strong"
                />
                <For
                  each={
                    [
                      ["Open", quote()?.open],
                      ["High", quote()?.high],
                      ["Low", quote()?.low],
                      ["Prev close", quote()?.previousClose],
                    ] as const
                  }
                >
                  {([label, value]) => (
                    <MetricCell
                      label={label}
                      value={
                        value === undefined ? "Pending" : formatMoney(value, quote()?.currency)
                      }
                      loading={value === undefined}
                    />
                  )}
                </For>
              </div>

              <section aria-label="Price history" class="flex min-h-0 min-w-0 flex-1 flex-col">
                <div class="mb-2 grid gap-2 sm:flex sm:flex-wrap sm:items-start sm:justify-between sm:gap-x-5 sm:gap-y-2">
                  <div class="min-w-0">
                    <p class="text-sm font-medium text-[var(--text-secondary)]">Price history</p>
                    <p class="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                      {workspace.timeRange} · {chartLabels().session} · {chartLabels().granularity}{" "}
                      · ET
                    </p>
                  </div>
                  <div class="min-w-0 text-left sm:text-right">
                    <p class="text-sm font-medium text-[var(--text-secondary)]">
                      Range{" "}
                      <span
                        class={`financial-value ${
                          (chart().rangeMove ?? 0) >= 0
                            ? "text-[var(--positive)]"
                            : "text-[var(--negative)]"
                        }`}
                      >
                        {chart().rangeMove === undefined
                          ? "Pending"
                          : formatSignedPercent(chart().rangeMove ?? 0)}
                      </span>
                    </p>
                    <p class="mt-0.5 text-xs text-[var(--text-muted)]">
                      {chartLabels().countLabel}
                    </p>
                  </div>
                </div>
                <p class="sr-only" id="price-history-keyboard-help">
                  Focus the chart, then use Left and Right arrows to move between price points. Use
                  Home and End to jump to the first or latest point.
                </p>
                <div
                  aria-describedby="price-history-keyboard-help"
                  aria-label={chartKeyboardLabel()}
                  class="relative h-[330px] min-h-[270px] w-full min-w-0 overflow-hidden bg-[var(--surface-panel)] p-4 pb-7 pr-10 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--accent)] sm:pr-32 xl:h-auto xl:flex-1"
                  id="price-history-chart"
                  role="img"
                  tabIndex={0}
                  onBlur={() => setHoveredPointIndex(undefined)}
                  onFocus={() => {
                    if (hoveredPointIndex() === undefined && chart().normalized.length > 0) {
                      setHoveredPointIndex(chart().normalized.length - 1);
                    }
                  }}
                  onKeyDown={onChartKeyDown}
                >
                  <svg
                    aria-hidden="true"
                    class="relative h-full w-full overflow-visible"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    onMouseLeave={() => setHoveredPointIndex(undefined)}
                    onMouseMove={(event) => {
                      const points = chart().normalized;
                      if (points.length === 0) return;

                      const bounds = event.currentTarget.getBoundingClientRect();
                      const x = ((event.clientX - bounds.left) / bounds.width) * 100;
                      const closestIndex = chart().nearestPointIndex(x);
                      if (closestIndex !== hoveredPointIndex()) {
                        setHoveredPointIndex(closestIndex);
                      }
                    }}
                  >
                    <Show when={chart().preMarketBand}>
                      {(band) => (
                        <rect
                          x={band().left}
                          y="8"
                          width={band().width}
                          height="90"
                          fill="rgb(90 215 242)"
                          opacity="0.024"
                        />
                      )}
                    </Show>
                    <Show when={chart().afterHoursBand}>
                      {(band) => (
                        <rect
                          x={band().left}
                          y="8"
                          width={band().width}
                          height="90"
                          fill="rgb(90 215 242)"
                          opacity="0.028"
                        />
                      )}
                    </Show>
                    <For each={chart().timeSeparators}>
                      {(separator) => (
                        <line
                          x1={separator.x}
                          x2={separator.x}
                          y1="8"
                          y2={VOLUME_AREA_BOTTOM}
                          stroke="rgb(255 255 255)"
                          stroke-opacity="0.039"
                          stroke-dasharray="2 5"
                          stroke-width="0.35"
                          vector-effect="non-scaling-stroke"
                        />
                      )}
                    </For>
                    <For each={chart().axis}>
                      {(axis) => (
                        <line
                          x1="0"
                          x2="100"
                          y1={axis.top}
                          y2={axis.top}
                          stroke="rgb(255 255 255)"
                          stroke-opacity="0.02"
                          stroke-width="0.35"
                          vector-effect="non-scaling-stroke"
                        />
                      )}
                    </For>
                    <line
                      x1="0"
                      x2="100"
                      y1={chart().currentY}
                      y2={chart().currentY}
                      stroke={chartToneColor()}
                      stroke-opacity="0.32"
                      stroke-dasharray="3 4"
                      stroke-width="0.55"
                      vector-effect="non-scaling-stroke"
                    />
                    <Show when={chart().previousCloseY !== undefined}>
                      <line
                        x1="0"
                        x2="100"
                        y1={chart().previousCloseY}
                        y2={chart().previousCloseY}
                        stroke="rgb(90 215 242)"
                        stroke-opacity="0.28"
                        stroke-dasharray="2 4"
                        stroke-width="0.5"
                        vector-effect="non-scaling-stroke"
                      />
                    </Show>
                    <Show when={chart().openY !== undefined}>
                      <line
                        x1="0"
                        x2="100"
                        y1={chart().openY}
                        y2={chart().openY}
                        stroke="rgb(161 167 174)"
                        stroke-opacity="0.18"
                        stroke-dasharray="1 4"
                        stroke-width="0.45"
                        vector-effect="non-scaling-stroke"
                      />
                    </Show>
                    <Show when={chart().openX !== undefined}>
                      <line
                        x1={chart().openX}
                        x2={chart().openX}
                        y1="6"
                        y2={VOLUME_AREA_BOTTOM}
                        stroke="rgb(255 255 255)"
                        stroke-opacity="0.11"
                        stroke-dasharray="2 4"
                        stroke-width="0.45"
                        vector-effect="non-scaling-stroke"
                      />
                    </Show>
                    <Show when={chart().closeX !== undefined}>
                      <line
                        x1={chart().closeX}
                        x2={chart().closeX}
                        y1="6"
                        y2={VOLUME_AREA_BOTTOM}
                        stroke="rgb(255 255 255)"
                        stroke-opacity="0.1"
                        stroke-dasharray="2 4"
                        stroke-width="0.45"
                        vector-effect="non-scaling-stroke"
                      />
                    </Show>
                    <path
                      d={chart().path}
                      fill="none"
                      stroke={chartToneColor()}
                      stroke-opacity="0.14"
                      stroke-width="3.7"
                      vector-effect="non-scaling-stroke"
                    />
                    <path
                      d={chart().path}
                      fill="none"
                      stroke={chartToneColor()}
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2.1"
                      vector-effect="non-scaling-stroke"
                    />
                    <Show when={chart().hasVolume}>
                      <line
                        x1="0"
                        x2="100"
                        y1={VOLUME_AREA_TOP - 2}
                        y2={VOLUME_AREA_TOP - 2}
                        stroke="rgb(255 255 255)"
                        stroke-opacity="0.039"
                        stroke-width="0.35"
                        vector-effect="non-scaling-stroke"
                      />
                      <For each={chart().volumeBars}>
                        {(bar) => (
                          <rect
                            x={bar.x}
                            y={bar.y}
                            width={bar.width}
                            height={bar.height}
                            fill={chartToneColor()}
                            opacity="0.056"
                          />
                        )}
                      </For>
                    </Show>
                    <Show when={hoveredPoint()}>
                      {(point) => (
                        <>
                          <line
                            x1={point().x}
                            x2={point().x}
                            y1="6"
                            y2={VOLUME_AREA_BOTTOM}
                            stroke="rgb(244 246 248)"
                            stroke-opacity="0.2"
                            stroke-width="0.45"
                            vector-effect="non-scaling-stroke"
                          />
                          <line
                            x1="0"
                            x2="100"
                            y1={point().y}
                            y2={point().y}
                            stroke="rgb(244 246 248)"
                            stroke-opacity="0.1"
                            stroke-width="0.4"
                            vector-effect="non-scaling-stroke"
                          />
                          <circle
                            cx={point().x}
                            cy={point().y}
                            r="0.85"
                            fill={chartToneColor()}
                            stroke="rgb(11 12 13)"
                            stroke-width="0.85"
                            vector-effect="non-scaling-stroke"
                          />
                        </>
                      )}
                    </Show>
                    <Show when={chart().last}>
                      {(last) => (
                        <circle
                          cx={last().x}
                          cy={last().y}
                          r="0.56"
                          fill={chartToneColor()}
                          stroke="rgb(11 12 13)"
                          stroke-width="0.55"
                          vector-effect="non-scaling-stroke"
                        />
                      )}
                    </Show>
                  </svg>
                  <div class="pointer-events-none absolute inset-y-0 left-4 right-10 sm:right-32">
                    <Show when={(chart().preMarketBand?.width ?? 0) >= 10}>
                      <div
                        class="absolute top-9 hidden -translate-x-1/2 whitespace-nowrap text-[9px] font-medium leading-none text-[var(--text-muted)] opacity-80 sm:block"
                        style={{ left: chartBandCenterX(chart().preMarketBand!) }}
                      >
                        Pre-market
                      </div>
                    </Show>
                    <Show when={(chart().afterHoursBand?.width ?? 0) >= 10}>
                      <div
                        class="absolute top-9 hidden -translate-x-1/2 whitespace-nowrap text-[9px] font-medium leading-none text-[var(--text-muted)] opacity-80 sm:block"
                        style={{ left: chartBandCenterX(chart().afterHoursBand!) }}
                      >
                        After-hours
                      </div>
                    </Show>
                    <Show when={chart().openX !== undefined}>
                      <div
                        class="absolute top-3 hidden whitespace-nowrap border-l border-[color:rgb(255_255_255_/_14%)] pl-1.5 text-[9px] font-semibold leading-none text-[var(--text-muted)] sm:block"
                        style={{ left: chartOverlayX(chart().openX!) }}
                      >
                        09:30 Open
                      </div>
                    </Show>
                    <Show when={chart().closeX !== undefined}>
                      <div
                        class="absolute top-3 hidden -translate-x-full whitespace-nowrap border-r border-[color:rgb(255_255_255_/_14%)] pr-1.5 text-right text-[9px] font-semibold leading-none text-[var(--text-muted)] sm:block"
                        style={{ left: chartOverlayX(chart().closeX!) }}
                      >
                        16:00 Close
                      </div>
                    </Show>
                    <For each={chart().timeSeparators}>
                      {(separator) => (
                        <div
                          class="absolute top-5 hidden -translate-x-1/2 whitespace-nowrap text-[9px] font-medium leading-none text-[var(--text-faint)] sm:block"
                          style={{ left: chartOverlayX(separator.x) }}
                        >
                          {separator.label}
                        </div>
                      )}
                    </For>
                  </div>
                  <Show
                    when={
                      chart().annotationLayout.referenceLabelVisible.last &&
                      hoveredPointIndex() === undefined
                    }
                  >
                    <div
                      class={`chart-reference-label chart-reference-label-last pointer-events-none absolute -translate-y-1/2 whitespace-nowrap financial-value font-semibold ${
                        rangePositive()
                          ? "text-[color:rgb(164_232_202_/_92%)]"
                          : "text-[color:rgb(236_188_188_/_92%)]"
                      }`}
                      style={{
                        top: `${chart().annotationLayout.referenceLabelY.last ?? chart().currentY}%`,
                      }}
                    >
                      Last{" "}
                      {formatMarketAxisPrice(
                        quote()?.lastPrice ?? chart().metadata.last?.value ?? 0,
                        quote()?.currency,
                        0,
                      )}
                    </div>
                  </Show>
                  <div class="chart-axis-labels pointer-events-none absolute inset-y-4 hidden text-xs financial-value text-[var(--text-muted)] sm:block">
                    <For each={chart().axis}>
                      {(axis, index) => (
                        <Show when={chart().annotationLayout.axisLabelVisible[index()]}>
                          <span
                            class="chart-axis-label absolute -translate-y-1/2 whitespace-nowrap"
                            style={{ top: `${axis.top}%` }}
                          >
                            {formatMarketAxisPrice(axis.value, quote()?.currency, 0)}
                          </span>
                        </Show>
                      )}
                    </For>
                  </div>
                  <div class="chart-time-labels pointer-events-none absolute bottom-2 grid min-w-0 grid-cols-3 gap-2 text-xs financial-value text-[var(--text-muted)]">
                    <span class="truncate">{chartLabels().firstLabel}</span>
                    <span class="truncate text-center">{chartLabels().middleLabel}</span>
                    <span class="truncate text-right">{chartLabels().lastLabel}</span>
                  </div>
                  <Show when={hoveredPoint()}>
                    {(point) => (
                      <div
                        class="chart-tooltip pointer-events-none absolute w-48 border border-[color:rgb(255_255_255_/_2%)] bg-[var(--surface-tooltip)] px-2 py-2 text-[11px] leading-[1.35] shadow-[0_10px_24px_rgb(0_0_0_/_28%)] backdrop-blur-sm"
                        style={chartTooltipPosition(point())}
                      >
                        <p class="financial-value text-[var(--text-secondary)]">
                          {formatMarketChartTime(point().timestamp, workspace.timeRange)}
                        </p>
                        <Show
                          when={
                            point().open !== undefined &&
                            point().high !== undefined &&
                            point().low !== undefined
                          }
                        >
                          <div class="mt-1.5 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-6 gap-y-0.5 financial-value tabular-nums">
                            <span class="grid min-w-0 grid-cols-[0.875rem_minmax(0,1fr)] items-baseline gap-2">
                              <span class="font-medium text-[var(--text-faint)]">O</span>
                              <span class="min-w-0 text-right font-semibold text-[var(--text-primary)]">
                                {formatMarketAxisPrice(point().open ?? 0, quote()?.currency, 2)}
                              </span>
                            </span>
                            <span class="grid min-w-0 grid-cols-[0.875rem_minmax(0,1fr)] items-baseline gap-2">
                              <span class="font-medium text-[var(--text-faint)]">H</span>
                              <span class="min-w-0 text-right font-semibold text-[var(--text-primary)]">
                                {formatMarketAxisPrice(point().high ?? 0, quote()?.currency, 2)}
                              </span>
                            </span>
                            <span class="grid min-w-0 grid-cols-[0.875rem_minmax(0,1fr)] items-baseline gap-2">
                              <span class="font-medium text-[var(--text-faint)]">L</span>
                              <span class="min-w-0 text-right font-semibold text-[var(--text-primary)]">
                                {formatMarketAxisPrice(point().low ?? 0, quote()?.currency, 2)}
                              </span>
                            </span>
                            <span class="grid min-w-0 grid-cols-[0.875rem_minmax(0,1fr)] items-baseline gap-2">
                              <span class="font-medium text-[var(--text-faint)]">C</span>
                              <span class="min-w-0 text-right font-semibold text-[var(--text-primary)]">
                                {formatMarketAxisPrice(
                                  point().close ?? point().value,
                                  quote()?.currency,
                                  2,
                                )}
                              </span>
                            </span>
                          </div>
                          <p class="mt-1.5 flex items-baseline justify-between gap-3 financial-value">
                            <span class="text-[var(--text-muted)]">Vol</span>
                            <span class="font-semibold text-[var(--text-primary)]">
                              {formatCompactNumber(point().volume)}
                            </span>
                          </p>
                        </Show>
                        <Show when={hoveredReturnVsPreviousClose()}>
                          {(returnVsPreviousClose) => (
                            <p
                              class={`mt-1.5 border-t border-[color:rgb(255_255_255_/_5%)] pt-1.5 financial-value font-medium ${
                                returnVsPreviousClose() >= 0
                                  ? "text-[var(--positive)]"
                                  : "text-[var(--negative)]"
                              }`}
                            >
                              {formatSignedPercent(returnVsPreviousClose())} vs prev close
                            </p>
                          )}
                        </Show>
                      </div>
                    )}
                  </Show>
                  <Show when={chart().limited && selected().historyStatus !== "loading"}>
                    <div class="absolute left-4 top-4 bg-[color:var(--surface-panel-overlay)] px-3 py-2 text-xs leading-5 text-[var(--text-secondary)] shadow-xl">
                      Limited history available
                    </div>
                  </Show>
                  <Show
                    when={selected().history.length === 0 && selected().historyStatus !== "loading"}
                  >
                    <div class="absolute inset-0 grid place-items-center px-6 text-center text-sm text-[var(--text-muted)]">
                      No price history available for this range.
                    </div>
                  </Show>
                </div>
              </section>
            </div>
          </Show>

          <aside class="details-rail min-h-0 min-w-0 max-w-[calc(100vw-2rem)] border-t border-white/10 p-4 lg:col-start-2 lg:max-w-none lg:overflow-visible lg:px-6 lg:py-4 xl:col-start-auto xl:overflow-hidden xl:border-l xl:border-t-0 xl:border-white/10 xl:px-5 xl:py-4">
            <h3 class="mb-4 text-sm font-semibold text-[var(--text-secondary)]">Details</h3>

            <section class="-mx-4 space-y-2.5 border-b border-white/[0.035] px-4 pb-4 lg:-mx-6 lg:px-6 xl:-mx-5 xl:px-5">
              <p class="section-label">Selected range</p>
              <div class="mb-1 flex items-baseline justify-between gap-3 py-2">
                <span class="text-sm font-medium text-[var(--text-secondary)]">Range return</span>
                <span
                  class={`financial-value text-lg font-semibold ${(chart().rangeMove ?? 0) >= 0 ? "text-[var(--positive)]" : "text-[var(--negative)]"}`}
                >
                  {chart().rangeMove === undefined
                    ? "Pending"
                    : formatSignedPercent(chart().rangeMove ?? 0)}
                </span>
              </div>
              <div class="flex items-center justify-between gap-3 text-sm">
                <span class="text-[var(--text-muted)]">Range high</span>
                <span class="financial-value text-[var(--text-secondary)]">
                  {chart().rangeHigh === undefined
                    ? "Pending"
                    : formatMoney(chart().rangeHigh ?? 0, quote()?.currency)}
                </span>
              </div>
              <div class="flex items-center justify-between gap-3 text-sm">
                <span class="text-[var(--text-muted)]">Range low</span>
                <span class="financial-value text-[var(--text-secondary)]">
                  {chart().rangeLow === undefined
                    ? "Pending"
                    : formatMoney(chart().rangeLow ?? 0, quote()?.currency)}
                </span>
              </div>
              <div class="flex items-center justify-between gap-3 text-sm">
                <span class="text-[var(--text-muted)]">Range volume</span>
                <span class="financial-value text-[var(--text-secondary)]">
                  {chart().rangeVolume > 0 ? formatCompactNumber(chart().rangeVolume) : "Pending"}
                </span>
              </div>
              <div class="flex items-center justify-between gap-3 text-sm">
                <span class="text-[var(--text-muted)]">Bars</span>
                <span class="financial-value text-[var(--text-secondary)]">
                  {chartLabels().countLabel}
                </span>
              </div>
              <div class="flex items-center justify-between gap-3 text-sm">
                <span class="text-[var(--text-muted)]">Granularity</span>
                <span class="text-[var(--text-secondary)]">{chartLabels().granularity}</span>
              </div>
              <div class="pt-1">
                <div class="flex items-center justify-between text-xs text-[var(--text-muted)]">
                  <span>Range position</span>
                  <span class="financial-value">{Math.round(dayRangePosition())}%</span>
                </div>
                <div class="relative mt-2.5 h-px bg-white/[0.06]">
                  <div
                    class="absolute top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-[color:rgb(103_197_213)] shadow-[0_0_0_1px_rgb(103_197_213_/_18%)]"
                    style={{ left: `calc(${dayRangePosition()}% - 3px)` }}
                  />
                </div>
                <div class="mt-1.5 grid grid-cols-2 text-xs financial-value text-[var(--text-muted)]">
                  <span class="justify-self-start">
                    {quote() ? formatMoney(quote()!.low, quote()!.currency) : "Low"}
                  </span>
                  <span class="justify-self-end">
                    {quote() ? formatMoney(quote()!.high, quote()!.currency) : "High"}
                  </span>
                </div>
              </div>
            </section>

            <section class="-mx-4 space-y-2.5 border-b border-white/[0.035] px-4 py-4 lg:-mx-6 lg:px-6 xl:-mx-5 xl:px-5">
              <p class="section-label">Quote</p>
              <div class="flex items-baseline justify-between gap-3">
                <span class="text-sm font-medium text-[var(--text-secondary)]">Session</span>
                <span class="text-sm font-semibold text-[var(--text-secondary)]">
                  {marketSessionLabel(quote()?.updatedAt)}
                </span>
              </div>
              <div class="flex items-center justify-between gap-3 text-sm">
                <span class="text-[var(--text-muted)]">Updated</span>
                <span class="text-right text-[var(--text-muted)]">
                  {formatMarketTimestamp(quote()?.updatedAt)}
                </span>
              </div>
              <div class="flex items-center justify-between gap-3 text-sm">
                <span class="text-[var(--text-muted)]">Freshness</span>
                <span class="text-[var(--text-secondary)]">{freshnessLabel()}</span>
              </div>
              <div class="flex items-center justify-between gap-3 text-sm">
                <span class="text-[var(--text-muted)]">Open gap</span>
                <span
                  class={`financial-value ${gapPercent() >= 0 ? "text-[var(--positive)]" : "text-[var(--negative)]"}`}
                >
                  {quote() ? formatSignedPercent(gapPercent()) : "Pending"}
                </span>
              </div>
              <div class="flex items-center justify-between gap-3 text-sm">
                <span class="text-[var(--text-muted)]">Return vs prev close</span>
                <span
                  class={`financial-value ${positive() ? "text-[var(--positive)]" : "text-[var(--negative)]"}`}
                >
                  {quote() ? formatSignedPercent(quote()!.changePercent) : "Pending"}
                </span>
              </div>
              <Show when={quote()?.marketCap !== undefined}>
                <div class="flex items-center justify-between text-xs text-[var(--text-faint)]">
                  <span>Market cap</span>
                  <span class="financial-value text-[var(--text-muted)]">
                    {formatCompactNumber(quote()?.marketCap)}
                  </span>
                </div>
              </Show>
              <Show when={quote()?.peRatio !== undefined}>
                <div class="flex items-center justify-between text-xs text-[var(--text-faint)]">
                  <span>P/E</span>
                  <span class="financial-value text-[var(--text-muted)]">{quote()?.peRatio}</span>
                </div>
              </Show>
              <Show when={quote() && !hasFundamentals()}>
                <p class="pt-1 text-xs leading-5 text-[var(--text-faint)]">
                  Fundamentals unavailable in fixture.
                </p>
              </Show>
            </section>

            <section class="space-y-1 pt-4 text-xs leading-5 text-[var(--text-faint)] opacity-75">
              <p class="section-label">Source</p>
              <Show when={selectedSource() === "databento"}>
                <p class="font-medium text-[var(--text-muted)]">Databento historical fixture</p>
                <p>Local JSON · Not live market data</p>
              </Show>
              <Show when={selectedSource() === "mock"}>
                <p class="font-medium text-[var(--text-muted)]">Mock fixture</p>
                <p>Local JSON · Not live market data</p>
              </Show>
              <Show when={selectedSource() !== "databento" && selectedSource() !== "mock"}>
                <p class="font-medium text-[var(--text-muted)]">{sourceLabel(selectedSource())}</p>
                <p>{transportLabel(selectedSource())} market data</p>
              </Show>
            </section>
          </aside>
        </section>
      </main>
    </>
  );
}
