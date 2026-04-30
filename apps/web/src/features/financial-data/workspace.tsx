import { AlertTriangle } from "lucide-solid";
import { createMemo, createSignal, For, Show } from "solid-js";

import {
  formatCompactNumber,
  formatMarketAxisPrice,
  formatMarketChartTime,
  formatMarketTimestamp,
  formatMoney,
  formatSignedPercent,
} from "@/features/market-display/formatting";
import {
  analyzePriceSeries,
  getPaddedPriceDomain,
  type NormalizedPricePoint,
} from "@/features/market-data/price-series";
import type { TimeRange } from "@/features/market-data/types";

import { chartAnnotationLayout } from "./chart-annotations";
import { MetricCell } from "./components/metric-cell";
import { SymbolIntake } from "./components/symbol-intake";
import { TimeRangeControl } from "./components/time-range-control";
import {
  chartCountLabel,
  chartGranularityLabel,
  chartSessionLabel,
  freshnessStateLabel,
  marketSessionLabel,
  sourceLabel,
  statusDotClass,
  transportLabel,
  watchlistStatusLabel,
} from "./display-labels";
import { createFinancialDataWorkspace } from "./model";

const REGULAR_OPEN_MINUTES = 9 * 60 + 30;
const REGULAR_CLOSE_MINUTES = 16 * 60;
const PRICE_AREA_TOP = 6;
const PRICE_AREA_BOTTOM = 76;
const VOLUME_AREA_TOP = 84;
const VOLUME_AREA_BOTTOM = 94;
const POSITIVE_CHART_COLOR = "var(--positive)";
const NEGATIVE_CHART_COLOR = "var(--negative-chart)";
const MARKET_MINUTE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  hour12: false,
  minute: "2-digit",
  timeZone: "America/New_York",
});
const MARKET_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "America/New_York",
});
const MARKET_DATE_KEY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "America/New_York",
  year: "numeric",
});

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

function formatSignedMoney(value: number, currency?: string) {
  const formatted = formatMoney(Math.abs(value), currency);
  return `${value >= 0 ? "+" : "-"}${formatted}`;
}

function tooltipPosition(point: NormalizedPricePoint) {
  const left =
    point.x > 70
      ? `clamp(0.75rem, calc(${point.x}% - 11.75rem), calc(100% - 11rem))`
      : `clamp(0.75rem, calc(${point.x}% + 0.75rem), calc(100% - 11rem))`;
  const top =
    point.y > 58
      ? `clamp(0.75rem, calc(${point.y}% - 9rem), calc(100% - 8.25rem))`
      : `clamp(0.75rem, calc(${point.y}% + 0.75rem), calc(100% - 8.25rem))`;

  return { left, top };
}

function nearestUniformPointIndex(pointCount: number, xPercent: number) {
  if (pointCount <= 0) return undefined;
  if (pointCount === 1) return 0;

  return Math.max(
    0,
    Math.min(pointCount - 1, Math.round((clampPercent(xPercent) / 100) * (pointCount - 1))),
  );
}

function marketMinutes(value: string) {
  const parts = MARKET_MINUTE_FORMATTER.formatToParts(new Date(value));
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);

  return hour * 60 + minute;
}

function marketDateKey(value: string) {
  return MARKET_DATE_KEY_FORMATTER.format(new Date(value));
}

function marketDateLabel(value: string) {
  return MARKET_DATE_FORMATTER.format(new Date(value));
}

function marketReferencePercent(
  points: readonly NormalizedPricePoint[],
  range: TimeRange,
  minutes: number,
) {
  if (range !== "1D" || points.length < 2) return undefined;

  const first = points[0];
  const last = points.at(-1);
  if (!last) return undefined;

  const firstMinutes = marketMinutes(first.timestamp);
  const lastMinutes = marketMinutes(last.timestamp);

  if (firstMinutes > minutes || lastMinutes < minutes || firstMinutes === lastMinutes) {
    return undefined;
  }

  return ((minutes - firstMinutes) / (lastMinutes - firstMinutes)) * 100;
}

