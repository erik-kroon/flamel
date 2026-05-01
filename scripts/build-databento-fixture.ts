import { createInterface } from "node:readline";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";

import {
  aggregateDatabentoFixtureBars,
  createDatabentoFixtureFile,
  parseDatabentoOhlcvBar,
  type DatabentoFixtureBar,
  type DatabentoFixtureFile,
  type DatabentoOhlcvRecord,
} from "../apps/web/src/features/market-data/databento-fixture";
import {
  isRegularSession,
  marketDateKey,
} from "../apps/web/src/features/market-data/market-session";
import { FIXTURE_SYMBOL_DETAILS } from "../apps/web/src/features/market-data/symbol-universe";

type TimeRange = "1D" | "1W" | "1M";

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
  const barsBySymbol = new Map<string, DatabentoFixtureBar[]>();

  for await (const line of lines) {
    const parsed = parseDatabentoOhlcvBar(JSON.parse(line) as DatabentoOhlcvRecord);

    if (!parsed?.symbol) {
      continue;
    }

    const bars = barsBySymbol.get(parsed.symbol) ?? [];
    bars.push(parsed.bar);
    barsBySymbol.set(parsed.symbol, bars);
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

function latestEtDate(bars: readonly DatabentoFixtureBar[]) {
  const latest = bars.at(-1);
  return latest ? marketDateKey(latest.timestamp) : undefined;
}

function dailyBarDate(bar: DatabentoFixtureBar) {
  return bar.timestamp.slice(0, 10);
}

function previousClose(
  symbol: string,
  dailyBars: readonly DatabentoFixtureBar[],
  latestDate: string,
) {
  const previous = dailyBars.filter((bar) => dailyBarDate(bar) < latestDate).at(-1);
  if (previous) return previous.close;

  const info = FIXTURE_SYMBOL_DETAILS[symbol];
  throw new Error(`Unable to determine previous close for ${symbol} (${info?.name ?? "unknown"})`);
}

function takeLastRegularSessionDays(bars: readonly DatabentoFixtureBar[], days: number) {
  const regular = bars.filter((bar) => isRegularSession(bar.timestamp));
  const dates = [...new Set(regular.map((bar) => marketDateKey(bar.timestamp)))].slice(-days);
  const allowed = new Set(dates);

  return regular.filter((bar) => allowed.has(marketDateKey(bar.timestamp)));
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

  const symbols = [...oneMinuteBars.keys()]
    .filter((symbol) => FIXTURE_SYMBOL_DETAILS[symbol])
    .sort();
  const equities = symbols.map((symbol) => {
    const bars = oneMinuteBars.get(symbol) ?? [];
    const dailyBars = oneDayBars.get(symbol) ?? [];
    const date = latestEtDate(bars);
    if (!date) throw new Error(`No 1m bars for ${symbol}`);

    const dayBars = bars.filter((bar) => marketDateKey(bar.timestamp) === date);
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
          bars: aggregateDatabentoFixtureBars(weekBars, FIVE_MINUTES_MS),
        },
        "1M": {
          granularity: "1h",
          session: "regular",
          bars: aggregateDatabentoFixtureBars(regularMonthBars, ONE_HOUR_MS),
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
  const fixture = createDatabentoFixtureFile({
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
  } satisfies DatabentoFixtureFile);

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
