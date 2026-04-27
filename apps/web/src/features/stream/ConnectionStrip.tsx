import { Activity, Bug, Circle, RadioTower, RefreshCw } from "lucide-solid";
import type { JSX } from "solid-js";

import { formatAge } from "@/lib/time";
import type { ConnectionState } from "@/protocol/events";

interface ConnectionStripProps {
  connection: ConnectionState;
  mode: string;
  source: string;
  sequence: number;
  gapCount: number;
  sourceLagMs: number;
  eventRate: number;
  lastEventAt: number;
  debugOpen: boolean;
  onToggleDebug: () => void;
}

export function ConnectionStrip(props: ConnectionStripProps) {
  return (
    <header class="terminal-strip">
      <div class="brand-block">
        <span class="brand">FLAMEL</span>
        <span class="mode-pill">{props.mode.toUpperCase()}</span>
      </div>

      <div class="strip-metrics">
        <StatusDot state={props.connection} />
        <Metric icon={<RadioTower size={14} />} label={props.source} />
        <Metric label="seq" value={String(props.sequence)} />
        <Metric
          label="gaps"
          value={String(props.gapCount)}
          tone={props.gapCount > 0 ? "warn" : undefined}
        />
        <Metric label="lag" value={`${props.sourceLagMs}ms`} />
        <Metric
          icon={<Activity size={14} />}
          label="rate"
          value={`${props.eventRate.toFixed(1)}/s`}
        />
        <Metric icon={<RefreshCw size={14} />} label="last" value={formatAge(props.lastEventAt)} />
      </div>

      <button
        class="icon-button"
        type="button"
        aria-pressed={props.debugOpen}
        onClick={props.onToggleDebug}
      >
        <Bug size={15} />
        <span>{props.debugOpen ? "Close debug" : "Debug"}</span>
      </button>
    </header>
  );
}

function StatusDot(props: { state: ConnectionState }) {
  return (
    <span class={`status-dot status-${props.state}`}>
      <Circle size={9} fill="currentColor" />
      {props.state.toUpperCase()}
    </span>
  );
}

function Metric(props: { icon?: JSX.Element; label: string; value?: string; tone?: "warn" }) {
  return (
    <span class={`strip-metric ${props.tone === "warn" ? "metric-warn" : ""}`}>
      {props.icon}
      <span>{props.label}</span>
      {props.value ? <strong>{props.value}</strong> : null}
    </span>
  );
}
