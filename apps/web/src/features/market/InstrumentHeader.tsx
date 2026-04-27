import { formatBasisPoints, formatPrice, formatQuantity, formatSigned } from "@/lib/format";
import { formatAge } from "@/lib/time";
import type { QuoteState } from "@/features/terminal/createTerminalModel";
import type { SymbolCode } from "@/protocol/events";

interface InstrumentHeaderProps {
  symbol: SymbolCode;
  quote?: QuoteState;
  now: number;
}

export function InstrumentHeader(props: InstrumentHeaderProps) {
  const mid = () => (props.quote ? (props.quote.bid + props.quote.ask) / 2 : 0);
  const spreadBps = () =>
    props.quote && mid() > 0 ? ((props.quote.ask - props.quote.bid) / mid()) * 10000 : 0;
  const stale = () => !props.quote || props.now - props.quote.updatedAt > 2500;

  return (
    <section class="instrument-header" aria-label="Selected instrument">
      <div>
        <span class="eyebrow">Selected instrument</span>
        <h1>{props.symbol}</h1>
      </div>
      <div class="quote-stack">
        <QuoteMetric label="Bid" value={props.quote ? formatPrice(props.quote.bid) : "--"} />
        <QuoteMetric label="Ask" value={props.quote ? formatPrice(props.quote.ask) : "--"} />
        <QuoteMetric
          label="Last"
          value={props.quote?.last ? formatPrice(props.quote.last) : "--"}
        />
        <QuoteMetric label="Spread" value={props.quote ? formatBasisPoints(spreadBps()) : "--"} />
        <QuoteMetric
          label="Size"
          value={
            props.quote
              ? `${formatQuantity(props.quote.bidSize)} / ${formatQuantity(props.quote.askSize)}`
              : "--"
          }
        />
        <QuoteMetric
          label="Age"
          value={props.quote ? formatAge(props.quote.updatedAt, props.now) : "--"}
          tone={stale() ? "warn" : undefined}
        />
        <QuoteMetric
          label="Move"
          value={props.quote ? formatSigned(props.quote.change) : "--"}
          tone={props.quote && props.quote.change < 0 ? "down" : "up"}
        />
      </div>
    </section>
  );
}

function QuoteMetric(props: { label: string; value: string; tone?: "warn" | "up" | "down" }) {
  return (
    <div class={`quote-metric ${props.tone ? `tone-${props.tone}` : ""}`}>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}
