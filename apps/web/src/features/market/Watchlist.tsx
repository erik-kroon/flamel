import { For } from "solid-js";

import { formatPrice, formatSigned } from "@/lib/format";
import { formatAge } from "@/lib/time";
import type { QuoteState } from "@/features/terminal/createTerminalModel";
import type { SymbolCode } from "@/protocol/events";

interface WatchlistProps {
  symbols: SymbolCode[];
  selectedSymbol: SymbolCode;
  quotes: Partial<Record<SymbolCode, QuoteState>>;
  now: number;
  onSelect: (symbol: SymbolCode) => void;
}

export function Watchlist(props: WatchlistProps) {
  return (
    <section class="panel watchlist-panel" aria-label="Market overview">
      <div class="panel-heading">
        <h2>Watchlist</h2>
        <span>{props.symbols.length} symbols</span>
      </div>
      <div class="table-head watchlist-grid">
        <span>Symbol</span>
        <span>Bid</span>
        <span>Ask</span>
        <span>Age</span>
      </div>
      <div class="watchlist-rows">
        <For each={props.symbols}>
          {(symbol) => {
            const quote = () => props.quotes[symbol];
            const stale = () => (quote() ? props.now - quote()!.updatedAt > 2500 : true);
            return (
              <button
                type="button"
                class={`watchlist-row watchlist-grid ${props.selectedSymbol === symbol ? "selected" : ""}`}
                onClick={() => props.onSelect(symbol)}
              >
                <span class="symbol-cell">
                  {symbol}
                  <small class={stale() ? "stale-text" : ""}>{stale() ? "STALE" : "LIVE"}</small>
                </span>
                <span>{quote() ? formatPrice(quote()!.bid) : "--"}</span>
                <span>{quote() ? formatPrice(quote()!.ask) : "--"}</span>
                <span class={stale() ? "stale-text" : ""}>
                  {quote() ? formatAge(quote()!.updatedAt, props.now) : "--"}
                </span>
                <span
                  class={`row-change ${quote() && quote()!.change >= 0 ? "positive" : "negative"}`}
                >
                  {quote() ? formatSigned(quote()!.change) : ""}
                </span>
              </button>
            );
          }}
        </For>
      </div>
    </section>
  );
}
