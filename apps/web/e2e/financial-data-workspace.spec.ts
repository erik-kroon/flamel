import { expect, test } from "@playwright/test";

const WATCHLIST_STORAGE_KEY = "flamel.watchlist.symbols";

async function openWorkspace(page: import("@playwright/test").Page) {
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Flamel" })).toBeVisible();
  await expect(page.locator('[aria-label="Symbols"]')).toBeVisible();
  await expect(page.getByRole("region", { name: "Price history" })).toBeVisible();
}

test.describe("financial data workspace", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((key) => {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // Storage can be unavailable during browser bootstrap; the app handles that path.
      }
    }, WATCHLIST_STORAGE_KEY);
  });

  test("renders the default fixture-backed dashboard", async ({ page }) => {
    await openWorkspace(page);

    await expect(page.getByRole("button", { name: /AAPL, Apple Inc\./ })).toHaveAttribute(
      "aria-current",
      "true",
    );
    await expect(page.getByRole("heading", { name: "Apple Inc." })).toBeVisible();
    await expect(page.getByText("Databento", { exact: true })).toBeVisible();
    await expect(page.getByText("Last", { exact: true })).toBeVisible();
    await expect(page.getByText("$270.94").first()).toBeVisible();
    await expect(page.getByRole("img", { name: /AAPL 1D price history/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Show 1D price history" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("selects watchlist rows and preserves keyboard navigation semantics", async ({ page }) => {
    await openWorkspace(page);

    await page.getByRole("button", { name: /MSFT, Microsoft Corporation/ }).click();
    await expect(page.getByRole("heading", { name: "Microsoft Corporation" })).toBeVisible();
    await expect(page.getByRole("button", { name: /MSFT, Microsoft Corporation/ })).toHaveAttribute(
      "aria-current",
      "true",
    );

    await page.getByRole("button", { name: /MSFT, Microsoft Corporation/ }).focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("button", { name: /NVDA, NVIDIA Corporation/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
    await expect(page.getByRole("heading", { name: "NVIDIA Corporation" })).toBeVisible();
  });

  test("switches time ranges and exposes chart keyboard feedback", async ({ page }) => {
    await openWorkspace(page);

    await page.getByRole("button", { name: "Show 1M price history" }).click();
    await expect(page.getByRole("button", { name: "Show 1M price history" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByRole("img", { name: /AAPL 1M price history/ })).toBeVisible();

    const chart = page.getByRole("img", { name: /AAPL 1M price history/ });
    await chart.focus();
    await page.keyboard.press("Home");
    await expect(page.locator(".chart-tooltip")).toBeVisible();
    await expect(page.locator(".chart-axis-label").first()).toBeVisible();
    await expect(page.getByText(/Open|Close/).last()).toBeVisible();
    await page.keyboard.press("End");
    await expect(chart).toBeFocused();
  });

  test("adds supported fixture symbols and rejects unsupported symbols", async ({ page }) => {
    await openWorkspace(page);

    await page.getByLabel("Add symbol").fill("voo");
    await page.getByTitle("Add symbol").click();
    await expect(page.getByRole("button", { name: /VOO, Vanguard S&P 500 ETF/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
    await expect(page.getByRole("heading", { name: "Vanguard S&P 500 ETF" })).toBeVisible();

    await page.getByLabel("Add symbol").fill("NOPE");
    await page.getByTitle("Add symbol").click();
    await expect(page.getByRole("status")).toContainText("bundled fixture universe");
    await expect(page.getByRole("button", { name: /NOPE/ })).toHaveCount(0);
  });

  test("suggests remaining bundled fixture symbols while adding to the watchlist", async ({
    page,
  }) => {
    await openWorkspace(page);

    const input = page.getByLabel("Add symbol");
    await input.focus();

    await expect(page.getByRole("option", { name: /QQQ Invesco QQQ Trust/ })).toBeVisible();
    await expect(page.getByRole("option", { name: /SPY SPDR S&P 500 ETF Trust/ })).toBeVisible();
    await expect(page.getByRole("option", { name: /VOO Vanguard S&P 500 ETF/ })).toBeVisible();
    await expect(page.getByRole("option", { name: /AAPL/ })).toHaveCount(0);

    await input.fill("q");
    await expect(page.getByRole("option", { name: /QQQ Invesco QQQ Trust/ })).toBeVisible();
    await expect(page.getByRole("option", { name: /VOO/ })).toHaveCount(0);

    await page.getByRole("option", { name: /QQQ Invesco QQQ Trust/ }).click();
    await expect(page.getByRole("button", { name: /QQQ, Invesco QQQ Trust/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
    await expect(input).toHaveValue("");

    await input.fill("IBM");
    await expect(page.getByText("No bundled fixture for IBM")).toBeVisible();
  });

  test("restores a locally persisted watchlist", async ({ page }) => {
    await page.addInitScript(
      ({ key, symbols }) => {
        window.localStorage.setItem(key, JSON.stringify(symbols));
      },
      { key: WATCHLIST_STORAGE_KEY, symbols: ["VOO", "AAPL"] },
    );

    await openWorkspace(page);

    await expect(page.locator("[data-watchlist-symbol]")).toHaveCount(2);
    await expect(page.getByRole("button", { name: /VOO, Vanguard S&P 500 ETF/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
    await expect(page.getByRole("heading", { name: "Vanguard S&P 500 ETF" })).toBeVisible();
  });
});
