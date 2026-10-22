import { test, expect } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import type { AddressInfo } from "node:net";

let server: Server;
let origin: string;
const dist = resolve("dist");

test.beforeAll(async () => {
  // Deliberately reject root assets: a root-only deployment must not hide failures.
  server = createServer(async (request, response) => {
    const pathname = new URL(request.url!, "http://localhost").pathname;
    if (!pathname.startsWith("/Navy-lights/")) {
      response.writeHead(404).end();
      return;
    }
    const relative = pathname.slice("/Navy-lights/".length) || "index.html";
    const path = resolve(dist, relative);
    if (!path.startsWith(dist + sep)) {
      response.writeHead(403).end();
      return;
    }
    try {
      const data = await readFile(path);
      const types: Record<string, string> = {
        ".html": "text/html; charset=utf-8",
        ".js": "application/javascript",
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".webp": "image/webp",
        ".woff2": "font/woff2",
        ".webmanifest": "application/manifest+json",
      };
      response
        .writeHead(200, {
          "Content-Type": types[extname(path)] || "application/octet-stream",
        })
        .end(data);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test.afterAll(async () => {
  await new Promise<void>((done, reject) =>
    server.close((error) => (error ? reject(error) : done())),
  );
});

test("loads in a hosting subdirectory and can reload there offline", async ({
  page,
  context,
}) => {
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) failures.push(response.url());
  });
  await page.goto(`${origin}/Navy-lights/`);
  await expect(page.locator(".card-illustration")).toHaveAttribute(
    "src",
    "/Navy-lights/cards/001.webp",
  );
  await expect
    .poll(() =>
      page
        .locator(".card-illustration")
        .evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.getByLabel("Показать ответ на карточку").click();
  await expect(page.locator(".answer-text")).toContainText("Идёт на нас");
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const cache = await caches.open("navy-lights-v2");
        return (await cache.keys()).filter((key) =>
          key.url.includes("/Navy-lights/cards/"),
        ).length;
      }),
    )
    .toBe(144);
  expect(failures).toEqual([]);
  await context.setOffline(true);
  await page.reload();
  await page.getByLabel("Тема карточек").selectOption("distress");
  await expect
    .poll(() =>
      page
        .locator(".card-illustration")
        .evaluate(
          (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
        ),
    )
    .toBe(true);
  await expect(page.locator(".card-illustration")).toHaveAttribute(
    "src",
    "/Navy-lights/cards/138.webp",
  );
});

test("the single HTML export needs no scripts, fonts, or images from a server", async ({
  page,
}) => {
  const unexpected: string[] = [];
  await page.route("**/*", async (route) => {
    if (route.request().isNavigationRequest()) await route.continue();
    else {
      unexpected.push(route.request().url());
      await route.abort();
    }
  });
  await page.goto("/offline/index.html");
  await expect(page.locator(".card-illustration")).toHaveAttribute(
    "src",
    /^data:image\/webp;base64,/,
  );
  await expect
    .poll(() =>
      page
        .locator(".card-illustration")
        .evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.getByLabel("Показать ответ на карточку").click();
  await expect(page.locator(".answer-text")).toContainText("Идёт на нас");
  await page.getByRole("button", { name: "Знаю", exact: true }).click();
  await expect(page.locator(".card-topline")).toContainText("002");
  expect(unexpected).toEqual([]);
});

test("a failed script download shows an explanation instead of an empty page", async ({
  page,
}) => {
  await page.route("**/assets/*.js", (route) => route.abort());
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText(
    "Не удалось загрузить приложение",
  );
  await expect(page.getByRole("status")).toContainText("всю папку dist");
});
