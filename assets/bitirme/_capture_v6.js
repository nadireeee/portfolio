/**
 * Reliable capture after home stats fix (hot reload).
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('C:/Users/nadire/Desktop/nadire-portfolio/node_modules/playwright');

const OUT = path.join('C:/Users/nadire/Desktop/nadire-portfolio/assets/bitirme');
const DOCS = path.join('C:/Users/nadire/Desktop/CodeLearn/docs/screenshots');
const BASE = 'http://localhost:8081';
const API = 'http://localhost:3000';

async function login() {
  const r = await fetch(API + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'nadire.portfolyo@test.com',
      password: 'Test1234!',
    }),
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

(async () => {
  const tok = await login();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

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
  await page.waitForTimeout(6000); // allow HMR + data

  // Ensure on home
  await page.getByText('Ana Sayfa', { exact: true }).last().click({ force: true }).catch(() => {});
  await page.waitForTimeout(2000);

  // Scroll home to reveal stats + badges
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(800);
  await shot(page, '02-ana-ekran.png');

  // Click Tümünü Gör -> QuizStats
  const viewAll = page.getByText('Tümünü Gör', { exact: false });
  if (await viewAll.count()) {
    await viewAll.first().click({ force: true });
    await page.waitForTimeout(2500);
  } else {
    console.log('no Tümünü Gör — scroll more');
    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(500);
    await page.getByText(/Tümünü Gör|View All/i).first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(2500);
  }

  let body = await page.locator('body').innerText();
  console.log('after viewall', body.slice(0, 200).replace(/\n/g, ' | '));
  await shot(page, '10-istatistik.png');
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(700);
  await shot(page, '15-rozet-oyunlastirma.png');

  // Back via header back or goBack
  await page.locator('body').click({ position: { x: 40, y: 50 } }).catch(() => {});
  await page.waitForTimeout(400);
  await page.goBack().catch(() => {});
  await page.waitForTimeout(1000);
  await page.getByText('Ana Sayfa', { exact: true }).last().click({ force: true }).catch(() => {});
  await page.waitForTimeout(1200);

  // Quiz tab
  await page.getByText('Quiz', { exact: true }).last().click({ force: true });
  await page.waitForTimeout(3500);

  // Debug quizzes in page
  const info = await page.evaluate(async () => {
    const token = localStorage.getItem('accessToken');
    const r = await fetch('http://localhost:3000/quiz/all', {
      headers: { Authorization: 'Bearer ' + token },
    });
    const j = await r.json();
    return {
      n: Array.isArray(j) ? j.length : -1,
      first: Array.isArray(j) && j[0] ? j[0].title : null,
      lang: localStorage.getItem('language'),
      bodyHas: document.body.innerText.includes('Quiz Seçimi') || document.body.innerText.includes('Kolay'),
    };
  });
  console.log('quiz_info', info);
  body = await page.locator('body').innerText();
  console.log('quiz_body', body.slice(0, 250).replace(/\n/g, ' | '));

  if (/bulunamadı|No quizzes/i.test(body)) {
    await page.getByText(/Tekrar Dene|Try Again/i).first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(3000);
    body = await page.locator('body').innerText();
    console.log('after retry', body.slice(0, 250).replace(/\n/g, ' | '));
  }
  await shot(page, '04-quiz-secim.png');

  // Open quiz if possible
  const q = page.getByText(/Temel Değişken|Değişken Türleri|Kolay Seviye/i).first();
  if (await q.count()) {
    await q.click({ force: true });
    await page.waitForTimeout(2500);
    await shot(page, '05-quiz.png');
    await page.goBack().catch(() => {});
    await page.waitForTimeout(800);
  }

  // Stats from quiz header icon
  await page.getByText('Quiz', { exact: true }).last().click({ force: true }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('*')).find(
      (n) => n.getAttribute && n.getAttribute('name') === 'stats-chart'
    );
    if (el) (el.parentElement || el).click();
  });
  await page.waitForTimeout(2000);
  body = await page.locator('body').innerText();
  if (/İstatistikler|Tamamlanan Quiz|Genel İstatistik/i.test(body)) {
    await shot(page, '10-istatistik.png');
    await page.mouse.wheel(0, 450);
    await page.waitForTimeout(600);
    await shot(page, '15-rozet-oyunlastirma.png');
  } else {
    console.log('stats from quiz header failed', body.slice(0, 150).replace(/\n/g, '|'));
  }

  // Forum
  await page.getByText('Ana Sayfa', { exact: true }).last().click({ force: true }).catch(() => {});
  await page.waitForTimeout(1000);
  await page.getByText(/Topluluk Forumu/i).first().click({ force: true });
  await page.waitForTimeout(2500);
  await shot(page, '16-forum-liste.png');
  await page.getByText(/Memory leak|pointer|döngü|string/i).first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(2000);
  await shot(page, '16b-forum-detay.png');

  // Badges tab
  await page.getByText('Rozetler', { exact: true }).last().click({ force: true }).catch(() => {});
  await page.waitForTimeout(2000);
  await shot(page, '15b-rozetler-tab.png');

  await browser.close();
  console.log('DONE');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
