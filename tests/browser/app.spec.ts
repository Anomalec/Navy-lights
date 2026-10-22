import { test, expect, type Page } from "@playwright/test";

async function openNav(page: Page, label: string) {
  const menu = page.getByRole("button", { name: "Открыть меню" });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("button", { name: label, exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("shows the original image without leaking its answer; tap reveals the PDF caption", async ({
  page,
}) => {
  await expect(page.locator(".card-illustration")).toHaveAttribute(
    "src",
    "/cards/001.webp",
  );
  await expect(page.locator(".answer-text")).toHaveCount(0);
  await expect(page.locator(".card-illustration")).toBeVisible();
  await page
    .getByRole("button", { name: "Показать ответ на карточку" })
    .click();
  await expect(page.locator(".answer-text")).toContainText(
    "длиной менее 50 м. Идёт на нас. Правило 23 (а)",
  );
  await expect(page.locator(".answer-source")).toContainText(
    "страница 1, карточка 1",
  );
  await page.getByLabel("Скрыть ответ", { exact: true }).click();
  await expect(page.locator(".answer-text")).toHaveCount(0);
  await expect(page.locator(".card-illustration")).toHaveAttribute(
    "src",
    "/cards/001.webp",
  );
});

test("records both answers, restores them after reload, and filters the review deck", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect(page.locator(".card-illustration")).toHaveAttribute(
    "src",
    "/cards/002.webp",
  );
  await page.getByRole("button", { name: "Знаю", exact: true }).click();
  await expect(page.locator(".card-illustration")).toHaveAttribute(
    "src",
    "/cards/003.webp",
  );
  await page.reload();
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("navy-lights.progress.v1")!),
  );
  expect(stored.cards["001"].status).toBe("review");
  expect(stored.cards["002"].status).toBe("known");
  await page
    .locator(".segmented")
    .getByRole("button", { name: /Повторить/ })
    .click();
  await expect(page.locator(".deck-size")).toHaveText("1 карточка");
  await expect(page.locator(".card-illustration")).toHaveAttribute(
    "src",
    "/cards/001.webp",
  );
  await page.getByRole("button", { name: "Знаю", exact: true }).click();
  await expect(page.getByText("Колода пройдена!")).toBeVisible();
});

test("undo restores the card, its prior status, and the daily count", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Знаю", exact: true }).click();
  await expect(page.locator(".card-illustration")).toHaveAttribute(
    "src",
    "/cards/002.webp",
  );
  await page.getByRole("button", { name: "Отменить действие" }).click();
  await expect(page.locator(".card-illustration")).toHaveAttribute(
    "src",
    "/cards/001.webp",
  );
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("navy-lights.progress.v1")!),
  );
  expect(stored.cards).toEqual({});
  expect(stored.days).toEqual({});
});

test("horizontal swipes advance and mark a card without accidentally revealing the answer", async ({
  page,
}) => {
  const card = page.locator(".flashcard");
  const box = (await card.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.45, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width * 0.45 + 120,
    box.y + box.height / 2,
    { steps: 10 },
  );
  await page.mouse.up();
  await expect(page.locator(".card-illustration")).toHaveAttribute(
    "src",
    "/cards/002.webp",
  );
  await expect(page.locator(".answer-text")).toHaveCount(0);
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("navy-lights.progress.v1")!),
  );
  expect(stored.cards["001"].status).toBe("known");
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6 - 120, box.y + box.height / 2, {
    steps: 10,
  });
  await page.mouse.up();
  await expect(page.locator(".card-illustration")).toHaveAttribute(
    "src",
    "/cards/003.webp",
  );
  const after = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("navy-lights.progress.v1")!),
  );
  expect(after.cards["002"].status).toBe("review");
});

test("filters the actual PDF illustrations, handles an empty review deck, and searches the collection", async ({
  page,
}) => {
  await page.getByLabel("Тип иллюстрации").selectOption("day");
  await expect(page.locator(".deck-size")).toHaveText("23 карточки");
  await expect(page.locator(".card-illustration")).toHaveAttribute(
    "src",
    "/cards/036.webp",
  );
  await page
    .locator(".segmented")
    .getByRole("button", { name: /Повторить/ })
    .click();
  await expect(page.getByText("Пока нечего повторять")).toBeVisible();
  await page
    .locator(".segmented")
    .getByRole("button", { name: "Все карточки" })
    .click();
  await page.getByLabel("Тип иллюстрации").selectOption("all");
  await openNav(page, "Все карточки 144");
  await expect(page.locator(".library-card")).toHaveCount(144);
  await page.getByLabel("Поиск карточек").fill("оранжевого");
  await expect(page.locator(".library-card")).toHaveCount(1);
  await page.locator(".library-card").click();
  await expect(page.locator(".card-illustration")).toHaveAttribute(
    "src",
    "/cards/144.webp",
  );
});

test("reset requires explicit confirmation and keyboard controls work", async ({
  page,
}) => {
  await page.keyboard.press("Space");
  await expect(page.locator(".answer-text")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".card-illustration")).toHaveAttribute(
    "src",
    "/cards/002.webp",
  );
  await openNav(page, "Мой прогресс");
  await page.getByRole("button", { name: "Сбросить прогресс" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Сохранить прогресс" }).click();
  await expect(page.locator(".stats-cards .text-green")).toHaveText("1");
  await page.getByRole("button", { name: "Сбросить прогресс" }).click();
  await page.getByRole("button", { name: "Сбросить", exact: true }).click();
  await expect(page.locator(".stats-cards .text-green")).toHaveText("0");
});

test("all cards and the app remain usable offline after initial caching", async ({
  page,
  context,
}) => {
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          if (!navigator.serviceWorker.controller) return false;
          const cache = await caches.open("navy-lights-v2");
          const keys = await cache.keys();
          return (
            keys.some((key) => new URL(key.url).pathname === "/") &&
            keys.filter((key) => key.url.includes("/cards/")).length === 144 &&
            keys.some((key) => key.url.includes(".js"))
          );
        }),
      { timeout: 20000 },
    )
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator(".card-illustration")).toHaveAttribute(
    "src",
    "/cards/001.webp",
  );
  await page.getByLabel("Тема карточек").selectOption("distress");
  await expect(page.locator(".card-illustration")).toHaveAttribute(
    "src",
    "/cards/138.webp",
  );
  await expect
    .poll(() =>
      page
        .locator(".card-illustration")
        .evaluate(
          (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
        ),
    )
    .toBe(true);
});

test("fits the viewport and shows a readable answer without horizontal overflow", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Показать ответ на карточку" })
    .click();
  await expect(page.locator(".answer-text")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/answer-${test.info().project.name}.png`,
    fullPage: true,
    animations: "disabled",
  });
});
