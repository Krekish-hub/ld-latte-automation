// Isolated UI regression checks. Backend is intentionally mocked here;
// this does not validate real Supabase RLS or email delivery.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";

const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:5190";
let preview;
if (!process.env.TEST_BASE_URL) {
  preview = spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "--host",
      "127.0.0.1",
      "--port",
      "5190",
      "--strictPort",
    ],
    { stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
  );
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      preview.kill();
      reject(new Error("Preview startup timed out"));
    }, 20000);
    preview.stdout.on("data", (data) => {
      if (data.toString().includes("http://127.0.0.1:5190")) {
        clearTimeout(timeout);
        resolve();
      }
    });
    preview.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Preview exited: ${code}`));
    });
    preview.once("error", reject);
  });
}
const project = "wujloriefrsrarhbwpyr";
const user = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "demo@example.test",
  role: "authenticated",
  aud: "authenticated",
  created_at: "2026-10-29T08:00:00Z",
};
const rows = [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    user_id: user.id,
    title: "Бот для записи на обучение",
    description:
      "Собирать заявки на обучение и отправлять участникам напоминания.",
    category: "bot",
    status: "new",
    created_at: "2026-10-30T08:00:00Z",
    updated_at: "2026-10-30T08:00:00Z",
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    user_id: user.id,
    title: "Еженедельный отчёт по продажам",
    description: "Собирать результаты недели из таблиц в единый отчёт.",
    category: "report",
    status: "in_progress",
    created_at: "2026-10-29T08:00:00Z",
    updated_at: "2026-10-29T08:00:00Z",
  },
  {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    user_id: user.id,
    title: "Связать CRM и таблицу заказов",
    description: "Обновлять данные без ручного переноса.",
    category: "integration",
    status: "completed",
    created_at: "2026-10-28T08:00:00Z",
    updated_at: "2026-10-28T08:00:00Z",
  },
];
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined,
});
const errors = [];
let inserts = 0;
let signupRequests = 0;
let signupLimited = false;
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await context.route(`https://${project}.supabase.co/**`, async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.pathname.startsWith("/auth/")) {
      if (url.pathname.endsWith("/signup")) {
        signupRequests++;
        await new Promise((resolve) => setTimeout(resolve, 150));
        if (signupLimited)
          await route.fulfill({
            status: 429,
            json: {
              code: "over_email_send_rate_limit",
              msg: "email rate limit exceeded",
            },
          });
        else await route.fulfill({ json: { user, session: null } });
        return;
      }
      await route.fulfill({ json: { user } });
      return;
    }
    if (!url.pathname.endsWith("/requests")) {
      await route.fulfill({ status: 404, json: {} });
      return;
    }
    if (request.method() === "POST") {
      inserts++;
      const body = request.postDataJSON();
      await new Promise((resolve) => setTimeout(resolve, 350));
      const row = {
        ...body,
        user_id: user.id,
        status: "new",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      rows.unshift(row);
      await route.fulfill({ status: 201, json: row });
      return;
    }
    if (request.method() === "PATCH") {
      const id = url.searchParams.get("id")?.slice(3);
      const row = rows.find((r) => r.id === id);
      Object.assign(row, request.postDataJSON(), {
        updated_at: new Date().toISOString(),
      });
      await route.fulfill({ json: row });
      return;
    }
    let selected = [...rows];
    const id = url.searchParams.get("id")?.slice(3),
      status = url.searchParams.get("status")?.slice(3);
    if (id) selected = selected.filter((r) => r.id === id);
    if (status) selected = selected.filter((r) => r.status === status);
    const search = url.searchParams.get("title");
    if (search)
      selected = selected.filter((r) =>
        r.title.toLowerCase().includes(search.slice(7, -1).toLowerCase()),
      );
    await route.fulfill({
      json: id ? (selected[0] ?? null) : selected,
      headers: {
        "content-range": `0-${Math.max(0, selected.length - 1)}/${selected.length}`,
        "access-control-expose-headers": "content-range",
      },
    });
  });
  await page.goto(base + "/login");
  await page.getByRole("heading", { name: "С возвращением" }).waitFor();
  await mkdir("tmp/qa", { recursive: true });
  await page.screenshot({ path: "tmp/qa/login-desktop.png", fullPage: true });
  await page
    .getByRole("link", { name: "Создать аккаунт", exact: true })
    .click();
  await page.getByRole("heading", { name: "Давайте знакомиться" }).waitFor();
  await page.getByLabel("Электронная почта").fill("demo@example.test");
  await page.getByLabel("Пароль", { exact: true }).fill("Test-only-password1");
  await page
    .getByRole("button", { name: "Создать аккаунт", exact: true })
    .click();
  await page
    .locator("form")
    .evaluate((form) =>
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      ),
    );
  await page.getByRole("heading", { name: "Проверьте почту" }).waitFor();
  assert.equal(signupRequests, 1);
  assert.equal(await page.locator("form").count(), 0);
  assert.ok(
    await page
      .getByRole("button", { name: /Повторить отправку через/ })
      .isDisabled(),
  );
  await page.screenshot({
    path: "tmp/qa/signup-confirmation.png",
    fullPage: true,
  });
  signupLimited = true;
  await page.goto(base + "/register");
  await page.getByLabel("Электронная почта").fill("demo@example.test");
  await page.getByLabel("Пароль", { exact: true }).fill("Test-only-password1");
  await page
    .getByRole("button", { name: "Создать аккаунт", exact: true })
    .click();
  await page.getByRole("heading", { name: "Проверьте почту" }).waitFor();
  assert.ok(await page.getByText(/Письмо уже могло прийти/).isVisible());
  assert.equal(await page.getByRole("alert").count(), 0);
  assert.ok(
    await page
      .getByRole("button", { name: /Повторить отправку через/ })
      .isDisabled(),
  );
  assert.equal(signupRequests, 2);
  await page.screenshot({
    path: "tmp/qa/signup-rate-limit.png",
    fullPage: true,
  });
  const encode = (object) =>
    Buffer.from(JSON.stringify(object)).toString("base64url");
  const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, aud: "authenticated", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.test`;
  await context.addInitScript(
    ({ project, user, token }) => {
      localStorage.setItem(
        `sb-${project}-auth-token`,
        JSON.stringify({
          access_token: token,
          refresh_token: "test-refresh",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          expires_in: 3600,
          token_type: "bearer",
          user,
        }),
      );
    },
    { project, user, token },
  );
  await page.goto(base + "/requests");
  await page.getByRole("link", { name: /Бот для записи/ }).waitFor();
  assert.equal(await page.locator(".list-meta b").textContent(), "3");
  await page.screenshot({ path: "tmp/qa/list-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 360, height: 800 });
  assert.ok(
    await page.getByText("Бот", { exact: true }).isVisible(),
    "category must be visible on mobile",
  );
  assert.ok(
    await page.locator("time").first().isVisible(),
    "date must be visible on mobile",
  );
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "no mobile horizontal overflow",
  );
  await page.screenshot({ path: "tmp/qa/list-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "В работе", exact: true }).click();
  await page.getByRole("link", { name: /Еженедельный/ }).waitFor();
  assert.equal(await page.locator(".request-row").count(), 1);
  await page.getByRole("button", { name: "Все заявки", exact: true }).click();
  await page.getByRole("textbox", { name: "Поиск по названию" }).fill("CRM");
  await page.getByRole("link", { name: /Связать CRM/ }).waitFor();
  await page.waitForTimeout(450);
  assert.equal(await page.locator(".request-row").count(), 1);
  await page.getByRole("link", { name: "Новая заявка", exact: true }).click();
  await page
    .getByRole("button", { name: "Создать заявку", exact: true })
    .click();
  assert.equal(await page.locator(".field-error").count(), 3);
  await page.getByLabel("Название заявки").fill("Тестовая задача");
  await page.getByLabel("Описание задачи").fill("Описание тестовой задачи");
  await page.getByLabel("Категория").selectOption("integration");
  await page.screenshot({ path: "tmp/qa/form-mobile.png", fullPage: true });
  await page
    .getByRole("button", { name: "Создать заявку", exact: true })
    .click();
  await page
    .locator("form")
    .evaluate((form) =>
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      ),
    );
  await page.getByRole("link", { name: /Тестовая задача/ }).waitFor();
  assert.equal(inserts, 1, "double submit creates one record");
  await page.getByRole("link", { name: /Тестовая задача/ }).click();
  await page.getByLabel("Статус").selectOption("completed");
  await page.getByRole("button", { name: "Сохранить изменения" }).click();
  await page.getByRole("link", { name: /Тестовая задача/ }).waitFor();
  assert.equal(rows[0].status, "completed");
  assert.deepEqual(errors, []);
  console.log(
    "PASS: auth routes, list, mobile metadata, overflow, filters/search, validation, double submit and edit (mocked API).",
  );
  await context.close();
} finally {
  await browser.close();
  preview?.kill();
}
