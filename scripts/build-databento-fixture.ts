import { createInterface } from "node:readline";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";

import { FIXTURE_SYMBOL_DETAILS } from "../apps/web/src/features/market-data/symbol-universe";

type TimeRange = "1D" | "1W" | "1M";

interface DatabentoRecord {
  hd?: {
    ts_event?: string | number;
  };
  open?: string | number;
  high?: string | number;
  low?: string | number;
  close?: string | number;
  volume?: string | number;
  symbol?: string;
}

interface Bar {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const DEFAULT_SOURCE_DIR = "data/raw/databento";
const DEFAULT_OUTPUT = "data/databento-market-data.json";
const ONE_MINUTE_MS = 60 * 1000;
const FIVE_MINUTES_MS = 5 * ONE_MINUTE_MS;
const ONE_HOUR_MS = 60 * ONE_MINUTE_MS;

const args = new Map(
  process.argv.slice(2).flatMap((arg) => {
    const [key, value] = arg.split("=");
    return key && value ? [[key.replace(/^--/, ""), value] as const] : [];
  }),
);

function toNumber(value: string | number | undefined) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function timestampFromRecord(record: DatabentoRecord) {
  const value = record.hd?.ts_event;
  if (value === undefined) return undefined;
  if (typeof value === "number") return new Date(value / 1_000_000).toISOString();
  if (/^\d+$/.test(value)) return new Date(Number(value) / 1_000_000).toISOString();

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function toEtParts(timestamp: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
  }).formatToParts(new Date(timestamp));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));

  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: hour * 60 + minute,
  };
}

function isRegularSession(timestamp: string) {
  const { minutes } = toEtParts(timestamp);
  return minutes >= 9 * 60 + 30 && minutes < 16 * 60;
}

function aggregateBars(bars: readonly Bar[], intervalMs: number) {
  const buckets = new Map<number, Bar>();

  for (const bar of bars) {
    const bucketTime = Math.floor(Date.parse(bar.timestamp) / intervalMs) * intervalMs;
    const current = buckets.get(bucketTime);

    if (!current) {
      buckets.set(bucketTime, { ...bar, timestamp: new Date(bucketTime).toISOString() });
      continue;
    }

    current.high = Math.max(current.high, bar.high);
    current.low = Math.min(current.low, bar.low);
    current.close = bar.close;
    current.volume += bar.volume;
  }

  return [...buckets.values()].sort(
    (left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp),
  );
}

function findZst(sourceDir: string, schema: string) {
  const find = spawn("find", [sourceDir, "-name", `*.${schema}.json.zst`, "-print"]);
  let output = "";
  find.stdout.on("data", (chunk) => {
    output += String(chunk);
  });

  return new Promise<string>((resolve, reject) => {
    find.on("error", reject);
    find.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`find failed for ${schema}`));
        return;
      }

      const file = output.trim().split("\n").filter(Boolean)[0];
      if (!file) {
        reject(new Error(`No Databento ${schema} export found in ${sourceDir}`));
        return;
      }

      resolve(file);
    });
  });
}

async function readBarsBySymbol(file: string) {
  const zstd = spawn("zstd", ["-dc", file]);
  const lines = createInterface({ input: zstd.stdout });
  const barsBySymbol = new Map<string, Bar[]>();

  for await (const line of lines) {
    const record = JSON.parse(line) as DatabentoRecord;
    const symbol = record.symbol;
    const timestamp = timestampFromRecord(record);
    const open = toNumber(record.open);
    const high = toNumber(record.high);
    const low = toNumber(record.low);
    const close = toNumber(record.close);
    const volume = toNumber(record.volume);

    if (
      !symbol ||
      !timestamp ||
      open === undefined ||
      high === undefined ||
      low === undefined ||
      close === undefined
    ) {
      continue;
    }

    const bars = barsBySymbol.get(symbol) ?? [];
    bars.push({
      timestamp,
      open: roundMoney(open),
      high: roundMoney(high),
      low: roundMoney(low),
      close: roundMoney(close),
      volume: volume ?? 0,
    });
    barsBySymbol.set(symbol, bars);
  }

  await new Promise<void>((resolve, reject) => {
    zstd.on("error", reject);
    zstd.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`zstd failed for ${file}`)),
    );
  });

  for (const bars of barsBySymbol.values()) {
    bars.sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp));
  }

  return barsBySymbol;
}

