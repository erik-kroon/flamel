import { SendHorizontal } from "lucide-solid";
import { createEffect, createMemo, createSignal, on } from "solid-js";

import { formatPrice } from "@/lib/format";
import type { OrderIntent, QuoteState } from "@/features/terminal/createTerminalModel";
import type { OrderKind, Side, SymbolCode } from "@/protocol/events";

interface OrderTicketProps {
  symbol: SymbolCode;
  quote?: QuoteState;
  onSubmit: (intent: OrderIntent) => void;
}

export function OrderTicket(props: OrderTicketProps) {
  const [side, setSide] = createSignal<Side>("buy");
  const [kind, setKind] = createSignal<OrderKind>("market");
  const [quantity, setQuantity] = createSignal(100);
  const [limitPrice, setLimitPrice] = createSignal("");
  const [priceTouched, setPriceTouched] = createSignal(false);

  createEffect(
    on(
      () => [props.symbol, side()] as const,
      () => {
        if (props.quote) {
          setLimitPrice(formatPrice(side() === "buy" ? props.quote.ask : props.quote.bid));
        }
        setPriceTouched(false);
      },
    ),
  );

  createEffect(() => {
    if (props.quote && !priceTouched()) {
      setLimitPrice(formatPrice(side() === "buy" ? props.quote.ask : props.quote.bid));
    }
  });

  const parsedLimit = createMemo(() => Number(limitPrice().replaceAll(",", "")));
  const validation = createMemo(() => {
    if (!Number.isFinite(quantity()) || quantity() <= 0) {
      return "Quantity must be positive";
    }
    if (kind() === "limit" && (!Number.isFinite(parsedLimit()) || parsedLimit() <= 0)) {
      return "Limit price is required";
    }
    if (!props.quote) {
      return "No quote available";
    }
    return undefined;
  });

  const preview = createMemo(() => {
    if (!props.quote) {
      return "Waiting for quote";
    }
    const price =
      kind() === "market" ? (side() === "buy" ? props.quote.ask : props.quote.bid) : parsedLimit();
    return `${side().toUpperCase()} ${quantity()} ${props.symbol} ${kind().toUpperCase()} @ ${formatPrice(price)}`;
  });

  function submit() {
    if (validation()) {
      return;
    }

    props.onSubmit({
      symbol: props.symbol,
      side: side(),
      kind: kind(),
      quantity: quantity(),
      limitPrice: kind() === "limit" ? parsedLimit() : undefined,
    });
  }

  return (
    <section class="panel order-ticket" aria-label="Order ticket">
      <div class="panel-heading">
        <h2>Order ticket</h2>
        <span>{props.symbol}</span>
      </div>

      <div class="segmented">
        <button
          class={side() === "buy" ? "active side-buy" : ""}
          type="button"
          onClick={() => setSide("buy")}
        >
          Buy
        </button>
        <button
          class={side() === "sell" ? "active side-sell" : ""}
          type="button"
          onClick={() => setSide("sell")}
        >
          Sell
        </button>
      </div>

      <div class="segmented compact">
        <button
          class={kind() === "market" ? "active" : ""}
          type="button"
          onClick={() => setKind("market")}
        >
          Market
        </button>
        <button
          class={kind() === "limit" ? "active" : ""}
          type="button"
          onClick={() => setKind("limit")}
        >
          Limit
        </button>
      </div>

      <label class="field">
        <span>Qty</span>
        <input
          min="1"
          type="number"
          value={quantity()}
          onInput={(event) => setQuantity(Number(event.currentTarget.value))}
        />
      </label>

      <label class={`field ${kind() === "market" ? "disabled" : ""}`}>
        <span>Price</span>
        <input
          disabled={kind() === "market"}
          inputMode="decimal"
          value={limitPrice()}
          onInput={(event) => {
            setPriceTouched(true);
            setLimitPrice(event.currentTarget.value);
          }}
        />
      </label>

      <div class="order-preview">
        <span>Preview</span>
        <strong>{preview()}</strong>
      </div>

      <button class="submit-order" disabled={Boolean(validation())} type="button" onClick={submit}>
        <SendHorizontal size={15} />
        Submit intent
      </button>

      <p class={validation() ? "validation visible" : "validation"}>{validation() ?? "Ready"}</p>
    </section>
  );
}
