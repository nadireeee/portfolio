/**
 * Focused capture: quiz selection (filled) + stats (filled) + badges.
 * Forum already captured.
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('C:/Users/nadire/Desktop/nadire-portfolio/node_modules/playwright');

const OUT = path.join('C:/Users/nadire/Desktop/nadire-portfolio/assets/bitirme');
const DOCS = path.join('C:/Users/nadire/Desktop/CodeLearn/docs/screenshots');
const BASE = 'http://127.0.0.1:8081';
const API = 'http://127.0.0.1:3000';

async function api(method, url, token, body) {
  const r = await fetch(API + url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(data));
  return data;
}

async function shot(page, name) {
  for (const dir of [OUT, DOCS]) {
    fs.mkdirSync(dir, { recursive: true });
    const f = path.join(dir, name);
    await page.screenshot({ path: f, fullPage: false });
    console.log('SHOT', name, fs.statSync(f).size);
  }
}

(async () => {
  const tok = await api('POST', '/auth/login', null, {
    email: 'nadire.portfolyo@test.com',
    password: 'Test1234!',
  });
  console.log('stats', {
    c: (await api('GET', '/quiz/stats/user', tok.accessToken)).totalCompletedQuizzes,
    badges: (await api('GET', '/badges/user', tok.accessToken)).length,
  });

  const browser = await chromium.launch({ headless: true });
  const page = await (
    await browser.newContext({ viewport: { width: 1280, height: 860 } })
  ).newPage();

  await page.addInitScript((t) => {
    localStorage.setItem('accessToken', t.accessToken);
    localStorage.setItem('refreshToken', t.refreshToken);
    localStorage.setItem('user', JSON.stringify(t.user));
    localStorage.setItem('onboarding_' + t.user.id, 'true');
    localStorage.setItem('colorScheme', 'dark');
    localStorage.setItem('theme', 'dark');
    localStorage.setItem('language', 'tr');
  }, tok);

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(5000);

  // Dump bottom nav labels for debug
  const labels = await page.evaluate(() => {
    const texts = Array.from(document.querySelectorAll('body *'))
      .map((n) => (n.childNodes.length === 1 && n.childNodes[0].nodeType === 3 ? n.textContent.trim() : ''))
      .filter((t) => t && t.length < 24);
    return [...new Set(texts)].slice(0, 80);
  });
  console.log('LABELS', labels.join(' | '));

  // Click Quiz tab - try several strategies
  async function openQuizSelection() {
    // 1) exact bottom tab text
    for (const label of ['Quiz', 'quiz', 'Quizler']) {
      const loc = page.getByText(label, { exact: true });
      const n = await loc.count();
      if (n) {
        await loc.nth(n - 1).click({ force: true });
        await page.waitForTimeout(2200);
        const t = await page.locator('body').innerText();
        if (/Quiz Seçimi|Tamamlanan|Ortalama|Completed|Quiz Selection/i.test(t)) return true;
      }
    }
    // 2) help-circle icon (quiz tab)
    const clicked = await page.evaluate(() => {
      const icons = Array.from(document.querySelectorAll('*'));
      const icon = icons.find(
        (n) => n.getAttribute && n.getAttribute('name') === 'help-circle'
      );
      if (!icon) return false;
      (icon.closest('[tabindex]') || icon.closest('div') || icon.parentElement).click();
      return true;
    });
    if (clicked) {
      await page.waitForTimeout(2200);
      const t = await page.locator('body').innerText();
      if (/Quiz Seçimi|Tamamlanan|Ortalama/i.test(t)) return true;
    }
    // 3) coordinate click bottom nav slots (7 items across phone ~390px centered)
    const cx = 640;
    const phoneW = 390;
    const left = cx - phoneW / 2;
    // Quiz is 3rd of 7 tabs (0-based index 2)
    const slot = left + (phoneW / 7) * 2.5;
    await page.mouse.click(slot, 820);
    await page.waitForTimeout(2200);
    const t = await page.locator('body').innerText();
    return /Quiz Seçimi|Tamamlanan|Ortalama/i.test(t);
  }

  const quizOk = await openQuizSelection();
  console.log('quizOk', quizOk, (await page.locator('body').innerText()).slice(0, 220).replace(/\n/g, ' | '));
  await shot(page, '04-quiz-secim.png');

  // Open stats from quiz header chart button
  async function openStats() {
    const viaIcon = await page.evaluate(() => {
      const icons = Array.from(document.querySelectorAll('*'));
      const icon = icons.find(
        (n) => n.getAttribute && n.getAttribute('name') === 'stats-chart'
      );
      if (!icon) return false;
      (icon.closest('[tabindex]') || icon.closest('div') || icon.parentElement).click();
      return true;
    });
    console.log('stats icon', viaIcon);
    await page.waitForTimeout(1500);
    let t = await page.locator('body').innerText();
    if (/İstatistikler|Genel İstatistik|Tamamlanan Quiz|Statistics/i.test(t)) return true;

    // home path: go home then top-right chart
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    await page.getByText(/Ana Sayfa|Home/i).last().click({ force: true }).catch(() => {});
    await page.waitForTimeout(1000);
    // click blue circular chart top-right of phone
    for (const [x, y] of [
      [780, 48],
      [800, 52],
      [760, 48],
      [820, 55],
      [740, 50],
    ]) {
      await page.mouse.click(x, y);
      await page.waitForTimeout(1000);
      t = await page.locator('body').innerText();
      if (/İstatistikler|Genel İstatistik|Tamamlanan Quiz|Statistics/i.test(t)) {
        console.log('stats via', x, y);
        return true;
      }
    }
    // scroll home and click "İstatistikleriniz" / Tümünü Gör
    await page.getByText(/İstatistik|Tümünü Gör|View All/i).first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(1500);
    t = await page.locator('body').innerText();
    return /İstatistikler|Genel İstatistik|Tamamlanan Quiz/i.test(t);
  }

  const statsOk = await openStats();
  const body = await page.locator('body').innerText();
  console.log('statsOk', statsOk, body.slice(0, 280).replace(/\n/g, ' | '));
  await shot(page, '10-istatistik.png');
  await page.mouse.wheel(0, 480);
  await page.waitForTimeout(800);
  await shot(page, '15-rozet-oyunlastirma.png');

  // Badges tab via trophy icon
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  await page.evaluate(() => {
    const icon = Array.from(document.querySelectorAll('*')).find(
      (n) => n.getAttribute && n.getAttribute('name') === 'trophy'
    );
    if (icon) (icon.closest('[tabindex]') || icon.parentElement).click();
  });
  await page.waitForTimeout(2000);
  await shot(page, '15b-rozetler-tab.png');

  // Open first quiz from selection again for 05
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  await openQuizSelection();
  const card = page.getByText(/Temel Değişken|Değişken Türleri/i).first();
  if (await card.count()) {
    await card.click({ force: true });
    await page.waitForTimeout(2500);
    await shot(page, '05-quiz.png');
  }

  await browser.close();
  console.log('DONE');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