function latestEtDate(bars: readonly Bar[]) {
  const latest = bars.at(-1);
  return latest ? toEtParts(latest.timestamp).date : undefined;
}

function dailyBarDate(bar: Bar) {
  return bar.timestamp.slice(0, 10);
}

function previousClose(symbol: string, dailyBars: readonly Bar[], latestDate: string) {
  const previous = dailyBars.filter((bar) => dailyBarDate(bar) < latestDate).at(-1);
  if (previous) return previous.close;

  const info = FIXTURE_SYMBOL_DETAILS[symbol];
  throw new Error(`Unable to determine previous close for ${symbol} (${info?.name ?? "unknown"})`);
}

function takeLastRegularSessionDays(bars: readonly Bar[], days: number) {
  const regular = bars.filter((bar) => isRegularSession(bar.timestamp));
  const dates = [...new Set(regular.map((bar) => toEtParts(bar.timestamp).date))].slice(-days);
  const allowed = new Set(dates);

  return regular.filter((bar) => allowed.has(toEtParts(bar.timestamp).date));
}

async function main() {
  const sourceDir = args.get("source") ?? DEFAULT_SOURCE_DIR;
  const output = args.get("output") ?? DEFAULT_OUTPUT;
  const [oneMinuteFile, oneDayFile] = await Promise.all([
    findZst(sourceDir, "ohlcv-1m"),
    findZst(sourceDir, "ohlcv-1d"),
  ]);
  const [oneMinuteBars, oneDayBars] = await Promise.all([
    readBarsBySymbol(oneMinuteFile),
    readBarsBySymbol(oneDayFile),
  ]);

  const symbols = [...oneMinuteBars.keys()].filter((symbol) => FIXTURE_SYMBOL_DETAILS[symbol]).sort();
  const equities = symbols.map((symbol) => {
    const bars = oneMinuteBars.get(symbol) ?? [];
    const dailyBars = oneDayBars.get(symbol) ?? [];
    const date = latestEtDate(bars);
    if (!date) throw new Error(`No 1m bars for ${symbol}`);

    const dayBars = bars.filter((bar) => toEtParts(bar.timestamp).date === date);
    const regularMonthBars = takeLastRegularSessionDays(bars, 23);
    const weekBars = takeLastRegularSessionDays(bars, 5);
    const info = FIXTURE_SYMBOL_DETAILS[symbol];
    const quote = bars.at(-1);
    if (!quote) throw new Error(`No latest quote bar for ${symbol}`);

    return {
      symbol,
      name: info.name,
      exchange: info.exchange,
      currency: info.currency,
      previousClose: previousClose(symbol, dailyBars, date),
      quote,
      history: {
        "1D": {
          granularity: "1m",
          session: "extended",
          bars: dayBars,
        },
        "1W": {
          granularity: "5m",
          session: "regular",
          bars: aggregateBars(weekBars, FIVE_MINUTES_MS),
        },
        "1M": {
          granularity: "1h",
          session: "regular",
          bars: aggregateBars(regularMonthBars, ONE_HOUR_MS),
        },
      } satisfies Record<TimeRange, unknown>,
    };
  });

  const metadata = JSON.parse(
    readFileSync(join(dirname(oneMinuteFile), "metadata.json"), "utf8"),
  ) as {
    job_id?: string;
    query?: { dataset?: string };
  };
  const fixture = {
    source: "databento",
    dataset: metadata.query?.dataset ?? "XNAS.ITCH",
    schema: "app-chart-fixture-v1",
    requestId: metadata.job_id ?? "local-databento-download",
    generatedAt: new Date().toISOString(),
    sourceFiles: {
      "ohlcv-1m": oneMinuteFile.replace(`${sourceDir}/`, ""),
      "ohlcv-1d": oneDayFile.replace(`${sourceDir}/`, ""),
    },
    equities,
  };

  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(fixture, null, 2)}\n`);

  const summary = equities.map((equity) => ({
    symbol: equity.symbol,
    "1D": equity.history["1D"].bars.length,
    "1W": equity.history["1W"].bars.length,
    "1M": equity.history["1M"].bars.length,
  }));
  console.log(JSON.stringify(summary, null, 2));
  console.log(`Wrote ${output}`);
}

await main();
