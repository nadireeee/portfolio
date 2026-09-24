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
  if (!fresh.accessToken) throw new Error(JSON.stringify(fresh));
  fs.writeFileSync(path.join(OUT, '_tokens.json'), JSON.stringify(fresh));
  const uid = fresh.user.id;
  console.log('user', uid);

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
    localStorage.setItem('onboarding_' + t.user.id, 'true');
  }, fresh);

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4500);
  await shot(page, '_debug-home.png');
  const snippet = (await page.locator('body').innerText()).slice(0, 250).replace(/\n/g, ' | ');
  console.log('SNIP:', snippet);

  async function bottom(label) {
    const all = page.getByText(label, { exact: false });
    const c = await all.count();
    console.log(label, c);
    if (!c) return false;
    await all.nth(c - 1).click();
    await page.waitForTimeout(1600);
    return true;
  }

  await bottom('Ana Sayfa');
  await shot(page, '02-ana-ekran.png');

  await bottom('Öğren');
  await shot(page, '02-dersler.png');
  try {
    await page.getByText('İlk C++', { exact: false }).first().click({ timeout: 5000 });
    await page.waitForTimeout(2500);
  } catch {
    try {
      await page.getByText('Temel Veri', { exact: false }).first().click({ timeout: 4000 });
      await page.waitForTimeout(2500);
    } catch (e) {
      console.log('lesson', e.message);
    }
  }
  await shot(page, '03-ders-icerik.png');

  await bottom('Quiz');
  await shot(page, '04-quiz-secim.png');
  try {
    await page.getByText('Temel Değişkenler', { exact: false }).first().click({ timeout: 5000 });
    await page.waitForTimeout(2500);
  } catch (e) {
    console.log('quiz open', e.message);
  }
  await shot(page, '05-quiz.png');
  try {
    const opt = page.getByText('int', { exact: true }).first();
    if (await opt.count()) await opt.click();
    await page.waitForTimeout(400);
    for (const b of ['Gönder', 'Devam', 'Sonraki', 'Kontrol Et']) {
      const btn = page.getByText(b, { exact: false });
      if (await btn.count()) {
        await btn.first().click();
        break;
      }
    }
    await page.waitForTimeout(1800);
  } catch (e) {
    console.log('ans', e.message);
  }
  await shot(page, '05b-quiz-2.png');

  await bottom('Chead Chat');
  await page.waitForTimeout(1200);

  // Multi-turn chat - use evaluate to set text if needed
  const qs = [
    'C++ pointer nedir kisaca acikla',
    'for dongusu icin kisa ornek ver',
    'iki sayiyi toplayan fonksiyon yaz',
  ];
  for (let i = 0; i < qs.length; i++) {
    const inputs = page.locator('input');
    const n = await inputs.count();
    console.log('inputs', n);
    if (n === 0) {
      console.log('no input');
      break;
    }
    const input = inputs.nth(n - 1);
    await input.click();
    await input.fill(qs[i]);
    await page.keyboard.press('Enter');
    // also try pressing last button (send)
    const buttons = page.locator('[role="button"]');
    const bc = await buttons.count();
    if (bc) {
      try {
        await buttons.nth(bc - 1).click({ timeout: 1500 });
      } catch {}
    }
    console.log('waiting reply', i + 1);
    await page.waitForTimeout(28000);
    await shot(page, `07-turn-${i + 1}.png`);
  }
  await shot(page, '07-ai-chat.png');
  await page.mouse.wheel(0, -1800);
  await page.waitForTimeout(500);
  await shot(page, '07b-ai-chat-scroll.png');

  await bottom('Kod Oluşturucu');
  await shot(page, '08-ai-editor.png');

  await bottom('Profil');
  await shot(page, '06-profil.png');

  // Forum tab might be badges/rozet - check BottomNavbar - Forum is 4th?
  // From App: Home, Lessons, Quiz, Forum, Chat, Code, Settings
  // Navbar labels may say Rozetler wrongly in old shots - try Forum
  await bottom('Forum').catch(() => {});
  await bottom('Rozetler');
  await shot(page, '09-forum.png');

  // login
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
