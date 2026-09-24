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

async function clickByText(page, text) {
  const el = page.getByText(text, { exact: false }).first();
  await el.click({ timeout: 8000 });
  await page.waitForTimeout(1000);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  // Inject auth before app boots
  await page.addInitScript((t) => {
    localStorage.setItem('accessToken', t.accessToken);
    localStorage.setItem('refreshToken', t.refreshToken);
    localStorage.setItem('user', JSON.stringify(t.user));
    localStorage.setItem('hasCompletedOnboarding', 'true');
  }, tokens);

  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(3500);
  await shot(page, '_debug-authed.png');

  // If still login, do UI login
  const bodyText = await page.locator('body').innerText();
  if (/SIGN IN|Sign In|Login/i.test(bodyText) && /Email/i.test(bodyText)) {
    console.log('still login - UI login');
    const inputs = page.locator('input');
    await inputs.nth(0).fill('nadire.portfolyo@test.com');
    await inputs.nth(1).fill('Test1234!');
    await page.getByText('SIGN IN', { exact: false }).first().click();
    await page.waitForTimeout(4000);
    await shot(page, '01-login.png');
    // after login shot home
  } else {
    // capture login separately in fresh context later
    await shot(page, '02-ana-ekran.png');
  }

  // Helper: tap bottom tab by label text near bottom
  async function tab(label) {
    // Prefer exact bottom nav labels
    const candidates = page.getByText(label, { exact: true });
    const count = await candidates.count();
    console.log('tab candidates', label, count);
    if (count > 0) {
      await candidates.last().click({ timeout: 5000 });
    } else {
      await page.getByText(label, { exact: false }).last().click({ timeout: 5000 });
    }
    await page.waitForTimeout(1500);
  }

  await tab('Ana Sayfa').catch(() => tab('Home'));
  await shot(page, '02-ana-ekran.png');

  await tab('Öğren').catch(() => tab('Learn'));
  await shot(page, '02-dersler.png');
  // open a lesson
  try {
    await page.getByText('İlk C++', { exact: false }).first().click({ timeout: 5000 });
    await page.waitForTimeout(2000);
  } catch {
    try {
      await page.getByText('Temel Veri', { exact: false }).first().click({ timeout: 4000 });
      await page.waitForTimeout(2000);
    } catch (e) {
      console.log('lesson open fail', e.message);
    }
  }
  await shot(page, '03-ders-icerik.png');

  await tab('Quiz');
  await shot(page, '04-quiz-secim.png');
  try {
    await page.getByText('Temel Değişkenler', { exact: false }).first().click({ timeout: 5000 });
    await page.waitForTimeout(2000);
  } catch (e) {
    console.log('quiz open fail', e.message);
  }
  await shot(page, '05-quiz.png');
  // answer first option then next question
  try {
    const opts = ['int', 'var', 'let', '0', 'true', 'false'];
    for (const o of opts) {
      const c = page.getByText(o, { exact: true });
      if (await c.count()) {
        await c.first().click();
        break;
      }
    }
    await page.waitForTimeout(800);
    for (const b of ['Gönder', 'Devam', 'Sonraki', 'Kontrol Et', 'Check']) {
      const btn = page.getByText(b, { exact: false });
      if (await btn.count()) {
        await btn.first().click();
        await page.waitForTimeout(1500);
        break;
      }
    }
  } catch (e) {
    console.log('answer fail', e.message);
  }
  await shot(page, '05b-quiz-2.png');

  await tab('Chead Chat').catch(() => tab('Chat'));
  await page.waitForTimeout(1500);
  await shot(page, '07-ai-chat.png');

  // Find text input near bottom
  const input = page.locator('input[placeholder*="Mesaj" i], textarea, input').last();
  const qs = [
    'C++ pointer nedir? Kisa acikla.',
    'for dongusu ornegi ver',
    'basit toplama fonksiyonu yaz',
  ];
  for (let i = 0; i < qs.length; i++) {
    try {
      await input.click({ timeout: 5000 });
      await input.fill(qs[i]);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      // click send arrow if needed
      const send = page.locator('[aria-label*="send" i]');
      if (await send.count()) await send.first().click();
      console.log('waiting gemini for', qs[i]);
      await page.waitForTimeout(25000);
      await shot(page, i === qs.length - 1 ? '07-ai-chat.png' : `07-turn-${i + 1}.png`);
    } catch (e) {
      console.log('chat turn fail', e.message);
    }
  }
  await page.mouse.wheel(0, -1200);
  await page.waitForTimeout(600);
  await shot(page, '07b-ai-chat-scroll.png');

  await tab('Kod Oluşturucu').catch(() => tab('Code'));
  await page.waitForTimeout(1200);
  await shot(page, '08-ai-editor.png');

  await tab('Profil').catch(() => tab('Profile'));
  await page.waitForTimeout(1000);
  await shot(page, '06-profil.png');

  // Fresh login screenshot
  const ctx2 = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const p2 = await ctx2.newPage();
  await p2.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  await p2.waitForTimeout(2000);
  await p2.screenshot({ path: path.join(OUT, '01-login.png') });
  console.log('saved 01-login.png');
  await ctx2.close();

  await browser.close();
  console.log('DONE');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
