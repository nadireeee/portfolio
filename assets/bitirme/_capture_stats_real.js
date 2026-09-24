/**
 * Open real QuizStats screen (Genel İstatistikler) + scroll badges.
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
  return r.json();
}

async function shot(page, name) {
  for (const dir of [OUT, DOCS]) {
    fs.mkdirSync(dir, { recursive: true });
    const f = path.join(dir, name);
    await page.screenshot({ path: f, fullPage: false });
    console.log('SHOT', name, fs.statSync(f).size);
  }
}

function isStatsPage(t) {
  return /Genel İstatistikler|General Statistics|Tamamlanan Quiz\b|Completed Quizzes|Başarı Rozetleri|Achievement Badges/i.test(
    t
  );
}

(async () => {
  const tok = await api('POST', '/auth/login', null, {
    email: 'nadire.portfolyo@test.com',
    password: 'Test1234!',
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

  // Path A: Tümünü Gör (opens QuizStats)
  await page.getByText('Tümünü Gör', { exact: true }).first().click({ force: true });
  await page.waitForTimeout(2500);
  let body = await page.locator('body').innerText();
  console.log('after tumunu', isStatsPage(body), body.slice(0, 250).replace(/\n/g, ' | '));

  if (!isStatsPage(body)) {
    // Path B: Quiz tab then stats-chart button
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    await page.getByText('Quiz', { exact: true }).last().click({ force: true });
    await page.waitForTimeout(2500);
    body = await page.locator('body').innerText();
    console.log('quiz sel', body.slice(0, 160).replace(/\n/g, ' | '));
    await page.evaluate(() => {
      const icon = Array.from(document.querySelectorAll('*')).find(
        (n) => n.getAttribute && n.getAttribute('name') === 'stats-chart'
      );
      if (icon) {
        const btn = icon.closest('[tabindex]') || icon.parentElement || icon;
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      }
    });
    await page.waitForTimeout(2000);
    // also try clicking top-right of header area inside phone
    for (const [x, y] of [
      [820, 70],
      [800, 75],
      [840, 70],
      [780, 70],
      [850, 80],
    ]) {
      await page.mouse.click(x, y);
      await page.waitForTimeout(800);
      body = await page.locator('body').innerText();
      if (isStatsPage(body)) {
        console.log('opened at', x, y);
        break;
      }
    }
  }

  body = await page.locator('body').innerText();
  console.log('STATS', isStatsPage(body), body.slice(0, 320).replace(/\n/g, ' | '));
  if (!isStatsPage(body)) {
    // Path C: scroll home and click stats header area
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    await page.getByText(/Son Başarılar/i).first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);
    await page.getByText(/Tümünü Gör/i).first().click({ force: true });
    await page.waitForTimeout(2500);
    body = await page.locator('body').innerText();
    console.log('retry tumunu', isStatsPage(body), body.slice(0, 250).replace(/\n/g, ' | '));
  }

  await shot(page, '10-istatistik.png');
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(800);
  await shot(page, '15-rozet-oyunlastirma.png');

  // Verify quiz selection still good
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  await page.getByText('Quiz', { exact: true }).last().click({ force: true });
  await page.waitForTimeout(2500);
  body = await page.locator('body').innerText();
  console.log('QUIZ', body.slice(0, 200).replace(/\n/g, ' | '));
  await shot(page, '04-quiz-secim.png');

  await browser.close();
  console.log('DONE');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
