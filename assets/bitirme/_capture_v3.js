const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT = path.join('C:/Users/nadire/Desktop/nadire-portfolio/assets/bitirme');
const BASE = 'http://127.0.0.1:8081';
const tokens = JSON.parse(fs.readFileSync(path.join(OUT, '_tokens.json'), 'utf8'));

async function shot(page, name) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: false });
  console.log('saved', name, fs.statSync(file).size);
}

async function tap(page, text, exact = false) {
  const loc = exact ? page.getByText(text, { exact: true }) : page.getByText(text, { exact: false });
  const n = await loc.count();
  if (!n) throw new Error('not found: ' + text);
  await loc.first().click({ timeout: 8000 });
  await page.waitForTimeout(900);
}

(async () => {
  // refresh token
  const loginBody = JSON.stringify({
    email: 'nadire.portfolyo@test.com',
    password: 'Test1234!',
  });
  const loginRes = await fetch('http://127.0.0.1:3000/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: loginBody,
  });
  const fresh = await loginRes.json();
  fs.writeFileSync(path.join(OUT, '_tokens.json'), JSON.stringify(fresh));
  console.log('token ok', !!fresh.accessToken);

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
    localStorage.setItem('hasCompletedOnboarding', 'true');
  }, fresh);

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4000);
  await shot(page, '_debug1.png');

  // Finish onboarding if present
  for (let step = 0; step < 8; step++) {
    const txt = await page.locator('body').innerText();
    if (/personalize|experience level|Beginner/i.test(txt)) {
      console.log('onboarding step', step);
      try {
        await tap(page, 'Beginner');
      } catch {}
      // next buttons
      for (const b of ['Next', 'Continue', 'Devam', 'Skip', 'Atla', 'Finish', 'Get Started', 'Başla']) {
        try {
          await tap(page, b);
          break;
        } catch {}
      }
      await page.waitForTimeout(700);
    } else break;
  }
  await shot(page, '_debug2.png');

  // If still onboarding pick options then continue
  const txt2 = await page.locator('body').innerText();
  console.log('screen snippet:', txt2.slice(0, 200).replace(/\n/g, ' | '));

  async function bottomTab(label) {
    // click the LAST occurrence (bottom nav)
    const all = page.getByText(label, { exact: false });
    const count = await all.count();
    console.log(label, 'count', count);
    if (count === 0) return false;
    await all.nth(count - 1).click({ timeout: 5000 });
    await page.waitForTimeout(1400);
    return true;
  }

  // Home
  await bottomTab('Ana Sayfa');
  await shot(page, '02-ana-ekran.png');

  // Lessons
  await bottomTab('Öğren');
  await shot(page, '02-dersler.png');
  try {
    await tap(page, 'İlk C++');
    await page.waitForTimeout(2000);
  } catch {
    try { await tap(page, 'Temel Veri'); } catch {}
  }
  await shot(page, '03-ders-icerik.png');

  // Quiz
  await bottomTab('Quiz');
  await shot(page, '04-quiz-secim.png');
  try {
    await tap(page, 'Temel Değişkenler - Giriş');
  } catch {
    try { await tap(page, 'Temel Değişkenler'); } catch (e) { console.log(e.message); }
  }
  await page.waitForTimeout(2000);
  await shot(page, '05-quiz.png');
  try {
    await tap(page, 'int', true);
    await page.waitForTimeout(500);
    for (const b of ['Gönder', 'Devam', 'Sonraki', 'Kontrol']) {
      try { await tap(page, b); break; } catch {}
    }
    await page.waitForTimeout(1500);
  } catch (e) { console.log('ans', e.message); }
  await shot(page, '05b-quiz-2.png');

  // Chat multi-turn
  await bottomTab('Chead Chat');
  await page.waitForTimeout(1200);
  await shot(page, '07-ai-chat.png');

  const input = page.locator('input').last();
  const qs = [
    'C++ pointer nedir kisaca?',
    'for dongusu ornegi ver',
    'iki sayi toplayan fonksiyon yaz',
  ];
  for (let i = 0; i < qs.length; i++) {
    try {
      await input.fill(qs[i]);
      await page.keyboard.press('Enter');
      // try clicking send icon near input - last pressable
      await page.waitForTimeout(300);
      const buttons = page.locator('[role="button"], button');
      const bc = await buttons.count();
      if (bc > 0) {
        try { await buttons.nth(bc - 1).click({ timeout: 1000 }); } catch {}
      }
      console.log('sent', qs[i], '- waiting');
      await page.waitForTimeout(22000);
      await shot(page, `07-turn-${i + 1}.png`);
    } catch (e) {
      console.log('chat fail', e.message);
    }
  }
  await shot(page, '07-ai-chat.png');
  await page.mouse.wheel(0, -1500);
  await page.waitForTimeout(500);
  await shot(page, '07b-ai-chat-scroll.png');

  await bottomTab('Kod Oluşturucu');
  await shot(page, '08-ai-editor.png');

  await bottomTab('Profil');
  await shot(page, '06-profil.png');

  // login shot clean
  const c2 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p2 = await c2.newPage();
  await p2.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p2.waitForTimeout(2500);
  await p2.screenshot({ path: path.join(OUT, '01-login.png') });
  console.log('01-login done');
  await c2.close();
  await browser.close();
  console.log('DONE');
})().catch((e) => { console.error(e); process.exit(1); });
