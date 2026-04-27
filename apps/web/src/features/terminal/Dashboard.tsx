import { createSignal, onCleanup, onMount } from "solid-js";

import { PriceChart } from "@/features/chart/PriceChart";
import { DebugDrawer } from "@/features/debug/DebugDrawer";
import { InstrumentHeader } from "@/features/market/InstrumentHeader";
import { QuoteTape } from "@/features/market/QuoteTape";
import { Watchlist } from "@/features/market/Watchlist";
import { OrderBlotter } from "@/features/orders/OrderBlotter";
import { OrderTicket } from "@/features/orders/OrderTicket";
import { PositionsTable } from "@/features/portfolio/PositionsTable";
import { ConnectionStrip } from "@/features/stream/ConnectionStrip";
import { createTerminalModel } from "@/features/terminal/createTerminalModel";

export function Dashboard() {
  const terminal = createTerminalModel();
  const [now, setNow] = createSignal(Date.now());
  const clock = window.setInterval(() => setNow(Date.now()), 250);

  onMount(() => terminal.start());
  onCleanup(() => {
    window.clearInterval(clock);
    terminal.stop();
  });

  return (
    <main class="terminal-shell">
      <ConnectionStrip
        connection={terminal.state.stream.connection}
        mode={terminal.state.stream.mode}
        source={terminal.state.stream.source}
        sequence={terminal.state.stream.sequence}
        gapCount={terminal.state.stream.gapCount}
        sourceLagMs={terminal.state.stream.sourceLagMs}
        eventRate={terminal.state.stream.eventRate}
        lastEventAt={terminal.state.stream.lastEventAt}
        debugOpen={terminal.state.stream.debugOpen}
        onToggleDebug={terminal.toggleDebug}
      />

      <div class="workspace-grid">
        <Watchlist
          symbols={terminal.symbols()}
          selectedSymbol={terminal.state.market.selectedSymbol}
          quotes={terminal.state.market.quotes}
          now={now()}
          onSelect={terminal.selectSymbol}
        />

        <div class="center-stack">
          <InstrumentHeader
            symbol={terminal.state.market.selectedSymbol}
            quote={terminal.selectedQuote()}
            now={now()}
          />
          <PriceChart points={terminal.selectedChart()} />
          <QuoteTape rows={terminal.selectedTape()} />
        </div>

        <aside class="right-rail">
          <OrderTicket
            symbol={terminal.state.market.selectedSymbol}
            quote={terminal.selectedQuote()}
            onSubmit={terminal.submitOrder}
          />
          <OrderBlotter orders={terminal.state.orders} />
          <PositionsTable
            positions={terminal.positions()}
            realized={terminal.pnlSummary().realized}
            unrealized={terminal.pnlSummary().unrealized}
            exposure={terminal.pnlSummary().exposure}
            now={now()}
          />
        </aside>
      </div>

      <DebugDrawer
        open={terminal.state.stream.debugOpen}
        events={terminal.state.stream.rawEvents}
      />
    </main>
  );
}
