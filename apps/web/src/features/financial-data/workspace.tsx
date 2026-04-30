import { AlertTriangle, Plus, RefreshCw } from "lucide-solid";
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
  getPriceSeriesMetadata,
  type NormalizedPricePoint,
  normalizePriceSeriesForSvg,
} from "@/features/market-data/price-series";
import type { DataSource, TimeRange } from "@/features/market-data/types";

import { createFinancialDataWorkspace } from "./model";

const TIME_RANGES: TimeRange[] = ["1D", "1W", "1M"];

function sourceLabel(source?: DataSource) {
  if (source === "massive") return "Massive REST";
  if (source === "mock") return "Mock provider";
  return "Provider pending";
}

function titleCaseStatus(status: string) {
  return status === "idle" ? "Pending" : status[0].toUpperCase() + status.slice(1);
}

function statusDotClass(status: string, source?: DataSource) {
  if (status === "error") return "bg-red-300";
  if (status === "loading") return "bg-amber-300";
  if (source === "mock") return "bg-sky-300";
  return "bg-emerald-300";
}

function historyStatusLabel(status: string) {
  return status === "ready" ? "Loaded" : titleCaseStatus(status);
}

function freshnessStateLabel(status: string, stale: boolean, source?: DataSource) {
  if (status === "loading") return "Loading quote";
  if (status === "error") return "Quote unavailable";
  if (source === "mock") return "Simulated snapshot";
  return stale ? "Cached quote" : "Delayed quote";
}

