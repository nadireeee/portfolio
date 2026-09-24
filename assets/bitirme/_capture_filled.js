/**
 * Continue capture: quiz selection (filled) + stats + badges. TR/dark.
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('C:/Users/nadire/Desktop/nadire-portfolio/node_modules/playwright');

const OUT = path.join('C:/Users/nadire/Desktop/nadire-portfolio/assets/bitirme');
const DOCS = path.join('C:/Users/nadire/Desktop/CodeLearn/docs/screenshots');
const BASE = 'http://localhost:8081';
const API = 'http://localhost:3000';

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

async function tab(page, labels) {
  for (const label of labels) {
    const loc = page.getByText(label, { exact: false });
    const n = await loc.count();
    if (!n) continue;
    await loc.nth(n - 1).click({ force: true, timeout: 10000 });
    await page.waitForTimeout(1800);
    return label;
  }
  throw new Error('tabs missing: ' + labels.join(','));
}

(async () => {
  const tok = await api('POST', '/auth/login', null, {
    email: 'nadire.portfolyo@test.com',
    password: 'Test1234!',
  });
  const stats = await api('GET', '/quiz/stats/user', tok.accessToken);
  console.log('precheck', {
    c: stats.totalCompletedQuizzes,
    xp: stats.totalXP,
    avg: Math.round(stats.averageScore),
    streak: stats.currentStreak,
  });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 860 },
  });
  const page = await context.newPage();

  page.on('response', (res) => {
    const u = res.url();
    if (/\/(quiz\/all|quiz-eng\/all|quiz\/stats|badges\/user)/.test(u)) {
      console.log(res.status(), u.replace(API, ''));
    }
  });

  await page.addInitScript((t) => {
    localStorage.setItem('accessToken', t.accessToken);
    localStorage.setItem('refreshToken', t.refreshToken);
    localStorage.setItem('user', JSON.stringify(t.user));
    localStorage.setItem('onboarding_' + t.user.id, 'true');
    localStorage.setItem('colorScheme', 'dark');
    localStorage.setItem('theme', 'dark');
    localStorage.setItem('language', 'tr');
  }, tok);

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4500);

  // Ensure Turkish
  try {
    await tab(page, ['Profil', 'Profile']);
    const tr = page.getByText(/Türkçe/i);
    if (await tr.count()) await tr.first().click({ force: true });
    await page.waitForTimeout(600);
  } catch (_) {}

  await tab(page, ['Ana Sayfa', 'Home']);
  await shot(page, '02-ana-ekran.png');

  // Open QuizStats via "Tümünü Gör"
  try {
    const viewAll = page.getByText(/Tümünü Gör|View All/i);
    if (await viewAll.count()) {
      await viewAll.first().click({ force: true });
      await page.waitForTimeout(2500);
    }
  } catch (_) {}

  let body = await page.locator('body').innerText();
  if (!/İstatistikler|Tamamlanan Quiz|Completed Quizzes/i.test(body)) {
    // Quiz tab then stats icon
    await tab(page, ['Quiz']);
    await page.waitForTimeout(2500);
    await shot(page, '04-quiz-secim.png');

    // Click stats-chart icon
    await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const el = all.find((n) => n.getAttribute && n.getAttribute('name') === 'stats-chart');
      if (el) (el.parentElement || el).click();
    });
    await page.waitForTimeout(2000);

    body = await page.locator('body').innerText();
    if (!/İstatistikler|Tamamlanan Quiz/i.test(body)) {
      // brute force clicks on header right
      const box = await page.locator('body').boundingBox();
      for (const x of [1100, 1000, 900, 800, 700, 600]) {
        await page.mouse.click(x, 55);
        await page.waitForTimeout(700);
        body = await page.locator('body').innerText();
        if (/İstatistikler|Tamamlanan Quiz/i.test(body)) break;
      }
    }
  }

  body = await page.locator('body').innerText();
  console.log('stats?', /İstatistikler|Tamamlanan Quiz/i.test(body), body.slice(0, 220).replace(/\n/g, ' | '));
  await shot(page, '10-istatistik.png');
  await page.mouse.wheel(0, 450);
  await page.waitForTimeout(700);
  await shot(page, '15-rozet-oyunlastirma.png');

  // Back to quiz list
  try {
    await page.getByText(/Geri|^</i).first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);
  } catch (_) {}
  await page.goBack().catch(() => {});
  await page.waitForTimeout(800);

  await tab(page, ['Quiz']);
  await page.waitForTimeout(2500);
  for (let i = 0; i < 6; i++) {
    const t = await page.locator('body').innerText();
    if (/Kolay|Tamamlanan|Temel|Ortalama|Quiz Seçimi/i.test(t) && !/bulunamadı|No quizzes/i.test(t)) break;
    if (/Tekrar Dene|Try Again/i.test(t)) {
      await page.getByText(/Tekrar Dene|Try Again/i).first().click({ force: true });
    }
    await page.waitForTimeout(1000);
  }
  console.log('quiz snip', (await page.locator('body').innerText()).slice(0, 200).replace(/\n/g, ' | '));
  await shot(page, '04-quiz-secim.png');

  // Open a quiz
  try {
    const card = page.getByText(/Temel Değişken|Temel|Değişkenler|Giriş/i).first();
    if (await card.count()) {
      await card.click({ force: true });
      await page.waitForTimeout(2500);
      await shot(page, '05-quiz.png');
    }
  } catch (e) {
    console.log('quiz open', e.message);
  }

  // Forum again (ensure kept)
  await tab(page, ['Ana Sayfa', 'Home']);
  await page.waitForTimeout(800);
  try {
    await page.getByText(/Forum|Topluluk/i).first().click({ force: true });
    await page.waitForTimeout(2000);
    await shot(page, '16-forum-liste.png');
  } catch (e) {
    console.log('forum', e.message);
  }

  await browser.close();
  console.log('DONE');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
