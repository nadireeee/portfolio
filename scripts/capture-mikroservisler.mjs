import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const OUT = "C:\\Users\\nadire\\Desktop\\nadire-portfolio\\assets\\mikroservisler";
const BASE = "http://localhost:6006";

fs.mkdirSync(OUT, { recursive: true });

const MOCK_BASKET = {
  cart: {
    userName: "admin",
    items: [
      {
        quantity: 2,
        color: "Kırmızı",
        price: 59.98,
        productId: "11111111-1111-1111-1111-111111111111",
        productName: "Ahşap Tren Seti",
      },
      {
        quantity: 1,
        color: "Mavi",
        price: 34.5,
        productId: "22222222-2222-2222-2222-222222222222",
        productName: "Peluş Ayıcık",
      },
    ],
    totalPrice: 94.48,
  },
};

const MOCK_ORDERS = {
  orders: [
    {
      id: "ord-1001",
      orderName: "TL-1001",
      createdAt: new Date().toISOString(),
      status: "Processing",
      totalPrice: 94.48,
      firstName: "Admin",
      lastName: "User",
    },
    {
      id: "ord-1000",
      orderName: "TL-1000",
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      status: "Delivered",
      totalPrice: 42.0,
      firstName: "Admin",
      lastName: "User",
    },
  ],
  pageNumber: 1,
  pageSize: 10,
  totalCount: 2,
};

const shot = async (page, name) => {
  const file = path.join(OUT, `${name}.png`);
  await page.waitForTimeout(900);
  await page.screenshot({ path: file, fullPage: true });
  const size = fs.statSync(file).size;
  const h1 = ((await page.locator("h1").first().textContent().catch(() => "")) || "").trim().slice(0, 90);
  console.log(`OK ${name} bytes=${size} url=${page.url()} h1=${h1}`);
  return { name, size, url: page.url(), h1 };
};

const installApiMocks = async (page) => {
  await page.route("**/api/basket-service/**", async (route) => {
    const method = route.request().method();
    if (method === "GET" || method === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_BASKET),
      });
      return;
    }
    if (method === "DELETE") {
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
      return;
    }
    await route.continue();
  });

  await page.route("**/api/ordering-service/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_ORDERS),
    });
  });
};

const loginAsAdmin = async (page) => {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#username", "admin");
  await page.fill("#password", "Admin123!");
  await page.click(".login-form button, form button[type='submit']");
  await page.waitForTimeout(3500);
  const ok = await page.evaluate(() => !!localStorage.getItem("access_token"));
  console.log("LOGIN admin ok=", ok, "url=", page.url());
  return ok;
};

const main = async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    locale: "tr-TR",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  page.on("console", (msg) => {
    const t = msg.text();
    if (/Login|Token|Sepet|error|Error|❌|✅|Basket|orders/i.test(t)) console.log("BROWSER:", t);
  });

  const results = [];
  const failed = [];

  // 1) Public pages (real backend)
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  results.push(await shot(page, "01-home"));

  await page.goto(`${BASE}/products`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  results.push(await shot(page, "02-products"));

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  results.push(await shot(page, "03-login"));

  await page.goto(`${BASE}/register`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  results.push(await shot(page, "04-register"));

  // 2) Login then mock basket/orders so 401 interceptor does not wipe session
  const loggedIn = await loginAsAdmin(page);
  if (!loggedIn) {
    failed.push("login admin failed");
  } else {
    await installApiMocks(page);

    await page.goto(`${BASE}/cart`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    // wait for cart heading
    await page.locator("h1").first().waitFor({ timeout: 10000 }).catch(() => {});
    results.push(await shot(page, "05-cart"));
    if (!page.url().includes("/cart")) failed.push(`05-cart landed on ${page.url()}`);

    await page.goto(`${BASE}/checkout`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    results.push(await shot(page, "06-checkout"));
    if (!page.url().includes("/checkout")) failed.push(`06-checkout landed on ${page.url()}`);

    await page.goto(`${BASE}/orders`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    results.push(await shot(page, "07-orders"));
    if (!page.url().includes("/orders")) failed.push(`07-orders landed on ${page.url()}`);

    // Bonus logged-in products + admin/profile stubs if useful
    await page.goto(`${BASE}/products`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    results.push(await shot(page, "09-products-logged-in"));

    await page.goto(`${BASE}/profile`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    if (page.url().includes("/profile")) {
      results.push(await shot(page, "10-profile"));
    }
  }

  // No product-detail route in this SPA
  failed.push("08-product-detail (SPA has no /products/:id route)");

  await browser.close();
  console.log("SUMMARY", JSON.stringify({ results, failed }, null, 2));
  console.log("DONE");
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
