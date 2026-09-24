const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT = path.join('C:/Users/nadire/Desktop/nadire-portfolio/assets/bitirme');
const BASE = 'http://127.0.0.1:8081';

async function shot(page, name) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: false });
  console.log('saved', name, fs.statSync(file).size);
}

async function forceText(page, text) {
  const loc = page.getByText(text, { exact: false }).first();
  await loc.click({ force: true, timeout: 8000 });
  await page.waitForTimeout(1500);
}

(async () => {
  const loginRes = await fetch('http://127.0.0.1:3000/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'nadire.portfolyo@test.com',
      password: 'Test1234!',
    }),
  });
  const fresh = await loginRes.json();
  fs.writeFileSync(path.join(OUT, '_tokens.json'), JSON.stringify(fresh));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  await page.addInitScript((t) => {
    localStorage.setItem('accessToken', t.accessToken);
    localStorage.setItem('refreshToken', t.refreshToken);
    localStorage.setItem('user', JSON.stringify(t.user));
    localStorage.setItem('onboarding_' + t.user.id, 'true');
    localStorage.setItem('hasCompletedOnboarding', 'true');
  }, fresh);

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4000);
  await shot(page, '02-ana-ekran.png');

  // Lessons via home card
  await forceText(page, 'Lessons');
  await shot(page, '02-dersler.png');
  try {
    await forceText(page, 'İlk C++');
  } catch {
    try {
      await forceText(page, 'Hello');
    } catch {
      try {
        await forceText(page, 'Temel');
      } catch (e) {
        console.log('no lesson item', e.message);
      }
    }
  }
  await shot(page, '03-ders-icerik.png');

  // back home then quiz
  await page.mouse.click(28, 820); // rough home tab area - will refine
  await page.waitForTimeout(800);
  // use tab bar by force clicking Quiz text that is visible in tab
  const quizTabs = page.getByText('Quiz', { exact: true });
  const qc = await quizTabs.count();
  console.log('Quiz exact', qc);
  if (qc) await quizTabs.last().click({ force: true });
  await page.waitForTimeout(1500);
  await shot(page, '04-quiz-secim.png');

  await forceText(page, 'Temel Değişkenler');
  await page.waitForTimeout(2000);
  await shot(page, '05-quiz.png');

  // answer Q1 then go to Q2
  try {
    await page.getByText('int', { exact: true }).first().click({ force: true });
    await page.waitForTimeout(600);
    for (const b of ['Gönder', 'Devam', 'Sonraki', 'Kontrol', 'Doğru']) {
      const btn = page.getByText(b, { exact: false });
      if (await btn.count()) {
        await btn.first().click({ force: true });
        await page.waitForTimeout(1200);
      }
    }
    // maybe need tap continue after feedback
    for (const b of ['Devam', 'Sonraki', 'Continue', 'Next']) {
      const btn = page.getByText(b, { exact: false });
      if (await btn.count()) {
        await btn.first().click({ force: true });
        await page.waitForTimeout(1200);
      }
    }
  } catch (e) {
    console.log('q1', e.message);
  }
  await shot(page, '05b-quiz-2.png');

  // Chat via home: go home first
  const homeTabs = page.getByText('Home', { exact: false });
  if (await homeTabs.count()) await homeTabs.last().click({ force: true });
  await page.waitForTimeout(1000);
  await forceText(page, 'Chead Chat');
  await page.waitForTimeout(2000);
  await shot(page, '07-ai-chat.png');

  const qs = [
    'C++ pointer nedir kisaca acikla',
    'for dongusu icin kisa ornek ver',
    'iki sayi toplayan fonksiyon yaz',
  ];
  for (let i = 0; i < qs.length; i++) {
    const inputs = page.locator('input');
    const n = await inputs.count();
    console.log('chat inputs', n);
    if (!n) break;
    const input = inputs.nth(n - 1);
    await input.click({ force: true });
    await input.fill(qs[i]);
    await page.keyboard.press('Enter');
    // click send - look for near bottom right
    await page.mouse.click(350, 760);
    console.log('waiting gemini', i + 1);
    // wait up to 40s for new text growth
    const before = await page.locator('body').innerText();
    for (let w = 0; w < 20; w++) {
      await page.waitForTimeout(2000);
      const now = await page.locator('body').innerText();
      if (now.length > before.length + 40) break;
    }
    await shot(page, `07-turn-${i + 1}.png`);
  }
  await shot(page, '07-ai-chat.png');
  await page.mouse.wheel(0, -2000);
  await page.waitForTimeout(600);
  await shot(page, '07b-ai-chat-scroll.png');

  // Code builder from home
  if (await homeTabs.count()) await homeTabs.last().click({ force: true });
  await page.waitForTimeout(800);
  try {
    await forceText(page, 'Code Builder');
  } catch {
    const codeTab = page.getByText('Code', { exact: false });
    if (await codeTab.count()) await codeTab.last().click({ force: true });
  }
  await page.waitForTimeout(1500);
  await shot(page, '08-ai-editor.png');

  // Profile
  const prof = page.getByText('Profile', { exact: false });
  if (await prof.count()) await prof.last().click({ force: true });
  await page.waitForTimeout(1200);
  await shot(page, '06-profil.png');

  // Forum
  if (await homeTabs.count()) await homeTabs.last().click({ force: true });
  await page.waitForTimeout(800);
  try {
    await forceText(page, 'Community Forum');
  } catch {}
  await page.waitForTimeout(1500);
  await shot(page, '09-forum.png');

  // login shot
  const c2 = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const p2 = await c2.newPage();
  await p2.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p2.waitForTimeout(2500);
  await p2.screenshot({ path: path.join(OUT, '01-login.png') });
  await c2.close();
  await browser.close();
  console.log('DONE');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
