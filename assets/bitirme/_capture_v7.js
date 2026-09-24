/**
 * Capture after nav/API fixes — hard reload to pick HMR.
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('C:/Users/nadire/Desktop/nadire-portfolio/node_modules/playwright');

const OUT = path.join('C:/Users/nadire/Desktop/nadire-portfolio/assets/bitirme');
const DOCS = path.join('C:/Users/nadire/Desktop/CodeLearn/docs/screenshots');
const BASE = 'http://localhost:8081';
const API = 'http://localhost:3000';

async function shot(page, name) {
  for (const dir of [OUT, DOCS]) {
    fs.mkdirSync(dir, { recursive: true });
    const f = path.join(dir, name);
    await page.screenshot({ path: f, fullPage: false });
    console.log('SHOT', name, fs.statSync(f).size);
  }
}

(async () => {
  require('child_process').execSync(
    'node "' + path.join(__dirname, '_fix_badges.js') + '"',
    { stdio: 'inherit' }
  );

  const tok = await (
    await fetch(API + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nadire.portfolyo@test.com',
        password: 'Test1234!',
      }),
    })
  ).json();

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('ERR', m.text().slice(0, 200));
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

  await page.goto(BASE + '/?t=' + Date.now(), {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });
  await page.waitForTimeout(7000);

  // HOME — scroll to stats
  await page.getByText('Ana Sayfa', { exact: true }).last().click({ force: true }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(1000);
  await shot(page, '02-ana-ekran.png');
  console.log('home', (await page.locator('body').innerText()).includes('İstatistikleriniz'));

  // QUIZ TAB
  await page.getByText('Quiz', { exact: true }).last().click({ force: true });
  await page.waitForTimeout(4000);
  let body = await page.locator('body').innerText();
  console.log('quiz1', body.slice(0, 220).replace(/\n/g, ' | '));
  if (/bulunamadı|No quizzes/i.test(body)) {
    await page.getByText(/Tekrar Dene|Try Again/i).first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(3000);
    body = await page.locator('body').innerText();
    console.log('quiz2', body.slice(0, 220).replace(/\n/g, ' | '));
  }
  await shot(page, '04-quiz-secim.png');

  // Open stats from quiz header
  const opened = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('*')).find(
      (n) => n.getAttribute && n.getAttribute('name') === 'stats-chart'
    );
    if (!el) return false;
    const target = el.closest('[tabindex]') || el.parentElement || el;
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    return true;
  });
  console.log('statsIcon', opened);
  await page.waitForTimeout(2500);
  body = await page.locator('body').innerText();
  console.log('stats', /İstatistikler|Tamamlanan Quiz|Genel İstatistik/i.test(body), body.slice(0, 200).replace(/\n/g, ' | '));
  await shot(page, '10-istatistik.png');
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(800);
  await shot(page, '15-rozet-oyunlastirma.png');

  // Back
  await page.getByText(/İstatistikler|Statistics/i).first().click({ force: true }).catch(() => {});
  await page.locator('body').click({ position: { x: 30, y: 55 } }).catch(() => {});
  await page.waitForTimeout(500);
  await page.goBack().catch(() => {});
  await page.waitForTimeout(1000);

  // Open a quiz
  await page.getByText('Quiz', { exact: true }).last().click({ force: true }).catch(() => {});
  await page.waitForTimeout(2000);
  const card = page.getByText(/Temel Değişken|Değişken Türleri/i).first();
  if (await card.count()) {
    await card.click({ force: true });
    await page.waitForTimeout(2500);
    await shot(page, '05-quiz.png');
  }

  // FORUM via home card
  await page.getByText('Ana Sayfa', { exact: true }).last().click({ force: true }).catch(() => {});
  await page.waitForTimeout(1200);
  await page.getByText(/Topluluk Forumu/i).first().click({ force: true });
  await page.waitForTimeout(2500);
  await shot(page, '16-forum-liste.png');
  await page.getByText(/Memory leak|pointer|döngü|string/i).first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(2000);
  await shot(page, '16b-forum-detay.png');

  // BADGES tab / stack
  await page.getByText('Rozetler', { exact: true }).last().click({ force: true }).catch(() => {});
  await page.waitForTimeout(2500);
  await shot(page, '15b-rozetler-tab.png');

  await browser.close();
  console.log('DONE');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