function sessionBand(start?: number, end?: number) {
  if (start === undefined || end === undefined) return undefined;
  const left = clampPercent(start);
  const right = clampPercent(end);
  if (right <= left) return undefined;

  return {
    left,
    width: right - left,
  };
}

function chartTimeSeparators(points: readonly NormalizedPricePoint[], range: TimeRange) {
  if (points.length < 2 || range === "1D") return [];

  const separators: Array<{ x: number; label: string }> = [];
  const minLabelGap = range === "1W" ? 11 : 18;
  let previousKey = marketDateKey(points[0].timestamp);
  let previousLabelX = -Infinity;

  for (const point of points.slice(1)) {
    const key = marketDateKey(point.timestamp);
    if (key === previousKey) continue;

    previousKey = key;
    if (point.x <= 2 || point.x >= 96 || point.x - previousLabelX < minLabelGap) continue;

    separators.push({
      x: point.x,
      label: marketDateLabel(point.timestamp),
    });
    previousLabelX = point.x;
  }

  return separators;
}

function percentile(values: readonly number[], percentileRank: number) {
  const sorted = values.filter((value) => value > 0).toSorted((a, b) => a - b);
  if (sorted.length === 0) return 0;

  const index = Math.ceil((percentileRank / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))];
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
  const chartToneColor = () => (positive() ? POSITIVE_CHART_COLOR : NEGATIVE_CHART_COLOR);
  const freshnessLabel = () =>
    freshnessStateLabel(selected().quoteStatus, selected().stale, selectedSource());
  const fallbackNotice = () => (selectedSource() === "mock" ? undefined : workspace.fallbackReason);
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
  const pointReturnVsPreviousClose = (point: NormalizedPricePoint) => {
    const previousClose = quote()?.previousClose;
    if (!previousClose) return undefined;

    return ((point.value - previousClose) / previousClose) * 100;
  };
  const chart = createMemo(() => {
    const history = selected().history;
    const { sorted, metadata } = analyzePriceSeries(history, workspace.timeRange);
    const normalized =
      sorted.length < 2
        ? []
        : sorted.map((point, index) => ({
            ...point,
            x: (index / (sorted.length - 1)) * 100,
            y: 0,
          }));
    const previousClose = quote()?.previousClose;
    const open = quote()?.open;
    const domain = getPaddedPriceDomain(sorted, {
      previousClose,
      open,
      last: quote()?.lastPrice ?? metadata.last?.value,
    });
    const { min, max, spread } = domain;
    const current = quote()?.lastPrice ?? metadata.last?.value ?? min;
    const valueToY = (value: number) =>
      PRICE_AREA_BOTTOM - ((value - min) / spread) * (PRICE_AREA_BOTTOM - PRICE_AREA_TOP);
    const rangeMove =
      metadata.first && metadata.last && metadata.first.value !== 0
        ? ((metadata.last.value - metadata.first.value) / metadata.first.value) * 100
        : quote()?.changePercent;
    const axisPrecision = spread < 10 ? 2 : spread < 100 ? 1 : 0;
    const openX = marketReferencePercent(normalized, workspace.timeRange, REGULAR_OPEN_MINUTES);
    const closeX = marketReferencePercent(normalized, workspace.timeRange, REGULAR_CLOSE_MINUTES);
    const preMarketBand = sessionBand(0, openX);
    const afterHoursBand = sessionBand(closeX, 100);
    const rangeHigh = metadata.max;
    const rangeLow = metadata.min;
    const currentY = valueToY(current);
    const previousCloseY = previousClose === undefined ? undefined : valueToY(previousClose);
    const openY = open === undefined ? undefined : valueToY(open);
    const axis = Array.from({ length: 5 }, (_, index) => {
      const ratio = index / 4;
      return {
        value: max - spread * ratio,
        top: PRICE_AREA_TOP + ratio * (PRICE_AREA_BOTTOM - PRICE_AREA_TOP),
      };
    });
    const annotationLayout = chartAnnotationLayout({
      last: currentY,
      previousClose: previousCloseY,
      open: openY,
      axis,
    });
    const volumes = history.map((point) => point.volume ?? 0);
    const rangeVolume = volumes.reduce((total, volume) => total + volume, 0);
    const volumeScaleMax = percentile(volumes, 95);
    const volumeBarWidth =
      history.length > 0 ? Math.max(0.16, Math.min(0.82, 58 / history.length)) : 0;
    const plotted = normalized.map((point) => ({ ...point, y: valueToY(point.value) }));
    const timeSeparators = chartTimeSeparators(plotted, workspace.timeRange);

    return {
      metadata,
      normalized: plotted,
      path: plotted
        .map(
          (point, index) =>
            `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
        )
        .join(" "),
      axis,
      axisPrecision,
      currentY,
      openX,
      closeX,
      preMarketBand,
      afterHoursBand,
      timeSeparators,
      previousCloseY,
      openY,
      annotationLayout,
      rangeMove,
      rangeHigh,
      rangeLow,
      rangeVolume,
      granularity: chartGranularityLabel(workspace.timeRange, history.length, selectedSource()),
      countLabel: chartCountLabel(workspace.timeRange, history.length, selectedSource()),
      session: chartSessionLabel(workspace.timeRange),
      volumeBars: plotted.map((point) => {
        const volume = point.volume ?? 0;
        const height =
          volumeScaleMax > 0
            ? Math.sqrt(Math.min(volume, volumeScaleMax) / volumeScaleMax) *
              (VOLUME_AREA_BOTTOM - VOLUME_AREA_TOP)
            : 0;
        return {
          ...point,
          volume,
          x: point.x - volumeBarWidth / 2,
          y: VOLUME_AREA_BOTTOM - height,
          width: volumeBarWidth,
          height,
        };
      }),
      hasVolume: rangeVolume > 0,
      last: normalized.at(-1),
      firstLabel: metadata.first
        ? formatMarketChartTime(metadata.first.timestamp, workspace.timeRange)
        : "",
      middleLabel:
        history.length > 2
          ? formatMarketChartTime(
              history[Math.floor(history.length / 2)].timestamp,
              workspace.timeRange,
            )
          : "",
      lastLabel: metadata.last
        ? formatMarketChartTime(metadata.last.timestamp, workspace.timeRange)
        : "",
      limited: history.length > 0 && history.length < 8 && selectedSource() !== "databento",
    };
  });
  const hoveredPoint = createMemo(() => {
    const index = hoveredPointIndex();
    if (index === undefined) return undefined;

    return chart().normalized[index];
  });
  const hoveredReturnVsPreviousClose = createMemo(() => {
    const point = hoveredPoint();
    return point ? pointReturnVsPreviousClose(point) : undefined;
  });

  return (
    <main class="h-dvh min-h-0 w-full overflow-x-hidden overflow-y-auto bg-[var(--surface-app)] text-[var(--text-primary)] xl:overflow-hidden">
      <section class="grid min-h-full w-full min-w-0 gap-0 px-4 py-3 lg:grid-cols-[284px_minmax(0,1fr)] lg:px-5 lg:py-4 xl:h-full xl:min-h-0 xl:grid-cols-[284px_minmax(0,1fr)_264px] 2xl:grid-cols-[310px_minmax(0,1fr)_284px]">
        <aside class="flex min-h-0 min-w-0 flex-col border-b border-white/10 pb-4 lg:border-b-0 lg:border-r lg:border-white/10 lg:pr-5 xl:overflow-hidden">
          <div class="mb-5 shrink-0 border-b border-[var(--border-hairline)] pb-4">
            <div class="flex min-w-0 items-center gap-2.5">
              <img
                alt=""
                aria-hidden="true"
                class="size-7 shrink-0"
                height="28"
                src="/flamel-logo.svg"
                width="28"
              />
              <h1 class="min-w-0 text-[1.625rem] font-semibold leading-8 tracking-normal">
                Flamel
              </h1>
            </div>
            <p class="mt-0.5 text-xs font-medium text-[var(--text-muted)]">
              Equity market workspace
            </p>
          </div>

          <SymbolIntake
            value={workspace.symbolInput}
            error={workspace.intakeError}
            canSubmit={workspace.canAddSymbol}
            onInput={(value) => workspace.setSymbolInput(value)}
            onSubmit={() => void workspace.addSymbol()}
          />

          <div class="section-label mb-2 grid shrink-0 grid-cols-[minmax(0,1fr)_minmax(104px,auto)] gap-4 px-2 text-[var(--text-muted)]">
            <span>Symbol</span>
            <span class="text-right">Last / Move</span>
          </div>
          <div class="min-h-0 divide-y divide-[var(--border-hairline)] overflow-y-auto border-y border-[var(--border-subtle)]">
            <For each={workspace.watchlist}>
              {(item) => (
                <button
                  data-selected={item.selected}
                  class={`watchlist-row grid min-h-14 w-full grid-cols-[minmax(0,1fr)_minmax(104px,auto)] items-center gap-4 px-2 py-2 text-left text-sm focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--accent)] ${
                    item.selected ? "text-[var(--accent)]" : "text-[var(--text-secondary)]"
                  }`}
                  type="button"
                  onClick={() => workspace.selectSymbol(item.symbol)}
                >
                  <span class="grid min-w-0 grid-cols-[6px_minmax(0,1fr)] items-baseline gap-x-2">
                    <span class="contents">
                      <span
                        class={`mt-[0.45rem] size-1.5 rounded-full ${statusDotClass(item.status, item.source)}`}
                        title={watchlistStatusLabel(item.status, item.source)}
                      />
                      <span class="flex min-w-0 items-baseline gap-2">
                        <span class="truncate font-semibold financial-value tracking-normal text-[var(--text-primary)]">
                          {item.symbol}
                        </span>
                        <span class="truncate text-[0.6875rem] font-medium financial-value text-[var(--text-muted)]">
                          {item.quote?.exchange ? `· ${item.quote.exchange}` : ""}
                        </span>
                      </span>
                    </span>
                    <span class="col-start-2 mt-0.5 block truncate text-xs leading-4 text-[var(--text-muted)]">
                      {item.quote?.name ?? watchlistStatusLabel(item.status, item.source)}
                    </span>
                  </span>
                  <span class="min-w-[104px] text-right financial-value">
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
              )}
            </For>
          </div>

          <Show when={fallbackNotice()}>
            <div class="mt-4 border-l border-[var(--warning)] bg-[color:var(--warning-soft)] px-2.5 py-1.5 text-xs leading-5 text-[var(--text-secondary)]">
              {fallbackNotice()}
            </div>
          </Show>
        </aside>

        <Show
          when={workspace.selectedEquity.symbol}
          fallback={
            <div class="flex min-h-[360px] min-w-0 flex-col items-center justify-center py-12 text-center lg:min-h-0 lg:px-6 lg:py-0">
              <div class="max-w-sm border-y border-[var(--border-subtle)] px-6 py-8">
                <p class="text-sm font-semibold text-[var(--text-secondary)]">No symbol selected</p>
                <p class="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                  Select a symbol from the watchlist or add one above.
                </p>
              </div>
            </div>
          }
        >
          <div class="flex min-h-0 min-w-0 flex-col py-4 lg:px-6 lg:py-0 xl:overflow-hidden">
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

            <div class="numeric mb-3 grid min-w-0 grid-cols-2 gap-x-0 gap-y-4 border border-[color:rgb(255_255_255_/_5%)] bg-[linear-gradient(180deg,rgb(16_19_22_/_72%),rgb(10_12_14_/_82%))] px-1 py-3 shadow-[0_12px_32px_rgb(0_0_0_/_18%),inset_0_1px_0_rgb(255_255_255_/_4%)] sm:grid-cols-4 2xl:grid-cols-7">
              <MetricCell
                label="Last"
                value={quote() ? formatMoney(quote()!.lastPrice, quote()!.currency) : "Loading"}
                loading={!quote()}
                priority="primary"
              />
              <MetricCell
                label="Change"
                value={quote() ? formatSignedMoney(quote()!.change, quote()!.currency) : "Pending"}
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
                    ["Range vol", chart().rangeVolume],
                    ["Prev close", quote()?.previousClose],
                  ] as const
                }
              >
                {([label, value]) => (
                  <MetricCell
                    label={label}
                    value={
                      label === "Range vol"
                        ? formatCompactNumber(value)
                        : value === undefined
                          ? "Pending"
                          : formatMoney(value, quote()?.currency)
                    }
                    loading={value === undefined}
                  />
                )}
              </For>
            </div>

            <section aria-label="Price history" class="flex min-h-0 min-w-0 flex-1 flex-col">
              <div class="mb-2 flex flex-wrap items-start justify-between gap-x-5 gap-y-2">
                <div class="min-w-0">
                  <p class="text-sm font-medium text-[var(--text-secondary)]">Price history</p>
                  <p class="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                    {workspace.timeRange} · {chart().session} · {chart().granularity} · ET
                  </p>
                </div>
                <div class="text-left sm:text-right">
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
                  <p class="mt-0.5 text-xs text-[var(--text-muted)]">{chart().countLabel}</p>
                </div>
              </div>
              <div class="relative h-[330px] min-h-[270px] min-w-0 overflow-hidden bg-[var(--surface-panel)] p-4 pr-20 pb-11 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] sm:pr-24 xl:h-auto xl:flex-1">
                <svg
                  class="relative h-full w-full overflow-visible"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  onMouseLeave={() => setHoveredPointIndex(undefined)}
                  onMouseMove={(event) => {
                    const points = chart().normalized;
                    if (points.length === 0) return;

                    const bounds = event.currentTarget.getBoundingClientRect();
                    const x = ((event.clientX - bounds.left) / bounds.width) * 100;
                    const closestIndex = nearestUniformPointIndex(points.length, x);
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
                        height="86"
                        fill="rgb(90 215 242)"
                        opacity="0.01"
                      />
                    )}
                  </Show>
                  <Show when={chart().afterHoursBand}>
                    {(band) => (
                      <rect
                        x={band().left}
                        y="8"
                        width={band().width}
                        height="86"
                        fill="rgb(90 215 242)"
                        opacity="0.012"
                      />
                    )}
                  </Show>
                  <For each={chart().timeSeparators}>
                    {(separator) => (
                      <line
                        x1={separator.x}
                        x2={separator.x}
                        y1="8"
                        y2="94"
                        stroke="rgb(255 255 255)"
                        stroke-opacity="0.052"
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
                        stroke-opacity="0.026"
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
                  <Show when={chart().previousCloseY}>
                    {(previousCloseY) => (
                      <line
                        x1="0"
                        x2="100"
                        y1={previousCloseY()}
                        y2={previousCloseY()}
                        stroke="rgb(90 215 242)"
                        stroke-opacity="0.28"
                        stroke-dasharray="2 4"
                        stroke-width="0.5"
                        vector-effect="non-scaling-stroke"
                      />
                    )}
                  </Show>
                  <Show when={chart().openY}>
                    {(openY) => (
                      <line
                        x1="0"
                        x2="100"
                        y1={openY()}
                        y2={openY()}
                        stroke="rgb(161 167 174)"
                        stroke-opacity="0.18"
                        stroke-dasharray="1 4"
                        stroke-width="0.45"
                        vector-effect="non-scaling-stroke"
                      />
                    )}
                  </Show>
                  <Show when={chart().openX}>
                    {(openX) => (
                      <line
                        x1={openX()}
                        x2={openX()}
                        y1="6"
                        y2="94"
                        stroke="rgb(255 255 255)"
                        stroke-opacity="0.046"
                        stroke-dasharray="3 3"
                        stroke-width="0.4"
                        vector-effect="non-scaling-stroke"
                      />
                    )}
                  </Show>
                  <Show when={chart().closeX}>
                    {(closeX) => (
                      <line
                        x1={closeX()}
                        x2={closeX()}
                        y1="6"
                        y2="94"
                        stroke="rgb(255 255 255)"
                        stroke-opacity="0.044"
                        stroke-dasharray="3 3"
                        stroke-width="0.4"
                        vector-effect="non-scaling-stroke"
                      />
                    )}
                  </Show>
                  <path
                    d={chart().path}
                    fill="none"
                    stroke={chartToneColor()}
                    stroke-opacity="0.18"
                    stroke-width="4.2"
                    vector-effect="non-scaling-stroke"
                  />
                  <path
                    d={chart().path}
                    fill="none"
                    stroke={chartToneColor()}
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2.35"
                    vector-effect="non-scaling-stroke"
                  />
                  <Show when={chart().hasVolume}>
                    <line
                      x1="0"
                      x2="100"
                      y1={VOLUME_AREA_TOP - 2}
                      y2={VOLUME_AREA_TOP - 2}
                      stroke="rgb(255 255 255)"
                      stroke-opacity="0.045"
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
                          y2="94"
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
                        r="1"
                        fill={chartToneColor()}
                        stroke="rgb(11 12 13)"
                        stroke-width="1"
                        vector-effect="non-scaling-stroke"
                      />
                    )}
                  </Show>
                </svg>
                <Show when={chart().openX}>
                  {(openX) => (
                    <div
                      class="pointer-events-none absolute top-5 -translate-x-1/2 text-[9px] font-medium leading-none text-[var(--text-faint)]"
                      style={{ left: `calc(${openX()}% + 1rem)` }}
                    >
                      Open
                    </div>
                  )}
                </Show>
                <Show when={chart().closeX}>
                  {(closeX) => (
                    <div
                      class="pointer-events-none absolute top-5 -translate-x-1/2 text-[9px] font-medium leading-none text-[var(--text-faint)]"
                      style={{ left: `calc(${closeX()}% + 1rem)` }}
                    >
                      Close
                    </div>
                  )}
                </Show>
                <For each={chart().timeSeparators}>
                  {(separator) => (
                    <div
                      class="pointer-events-none absolute top-5 -translate-x-1/2 whitespace-nowrap text-[9px] font-medium leading-none text-[var(--text-faint)]"
                      style={{ left: `calc(${separator.x}% + 1rem)` }}
                    >
                      {separator.label}
                    </div>
                  )}
                </For>
                <div
                  class={`chart-reference-label pointer-events-none absolute right-20 -translate-y-1/2 whitespace-nowrap border-t pr-0 pt-1.5 financial-value ${
                    positive()
                      ? "border-[color:rgb(94_230_168_/_24%)] text-[color:rgb(153_220_190_/_82%)]"
                      : "border-[color:rgb(255_143_143_/_22%)] text-[color:rgb(224_174_174_/_82%)]"
                  }`}
                  style={{
                    top: `${chart().annotationLayout.referenceLabelY.last ?? chart().currentY}%`,
                  }}
                >
                  Last{" "}
                  {formatMarketAxisPrice(
                    quote()?.lastPrice ?? chart().metadata.last?.value ?? 0,
                    quote()?.currency,
                    chart().axisPrecision,
                  )}
                </div>
                <Show
                  when={
                    chart().previousCloseY !== undefined &&
                    chart().annotationLayout.referenceLabelVisible.previousClose
                  }
                >
                  {(previousCloseY) => (
                    <div
                      class="chart-reference-label pointer-events-none absolute right-20 -translate-y-1/2 whitespace-nowrap border-t border-[color:rgb(90_215_242_/_18%)] pr-0 pt-1.5 financial-value text-[color:rgb(155_181_190_/_78%)]"
                      style={{
                        top: `${chart().annotationLayout.referenceLabelY.previousClose ?? previousCloseY()}%`,
                      }}
                    >
                      Prev close{" "}
                      {formatMarketAxisPrice(
                        quote()?.previousClose ?? 0,
                        quote()?.currency,
                        chart().axisPrecision,
                      )}
                    </div>
                  )}
                </Show>
                <Show
                  when={
                    chart().openY !== undefined &&
                    chart().annotationLayout.referenceLabelVisible.open
                  }
                >
                  {(openY) => (
                    <div
                      class="chart-reference-label pointer-events-none absolute right-20 -translate-y-1/2 whitespace-nowrap border-t border-[color:rgb(161_167_174_/_16%)] pr-0 pt-1.5 financial-value text-[color:rgb(150_157_165_/_72%)]"
                      style={{
                        top: `${chart().annotationLayout.referenceLabelY.open ?? openY()}%`,
                      }}
                    >
                      Open{" "}
                      {formatMarketAxisPrice(
                        quote()?.open ?? 0,
                        quote()?.currency,
                        chart().axisPrecision,
                      )}
                    </div>
                  )}
                </Show>
                <div class="pointer-events-none absolute inset-y-4 right-4 w-14 text-right text-xs financial-value text-[var(--text-muted)]">
                  <For each={chart().axis}>
                    {(axis, index) => (
                      <Show when={chart().annotationLayout.axisLabelVisible[index()]}>
                        <span
                          class="absolute right-0 -translate-y-1/2 whitespace-nowrap"
                          style={{ top: `${axis.top}%` }}
                        >
                          {formatMarketAxisPrice(
                            axis.value,
                            quote()?.currency,
                            chart().axisPrecision,
                          )}
                        </span>
                      </Show>
                    )}
                  </For>
                </div>
                <div class="pointer-events-none absolute inset-x-4 bottom-3 right-20 grid min-w-0 grid-cols-3 gap-2 text-xs financial-value text-[var(--text-muted)]">
                  <span class="truncate">{chart().firstLabel}</span>
                  <span class="truncate text-center">{chart().middleLabel}</span>
                  <span class="truncate text-right">{chart().lastLabel}</span>
                </div>
                <Show when={hoveredPoint()}>
                  {(point) => (
                    <div
                      class="chart-tooltip pointer-events-none absolute w-40 border border-[color:rgb(255_255_255_/_7%)] bg-[var(--surface-tooltip)] px-2.5 py-2 text-[11px] leading-[1.35] shadow-[0_12px_30px_rgb(0_0_0_/_32%)] backdrop-blur-sm"
                      style={tooltipPosition(point())}
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
                        <div class="mt-2 grid grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)] gap-x-2 gap-y-1 financial-value">
                          <span class="text-[var(--text-muted)]">O</span>
                          <span class="text-right font-medium text-[var(--text-primary)]">
                            {formatMarketAxisPrice(
                              point().open ?? 0,
                              quote()?.currency,
                              chart().axisPrecision,
                            )}
                          </span>
                          <span class="text-[var(--text-muted)]">H</span>
                          <span class="text-right font-medium text-[var(--text-primary)]">
                            {formatMarketAxisPrice(
                              point().high ?? 0,
                              quote()?.currency,
                              chart().axisPrecision,
                            )}
                          </span>
                          <span class="text-[var(--text-muted)]">L</span>
                          <span class="text-right font-medium text-[var(--text-primary)]">
                            {formatMarketAxisPrice(
                              point().low ?? 0,
                              quote()?.currency,
                              chart().axisPrecision,
                            )}
                          </span>
                          <span class="text-[var(--text-muted)]">C</span>
                          <span class="text-right font-medium text-[var(--text-primary)]">
                            {formatMarketAxisPrice(
                              point().close ?? point().value,
                              quote()?.currency,
                              chart().axisPrecision,
                            )}
                          </span>
                        </div>
                        <p class="mt-2 flex items-baseline justify-between gap-3 financial-value">
                          <span class="text-[var(--text-muted)]">Vol</span>
                          <span class="font-medium text-[var(--text-secondary)]">
                            {formatCompactNumber(point().volume)}
                          </span>
                        </p>
                      </Show>
                      <Show when={hoveredReturnVsPreviousClose()}>
                        {(returnVsPreviousClose) => (
                          <p
                            class={`mt-2 border-t border-[color:rgb(255_255_255_/_6%)] pt-2 financial-value font-medium ${
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

        <aside class="min-h-0 min-w-0 border-t border-white/10 pt-4 lg:col-start-2 lg:overflow-visible lg:pl-6 xl:col-start-auto xl:overflow-hidden xl:border-l xl:border-t-0 xl:border-white/10 xl:pl-5 xl:pt-0">
          <h3 class="mb-4 text-sm font-semibold text-[var(--text-secondary)]">Details</h3>

          <section class="space-y-2.5 border-b border-white/[0.035] pb-4">
            <p class="section-label">Selected range</p>
            <div class="mb-1 flex items-baseline justify-between gap-3 border-l border-[color:var(--accent-border)] bg-white/[0.025] px-2.5 py-2">
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
                  : formatMoney(chart().rangeHigh, quote()?.currency)}
              </span>
            </div>
            <div class="flex items-center justify-between gap-3 text-sm">
              <span class="text-[var(--text-muted)]">Range low</span>
              <span class="financial-value text-[var(--text-secondary)]">
                {chart().rangeLow === undefined
                  ? "Pending"
                  : formatMoney(chart().rangeLow, quote()?.currency)}
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
              <span class="financial-value text-[var(--text-secondary)]">{chart().countLabel}</span>
            </div>
            <div class="flex items-center justify-between gap-3 text-sm">
              <span class="text-[var(--text-muted)]">Granularity</span>
              <span class="text-[var(--text-secondary)]">{chart().granularity}</span>
            </div>
            <div class="pt-1">
              <div class="flex items-center justify-between text-xs text-[var(--text-muted)]">
                <span>Day range</span>
                <span class="financial-value">{Math.round(dayRangePosition())}%</span>
              </div>
              <div class="relative mt-2.5 h-1 bg-white/[0.055]">
                <div
                  class="absolute top-1/2 size-2 -translate-y-1/2 rounded-full bg-[var(--accent)]"
                  style={{ left: `calc(${dayRangePosition()}% - 4px)` }}
                />
              </div>
              <div class="mt-2 flex justify-between text-xs financial-value text-[var(--text-muted)]">
                <span>{quote() ? formatMoney(quote()!.low, quote()!.currency) : "Low"}</span>
                <span>{quote() ? formatMoney(quote()!.high, quote()!.currency) : "High"}</span>
              </div>
            </div>
          </section>

          <section class="space-y-2.5 border-b border-white/[0.035] py-4">
            <p class="section-label">Quote</p>
            <div class="flex items-baseline justify-between gap-3">
              <span class="text-sm font-medium text-[var(--text-secondary)]">Session</span>
              <span class="font-semibold text-[var(--text-primary)]">
                {marketSessionLabel(quote()?.updatedAt)}
              </span>
            </div>
            <div class="flex items-center justify-between gap-3 text-sm">
              <span class="font-medium text-[var(--text-secondary)]">Updated</span>
              <span class="text-right font-medium text-[var(--text-secondary)]">
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
            <div class="flex items-center justify-between text-xs text-[var(--text-faint)]">
              <span>Market cap</span>
              <span class="financial-value text-[var(--text-muted)]">
                {formatCompactNumber(quote()?.marketCap)}
              </span>
            </div>
            <div class="flex items-center justify-between text-xs text-[var(--text-faint)]">
              <span>P/E</span>
              <span class="financial-value text-[var(--text-muted)]">
                {quote()?.peRatio ?? "n/a"}
              </span>
            </div>
          </section>

          <section class="space-y-1.5 pt-4 text-xs leading-5 text-[var(--text-faint)]">
            <p class="section-label">Source</p>
            <p>
              <span class="text-[var(--text-muted)]">{sourceLabel(selectedSource())}</span>
              <span class="px-1 text-[var(--text-faint)]">·</span>
              <span>{transportLabel(selectedSource())}</span>
            </p>
            <Show when={selectedSource() === "databento"}>
              <p>Historical fixture · Not live market data</p>
            </Show>
            <Show when={selectedSource() === "mock"}>
              <p>Fallback fixture · Not live market data</p>
            </Show>
          </section>
        </aside>
      </section>
    </main>
  );
}