function marketSessionLabel(value?: string) {
  if (!value) return "Session pending";

  const hour = new Date(value).getUTCHours();
  if (hour < 13) return "Pre-market";
  if (hour < 20) return "Open";
  if (hour < 22) return "After-hours";
  return "Market closed";
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

function formatSignedMoney(value: number, currency?: string) {
  const formatted = formatMoney(Math.abs(value), currency);
  return `${value >= 0 ? "+" : "-"}${formatted}`;
}

function watchlistStatusLabel(status: string, source?: DataSource) {
  if (status === "error" || status === "loading") return titleCaseStatus(status);
  if (source === "mock") return "Sim";
  return status === "ready" ? "Cached" : "Pending";
}

export { createFinancialDataWorkspace } from "./model";
export { preloadDefaultFinancialData } from "./queries";
export type { FinancialDataWorkspaceViewModel } from "./types";

export function FinancialDataWorkspace() {
  const workspace = createFinancialDataWorkspace();
  const [hoveredPoint, setHoveredPoint] = createSignal<NormalizedPricePoint>();
  const selected = () => workspace.selectedEquity;
  const quote = () => selected().quote;
  const selectedSource = () => quote()?.source ?? workspace.dataSource;
  const positive = () => (quote()?.change ?? 0) >= 0;
  const freshnessLabel = () =>
    freshnessStateLabel(selected().quoteStatus, selected().stale, selectedSource());
  const fallbackNotice = () =>
    selectedSource() === "mock"
      ? "Not live market data. Offline demo snapshot."
      : workspace.fallbackReason;
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
  const chart = createMemo(() => {
    const history = selected().history;
    const normalized = normalizePriceSeriesForSvg(history, {
      width: 100,
      height: 100,
      verticalPadding: 8,
    });
    const metadata = getPriceSeriesMetadata(history, workspace.timeRange);
    const previousClose = quote()?.previousClose;
    const baseMin = metadata.min ?? quote()?.low ?? quote()?.lastPrice ?? 0;
    const baseMax = metadata.max ?? quote()?.high ?? quote()?.lastPrice ?? baseMin;
    const min = Math.min(baseMin, previousClose ?? baseMin);
    const max = Math.max(baseMax, previousClose ?? baseMax);
    const spread = Math.max(max - min, 1);
    const current = quote()?.lastPrice ?? metadata.last?.value ?? min;
    const valueToY = (value: number) => 92 - ((value - min) / spread) * 84;
    const rangeMove =
      metadata.first && metadata.last && metadata.first.value !== 0
        ? ((metadata.last.value - metadata.first.value) / metadata.first.value) * 100
        : quote()?.changePercent;

    return {
      metadata,
      normalized,
      path: normalized
        .map(
          (point, index) =>
            `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
        )
        .join(" "),
      axis: Array.from({ length: 5 }, (_, index) => {
        const ratio = index / 4;
        return { value: max - spread * ratio, top: 8 + ratio * 84 };
      }),
      currentY: valueToY(current),
      previousCloseY: previousClose === undefined ? undefined : valueToY(previousClose),
      rangeMove,
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
      limited: history.length > 0 && history.length < 8,
    };
  });

  return (
    <main class="h-dvh min-h-0 w-full overflow-auto bg-[#101112] text-neutral-100 lg:overflow-hidden">
      <section class="grid min-h-full w-full gap-0 px-4 py-3 lg:h-full lg:min-h-0 lg:grid-cols-[300px_minmax(0,1fr)_270px] lg:px-5 lg:py-4 xl:grid-cols-[330px_minmax(0,1fr)_300px]">
        <aside class="min-h-0 border-b border-neutral-800 pb-4 lg:overflow-auto lg:border-b-0 lg:border-r lg:pr-4">
          <div class="mb-4">
            <p class="text-xs font-medium text-neutral-500">Workspace</p>
            <h1 class="mt-1 text-2xl font-semibold tracking-normal">Financial Data</h1>
            <p class="mt-1 text-sm text-neutral-400">{sourceLabel(workspace.dataSource)}</p>
          </div>

          <form
            class="mb-4"
            onSubmit={(event) => {
              event.preventDefault();
              void workspace.addSymbol();
            }}
          >
            <label class="mb-2 block text-sm font-medium text-neutral-300" for="symbol-input">
              Add symbol
            </label>
            <div class="flex min-w-0 overflow-hidden rounded-md border border-neutral-700 bg-neutral-950 focus-within:border-cyan-400">
              <input
                id="symbol-input"
                class="h-10 min-w-0 flex-1 bg-transparent px-3 text-sm uppercase tabular-nums outline-none placeholder:text-neutral-600"
                placeholder="AAPL"
                value={workspace.symbolInput}
                onInput={(event) => workspace.setSymbolInput(event.currentTarget.value)}
              />
              <button
                class="grid size-10 shrink-0 place-items-center border-l border-neutral-700 text-cyan-300 transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:text-neutral-600"
                type="submit"
                disabled={!workspace.canAddSymbol}
                title="Add symbol"
              >
                <Plus size={18} aria-hidden="true" />
              </button>
            </div>
            <Show when={workspace.intakeError}>
              <p class="mt-2 text-sm leading-5 text-amber-300">{workspace.intakeError}</p>
            </Show>
          </form>

          <div class="mb-2 grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-2 text-xs font-medium text-neutral-500">
            <span>Symbol</span>
            <span>Last / Move</span>
          </div>
          <div class="divide-y divide-neutral-800 border-y border-neutral-800">
            <For each={workspace.watchlist}>
              {(item) => (
                <button
                  class={`grid w-full grid-cols-[minmax(0,1fr)_minmax(104px,auto)] items-center gap-4 border-l-2 px-2 py-2.5 text-left text-sm transition ${
                    item.selected
                      ? "border-cyan-300 bg-cyan-300/10 text-cyan-100"
                      : "border-transparent text-neutral-300 hover:bg-neutral-900/80"
                  }`}
                  type="button"
                  onClick={() => workspace.selectSymbol(item.symbol)}
                >
                  <span class="min-w-0">
                    <span class="flex min-w-0 items-center gap-2">
                      <span
                        class={`size-1.5 shrink-0 rounded-full ${statusDotClass(item.status, item.source)}`}
                        title={watchlistStatusLabel(item.status, item.source)}
                      />
                      <span class="truncate font-semibold tabular-nums text-neutral-100">
                        {item.symbol}
                      </span>
                      <span class="truncate text-xs tabular-nums text-neutral-500">
                        {item.quote?.exchange ? `· ${item.quote.exchange}` : ""}
                      </span>
                    </span>
                    <span class="mt-0.5 block truncate text-xs text-neutral-500">
                      {item.quote?.name ?? watchlistStatusLabel(item.status, item.source)}
                    </span>
                  </span>
                  <span class="text-right tabular-nums">
                    <span class="block font-medium text-neutral-100">
                      {item.quote
                        ? formatMoney(item.quote.lastPrice, item.quote.currency)
                        : watchlistStatusLabel(item.status, item.source)}
                    </span>
                    <span
                      class={`mt-0.5 block text-xs ${(item.quote?.changePercent ?? 0) >= 0 ? "text-emerald-300" : "text-red-300"}`}
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
            <div class="mt-4 border-l-2 border-amber-300 bg-amber-300/10 px-3 py-2 text-sm leading-5 text-amber-100">
              {fallbackNotice()}
            </div>
          </Show>
        </aside>

        <div class="flex min-h-0 min-w-0 flex-col py-4 lg:overflow-auto lg:px-5 lg:py-0">
          <div class="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div class="min-w-0">
              <div class="mb-1 flex flex-wrap items-center gap-2 text-sm text-neutral-400">
                <span class="font-medium tabular-nums text-neutral-300">{selected().symbol}</span>
                <span>{quote()?.exchange ?? "Market pending"}</span>
                <span>{quote()?.currency ?? "USD"}</span>
                <span>Equity</span>
                <span class="rounded-sm border border-neutral-800 bg-neutral-950 px-1.5 py-0.5 text-xs text-neutral-400">
                  {freshnessLabel()}
                </span>
              </div>
              <h2 class="max-w-3xl truncate text-2xl font-semibold tracking-normal md:text-3xl">
                {quote()?.name ?? selected().symbol}
              </h2>
              <div class="mt-2 flex flex-wrap gap-2 text-xs text-neutral-500">
                <span>{marketSessionLabel(quote()?.updatedAt)}</span>
                <span>{sourceLabel(selectedSource())}</span>
                <span>Updated {formatMarketTimestamp(quote()?.updatedAt)}</span>
              </div>
            </div>
            <div class="flex items-center rounded-md border border-neutral-800 bg-neutral-950 p-1">
              <For each={TIME_RANGES}>
                {(range) => (
                  <button
                    class={`h-8 rounded px-3 text-sm transition ${
                      workspace.timeRange === range
                        ? "bg-neutral-100 text-neutral-950"
                        : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100"
                    }`}
                    type="button"
                    onClick={() => workspace.setTimeRange(range)}
                  >
                    {range}
                  </button>
                )}
              </For>
              <button
                class="ml-1 grid size-8 place-items-center rounded text-neutral-400 transition hover:bg-neutral-900 hover:text-neutral-100"
                type="button"
                title="Refresh"
                onClick={() => workspace.refresh()}
              >
                <RefreshCw size={16} aria-hidden="true" />
              </button>
            </div>
          </div>

          <Show when={workspace.providerError}>
            <div class="mb-4 flex items-start gap-3 border border-red-400/30 bg-red-400/10 p-3 text-sm leading-5 text-red-100">
              <AlertTriangle class="mt-0.5 shrink-0" size={18} aria-hidden="true" />
              <p>{workspace.providerError}</p>
            </div>
          </Show>

          <div class="mb-4 grid gap-x-5 gap-y-3 border-y border-neutral-800 py-3 sm:grid-cols-4 xl:grid-cols-7">
            <div class="min-w-0">
              <p class="text-xs font-medium text-neutral-500">Last</p>
              <p class="mt-1 truncate text-xl font-semibold tracking-normal tabular-nums">
                {quote() ? formatMoney(quote()!.lastPrice, quote()!.currency) : "Loading"}
              </p>
            </div>
            <div class="min-w-0">
              <p class="text-xs font-medium text-neutral-500">Change</p>
              <p
                class={`mt-1 truncate text-lg font-semibold tracking-normal tabular-nums ${positive() ? "text-emerald-300" : "text-red-300"}`}
              >
                {quote()
                  ? `${formatSignedMoney(quote()!.change, quote()!.currency)} ${formatSignedPercent(quote()!.changePercent)}`
                  : "Pending"}
              </p>
            </div>
            <For
              each={
                [
                  ["Open", quote()?.open],
                  ["High", quote()?.high],
                  ["Low", quote()?.low],
                  ["Volume", quote()?.volume],
                  ["Prev close", quote()?.previousClose],
                ] as const
              }
            >
              {([label, value]) => (
                <div class="min-w-0">
                  <p class="text-xs font-medium text-neutral-500">{label}</p>
                  <p class="mt-1 truncate text-lg font-semibold tracking-normal tabular-nums">
                    {label === "Volume"
                      ? formatCompactNumber(value)
                      : value === undefined
                        ? "Pending"
                        : formatMoney(value, quote()?.currency)}
                  </p>
                </div>
              )}
            </For>
          </div>

          <section aria-label="Price history" class="flex min-h-0 min-w-0 flex-1 flex-col">
            <div class="mb-2 flex items-center justify-between gap-3">
              <div>
                <p class="text-sm font-medium text-neutral-300">
                  Price history · {workspace.timeRange} ·{" "}
                  <span class={positive() ? "text-emerald-300" : "text-red-300"}>
                    {chart().rangeMove === undefined
                      ? "Pending"
                      : formatSignedPercent(chart().rangeMove ?? 0)}
                  </span>
                </p>
                <p class="text-xs text-neutral-500">
                  {chart().metadata.count} points · current and previous close references
                </p>
              </div>
              <p class="text-sm text-neutral-500">{historyStatusLabel(selected().historyStatus)}</p>
            </div>
            <div class="relative h-[330px] min-h-[270px] border border-neutral-800 bg-[#070909] p-4 pr-20 pb-11 lg:h-auto lg:flex-1">
              <svg
                class="relative h-full w-full overflow-visible"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                onMouseLeave={() => setHoveredPoint(undefined)}
                onMouseMove={(event) => {
                  const points = chart().normalized;
                  if (points.length === 0) return;

                  const bounds = event.currentTarget.getBoundingClientRect();
                  const x = ((event.clientX - bounds.left) / bounds.width) * 100;
                  const closest = points.reduce((nearest, point) =>
                    Math.abs(point.x - x) < Math.abs(nearest.x - x) ? point : nearest,
                  );
                  setHoveredPoint(closest);
                }}
              >
                <For each={chart().axis}>
                  {(axis) => (
                    <line
                      x1="0"
                      x2="100"
                      y1={axis.top}
                      y2={axis.top}
                      stroke="rgb(38 38 38)"
                      stroke-width="0.5"
                      vector-effect="non-scaling-stroke"
                    />
                  )}
                </For>
                <line
                  x1="0"
                  x2="100"
                  y1={chart().currentY}
                  y2={chart().currentY}
                  stroke="rgb(115 115 115)"
                  stroke-dasharray="4 4"
                  stroke-width="0.8"
                  vector-effect="non-scaling-stroke"
                />
                <Show when={chart().previousCloseY}>
                  {(previousCloseY) => (
                    <line
                      x1="0"
                      x2="100"
                      y1={previousCloseY()}
                      y2={previousCloseY()}
                      stroke="rgb(14 165 233)"
                      stroke-dasharray="2 3"
                      stroke-width="0.7"
                      vector-effect="non-scaling-stroke"
                    />
                  )}
                </Show>
                <path
                  d={chart().path}
                  fill="none"
                  stroke={positive() ? "rgb(110 231 183)" : "rgb(252 165 165)"}
                  stroke-width="1.8"
                  vector-effect="non-scaling-stroke"
                />
                <Show when={hoveredPoint()}>
                  {(point) => (
                    <>
                      <line
                        x1={point().x}
                        x2={point().x}
                        y1="8"
                        y2="92"
                        stroke="rgb(163 163 163)"
                        stroke-width="0.6"
                        vector-effect="non-scaling-stroke"
                      />
                      <line
                        x1="0"
                        x2="100"
                        y1={point().y}
                        y2={point().y}
                        stroke="rgb(163 163 163)"
                        stroke-width="0.6"
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
                      r="1.2"
                      fill={positive() ? "rgb(110 231 183)" : "rgb(252 165 165)"}
                      stroke="rgb(11 12 13)"
                      stroke-width="1"
                      vector-effect="non-scaling-stroke"
                    />
                  )}
                </Show>
              </svg>
              <div class="pointer-events-none absolute right-20 top-3 flex gap-3 text-[11px] tabular-nums text-neutral-500">
                <span>-- current</span>
                <span class="text-sky-400">-- prev close</span>
              </div>
              <div class="pointer-events-none absolute inset-y-4 right-4 w-14 text-right text-xs tabular-nums text-neutral-500">
                <For each={chart().axis}>
                  {(axis) => (
                    <span
                      class="absolute right-0 -translate-y-1/2 whitespace-nowrap"
                      style={{ top: `${axis.top}%` }}
                    >
                      {formatMarketAxisPrice(axis.value, quote()?.currency)}
                    </span>
                  )}
                </For>
              </div>
              <div class="pointer-events-none absolute inset-x-4 bottom-3 right-20 grid grid-cols-3 text-xs tabular-nums text-neutral-500">
                <span>{chart().firstLabel}</span>
                <span class="text-center">{chart().middleLabel}</span>
                <span class="text-right">{chart().lastLabel}</span>
              </div>
              <Show when={hoveredPoint()}>
                {(point) => (
                  <div class="pointer-events-none absolute left-4 top-4 border border-neutral-700 bg-neutral-950 px-3 py-2 text-xs shadow-xl">
                    <p class="font-medium tabular-nums text-neutral-100">
                      {formatMarketAxisPrice(point().value, quote()?.currency)}
                    </p>
                    <p class="mt-1 text-neutral-500">{formatMarketTimestamp(point().timestamp)}</p>
                  </div>
                )}
              </Show>
              <Show when={chart().limited && selected().historyStatus !== "loading"}>
                <div class="absolute left-4 top-4 border border-neutral-700 bg-neutral-950/95 px-3 py-2 text-xs leading-5 text-neutral-300 shadow-xl">
                  Limited history available
                </div>
              </Show>
              <Show
                when={selected().history.length === 0 && selected().historyStatus !== "loading"}
              >
                <div class="absolute inset-0 grid place-items-center px-6 text-center text-sm text-neutral-500">
                  No price history available for this range.
                </div>
              </Show>
            </div>
          </section>
        </div>

        <aside class="min-h-0 border-t border-neutral-800 pt-4 lg:overflow-auto lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
          <h3 class="mb-3 text-sm font-semibold text-neutral-200">Context</h3>
          <div class="border-y border-neutral-800 py-3">
            <div class="flex items-center justify-between text-xs text-neutral-500">
              <span>Day range</span>
              <span class="tabular-nums">{Math.round(dayRangePosition())}%</span>
            </div>
            <div class="relative mt-3 h-1 bg-neutral-800">
              <div
                class="absolute top-1/2 size-2 -translate-y-1/2 rounded-full bg-cyan-300"
                style={{ left: `calc(${dayRangePosition()}% - 4px)` }}
              />
            </div>
            <div class="mt-2 flex justify-between text-xs tabular-nums text-neutral-500">
              <span>{quote() ? formatMoney(quote()!.low, quote()!.currency) : "Low"}</span>
              <span>{quote() ? formatMoney(quote()!.high, quote()!.currency) : "High"}</span>
            </div>
          </div>

          <dl class="divide-y divide-neutral-800 border-b border-neutral-800 text-sm">
            <div class="grid grid-cols-[1fr_auto] gap-4 py-3">
              <dt class="text-neutral-500">Gap vs prev close</dt>
              <dd class={`tabular-nums ${gapPercent() >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                {quote() ? formatSignedPercent(gapPercent()) : "Pending"}
              </dd>
            </div>
            <div class="grid grid-cols-[1fr_auto] gap-4 py-3">
              <dt class="text-neutral-500">Intraday return</dt>
              <dd class={`tabular-nums ${positive() ? "text-emerald-300" : "text-red-300"}`}>
                {quote() ? formatSignedPercent(quote()!.changePercent) : "Pending"}
              </dd>
            </div>
            <div class="grid grid-cols-[1fr_auto] gap-4 py-3">
              <dt class="text-neutral-500">Market cap</dt>
              <dd class="tabular-nums text-neutral-200">
                {formatCompactNumber(quote()?.marketCap)}
              </dd>
            </div>
            <div class="grid grid-cols-[1fr_auto] gap-4 py-3">
              <dt class="text-neutral-500">P/E</dt>
              <dd class="tabular-nums text-neutral-200">{quote()?.peRatio ?? "n/a"}</dd>
            </div>
          </dl>

          <div class="mt-5 space-y-2 text-sm">
            <p class="text-xs font-medium uppercase tracking-wide text-neutral-500">Data status</p>
            <div class="flex items-center justify-between gap-3">
              <span class="text-neutral-500">Freshness</span>
              <span class="text-neutral-200">{freshnessLabel()}</span>
            </div>
            <div class="flex items-center justify-between gap-3">
              <span class="text-neutral-500">History</span>
              <span class="text-neutral-200">{historyStatusLabel(selected().historyStatus)}</span>
            </div>
            <div class="flex items-center justify-between gap-3">
              <span class="text-neutral-500">Provider</span>
              <span class="text-neutral-200">{sourceLabel(selectedSource())}</span>
            </div>
            <div class="flex items-center justify-between gap-3">
              <span class="text-neutral-500">Transport</span>
              <span class="text-neutral-200">REST</span>
            </div>
            <div class="flex items-center justify-between gap-3">
              <span class="text-neutral-500">Session</span>
              <span class="text-neutral-200">{marketSessionLabel(quote()?.updatedAt)}</span>
            </div>
            <Show when={selectedSource() === "mock"}>
              <div class="flex items-center justify-between gap-3">
                <span class="text-neutral-500">Mode</span>
                <span class="text-neutral-200">Offline demo</span>
              </div>
            </Show>
            <div class="flex items-center justify-between gap-3">
              <span class="text-neutral-500">Updated</span>
              <span class="text-right text-neutral-200">
                {formatMarketTimestamp(quote()?.updatedAt)}
              </span>
            </div>
            <Show when={selected().stale}>
              <p class="border-l-2 border-amber-300 bg-amber-300/10 px-3 py-2 text-amber-100">
                Cached quote. Data may not reflect the latest market activity.
              </p>
            </Show>
          </div>
        </aside>
      </section>
    </main>
  );
}
