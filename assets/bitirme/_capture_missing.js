/**
 * Capture missing portfolio screens: Google login, Duolingo quiz, quiz select,
 * stats, badges, Chead chat, code analysis — dark theme only.
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT = path.join('C:/Users/nadire/Desktop/nadire-portfolio/assets/bitirme');
const DOCS = path.join('C:/Users/nadire/Desktop/CodeLearn/docs/screenshots');
const BASE = 'http://127.0.0.1:8081';
const API = 'http://127.0.0.1:3000';

async function login() {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'nadire.portfolyo@test.com',
      password: 'Test1234!',
    }),
  });
  const j = await r.json();
  if (!j.accessToken) throw new Error('login fail ' + JSON.stringify(j));
  return j;
}

async function shot(page, name) {
  const dests = [path.join(OUT, name), path.join(DOCS, name)];
  for (const f of dests) {
    await page.screenshot({ path: f, fullPage: false });
    console.log('LIVE', name, '->', f, fs.statSync(f).size);
  }
}

async function clickTab(page, label) {
  const loc = page.getByText(label, { exact: false });
  const n = await loc.count();
  if (!n) throw new Error('tab not found: ' + label);
  await loc.nth(n - 1).click({ force: true, timeout: 10000 });
  await page.waitForTimeout(1500);
}

(async () => {
  fs.mkdirSync(DOCS, { recursive: true });
  const tok = await login();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 420, height: 860 },
    deviceScaleFactor: 2,
  });

  // --- 1) Google login (logged out) ---
  const loginPage = await context.newPage();
  await loginPage.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('colorScheme', 'dark');
    localStorage.setItem('theme', 'dark');
  });
  await loginPage.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await loginPage.waitForTimeout(5000);
  // try force dark body
  await loginPage.evaluate(() => {
    document.documentElement.style.background = '#0b1220';
  }).catch(() => {});
  await shot(loginPage, '01-login-google.png');
  await loginPage.close();

  // --- authenticated ---
  const page = await context.newPage();
  await page.addInitScript((t) => {
    localStorage.setItem('accessToken', t.accessToken);
    localStorage.setItem('refreshToken', t.refreshToken);
    localStorage.setItem('user', JSON.stringify(t.user));
    localStorage.setItem('onboarding_' + t.user.id, 'true');
    localStorage.setItem('colorScheme', 'dark');
    localStorage.setItem('theme', 'dark');
  }, tok);

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4500);

  // force dark via settings if needed
  try {
    await clickTab(page, 'Profil');
    await page.waitForTimeout(800);
    const body = await page.locator('body').innerText();
    if (/aydınlık|light mode/i.test(body)) {
      const sw = page.locator('[role="switch"]').first();
      if (await sw.count()) await sw.click({ force: true });
      await page.waitForTimeout(800);
    }
  } catch (e) {
    console.log('theme skip', e.message);
  }

  await clickTab(page, 'Ana Sayfa').catch(() => clickTab(page, 'Home'));
  await shot(page, '02-ana-ekran.png');

  // Chead Chat
  try {
    await clickTab(page, 'Chead');
    await page.waitForTimeout(2000);
    await shot(page, '07-ai-chat.png');
  } catch (e) {
    console.log('chead fail', e.message);
  }

  // Quiz selection (Duolingo entry)
  try {
    await clickTab(page, 'Quiz');
    await page.waitForTimeout(2500);
    await shot(page, '04-quiz-secim.png');

    // open first quiz card if any
    const cards = page.locator('text=/Temel|Giriş|Değişken|Kolay|Easy/i');
    if (await cards.count()) {
      await cards.first().click({ force: true });
      await page.waitForTimeout(3000);
      await shot(page, '05-quiz-duolingo.png');
      // second question if possible — answer then next
      const options = page.locator('[role="button"], button').filter({ hasText: /.+/ });
      // try tap a choice
      const choice = page.getByText(/0|1|2|true|false|int|void|%/i).first();
      if (await choice.count()) {
        await choice.click({ force: true }).catch(() => {});
        await page.waitForTimeout(500);
      }
      const send = page.getByText(/Gönder|Submit|Kontrol|Check/i).first();
      if (await send.count()) {
        await send.click({ force: true }).catch(() => {});
        await page.waitForTimeout(1500);
        await shot(page, '05b-quiz-duolingo-2.png');
      }
    }
  } catch (e) {
    console.log('quiz fail', e.message);
  }

  // Stats / progress
  try {
    // chart icon on home or navigate QuizStats
    await clickTab(page, 'Ana Sayfa').catch(() => clickTab(page, 'Home'));
    await page.waitForTimeout(800);
    // try stats via header icon or menu
    const statsBtn = page.getByText(/İstatistik|Statistics|Stats/i);
    if (await statsBtn.count()) {
      await statsBtn.first().click({ force: true });
    } else {
      // try graph icon near logout
      await page.locator('[aria-label*="stat" i], [accessibilitylabel*="stat" i]').first().click({ force: true }).catch(() => {});
      // fallback: click SVG near welcome
      await page.evaluate(() => {
        const els = [...document.querySelectorAll('*')];
        const t = els.find((e) => /stats|istatistik|progress/i.test(e.getAttribute?.('aria-label') || ''));
        t?.click?.();
      }).catch(() => {});
    }
    await page.waitForTimeout(2000);
    // if still on home, use route hash if app supports it — try navigating by pressing graph
    const body2 = await page.locator('body').innerText();
    if (!/İstatistik|Statistics|Average|XP|Streak/i.test(body2)) {
      // open from quiz selection stats area
      await clickTab(page, 'Quiz').catch(() => {});
      await page.waitForTimeout(1000);
      const trophy = page.getByText(/%|Streak|Completed/i).first();
      if (await trophy.count()) await trophy.click({ force: true }).catch(() => {});
      await page.waitForTimeout(1500);
    }
    await shot(page, '10-istatistik.png');
  } catch (e) {
    console.log('stats fail', e.message);
  }

  // Badges
  try {
    await clickTab(page, 'Rozet');
    await page.waitForTimeout(2000);
    await shot(page, '15-rozet-oyunlastirma.png');
  } catch (e) {
    try {
      await clickTab(page, 'Badge');
      await page.waitForTimeout(2000);
      await shot(page, '15-rozet-oyunlastirma.png');
    } catch (e2) {
      console.log('badge fail', e2.message);
    }
  }

  // Code builder + analysis suggestion (Random Questions evaluate)
  try {
    await clickTab(page, 'Ana Sayfa').catch(() => {});
    await page.waitForTimeout(500);
    const rq = page.getByText(/Random Questions|Rastgele/i).first();
    if (await rq.count()) {
      await rq.click({ force: true });
      await page.waitForTimeout(2500);
      await shot(page, '10-rastgele-sorular.png');
      // type broken code
      const editor = page.locator('textarea, [contenteditable="true"]').first();
      if (await editor.count()) {
        await editor.click({ force: true });
        await editor.fill('#include <iostream>\nint main(){\n  cout << "Merhaba"\n  return 0;\n}');
        await page.waitForTimeout(500);
      }
      const evalBtn = page.getByText(/Evaluate|Değerlendir/i).first();
      if (await evalBtn.count()) {
        await evalBtn.click({ force: true });
        await page.waitForTimeout(8000);
        await shot(page, '14-kod-analiz-oneri.png');
        await shot(page, '13-ai-oneri-paneli.png');
      }
    }
  } catch (e) {
    console.log('analysis fail', e.message);
  }

  // Kod oluşturucu with project
  try {
    await clickTab(page, 'Kod');
    await page.waitForTimeout(2000);
    await shot(page, '08-ai-editor.png');
  } catch (e) {
    console.log('kod fail', e.message);
  }

  await browser.close();
  console.log('DONE');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
