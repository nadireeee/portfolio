/**
 * LIVE captures only — no PDF embeds.
 * Force dark theme for consistency.
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT = path.join('C:/Users/nadire/Desktop/nadire-portfolio/assets/bitirme');
const BASE = 'http://127.0.0.1:8081';

async function login() {
  const r = await fetch('http://127.0.0.1:3000/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'nadire.portfolyo@test.com',
      password: 'Test1234!',
    }),
  });
  const j = await r.json();
  if (!j.accessToken) throw new Error('login fail ' + JSON.stringify(j));
  fs.writeFileSync(path.join(OUT, '_tokens.json'), JSON.stringify(j));
  return j;
}

async function shot(page, name) {
  const f = path.join(OUT, name);
  await page.screenshot({ path: f, fullPage: false });
  console.log('LIVE', name, fs.statSync(f).size);
}

async function forceClick(page, text, last = false) {
  const loc = page.getByText(text, { exact: false });
  const n = await loc.count();
  if (!n) throw new Error('not found: ' + text);
  await loc.nth(last ? n - 1 : 0).click({ force: true, timeout: 10000 });
  await page.waitForTimeout(1200);
}

(async () => {
  const tok = await login();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 820 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  await page.addInitScript((t) => {
    localStorage.setItem('accessToken', t.accessToken);
    localStorage.setItem('refreshToken', t.refreshToken);
    localStorage.setItem('user', JSON.stringify(t.user));
    localStorage.setItem('onboarding_' + t.user.id, 'true');
    localStorage.setItem('colorScheme', 'dark'); // ALL dark
    localStorage.setItem('theme', 'dark');
  }, tok);

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4000);

  // Toggle dark via Profile if still light
  try {
    await forceClick(page, 'Profile', true);
    const dark = page.getByText(/Karanlık|Dark/i);
    if (await dark.count()) {
      // if toggle says light mode is on, click to dark
      const body = await page.locator('body').innerText();
      if (/aydınlık|light mode|Light/i.test(body) && !/karanlık mod kullanılıyor|dark mode is/i.test(body)) {
        await dark.first().click({ force: true }).catch(() => {});
        // try switch
        const sw = page.locator('[role="switch"]').first();
        if (await sw.count()) await sw.click({ force: true });
      }
    }
  } catch (e) {
    console.log('theme toggle skip', e.message);
  }

  await forceClick(page, 'Home', true).catch(() => {});
  await page.waitForTimeout(1000);
  await shot(page, '01-login.png'); // will overwrite later with clean login
  await shot(page, '02-ana-ekran.png');

  // ===== CODE BUILDER: Create with AI (LIVE API) =====
  await forceClick(page, 'Code Builder', true).catch(async () => {
    await forceClick(page, 'Kod Oluşturucu', true);
  });
  await page.waitForTimeout(1500);
  await shot(page, '08a-kod-bos.png');

  await forceClick(page, 'New Project').catch(async () => {
    await forceClick(page, 'Yeni Proje');
  });
  await page.waitForTimeout(1000);

  const inputs = page.locator('input, textarea');
  await inputs.nth(0).fill('StringLibrary');
  await inputs.nth(1).fill('C++ string utils reverse length concat helper library');
  await shot(page, '08b-yeni-proje-ai.png');

  // Click Create with AI and wait for network
  const createPromise = page
    .waitForResponse(
      (r) => r.url().includes('/ai/create-project') && r.status() < 500,
      { timeout: 90000 }
    )
    .catch((e) => {
      console.log('no network wait', e.message);
      return null;
    });

  await page.getByText('Create with AI', { exact: false }).first().click({ force: true });
  console.log('Create with AI clicked');
  const resp = await createPromise;
  if (resp) {
    const data = await resp.json().catch(() => null);
    console.log(
      'create-project status',
      resp.status(),
      'files',
      data?.files?.map((f) => f.name)
    );
  }
  // wait UI to settle
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(1000);
    const t = await page.locator('body').innerText();
    if (
      /main\.cpp|StringUtils|Dosyalar|Files|KOD OLUŞTUR|Generate Code|AI Asistan|AI Assistant/i.test(
        t
      ) && !/Create New AI Project|Yeni Proje Oluştur/i.test(t)
    ) {
      console.log('project UI ready', i);
      break;
    }
  }
  await page.waitForTimeout(1500);
  await shot(page, '08-ai-kod-olusturucu.png');

  // Generate more code via AI panel
  const ph = page.getByPlaceholder(/AI|ne istiyorsunuz|What do you want/i);
  if (await ph.count()) {
    await ph.first().fill('string reverse fonksiyonu ekle ve main icinde test et');
    const gen = page.getByText(/KOD OLUŞTUR|Generate Code/i);
    if (await gen.count()) {
      const gWait = page
        .waitForResponse((r) => r.url().includes('/ai/') && r.request().method() === 'POST', {
          timeout: 60000,
        })
        .catch(() => null);
      await gen.first().click({ force: true });
      await gWait;
      await page.waitForTimeout(3000);
    }
  }
  await shot(page, '08c-kod-olusturuldu.png');

  // ===== RANDOM QUESTIONS: broken code + run + evaluate (LIVE) =====
  await forceClick(page, 'Home', true).catch(() => {});
  await page.waitForTimeout(800);
  await forceClick(page, 'Random Questions');
  await page.waitForTimeout(3500);
  await shot(page, '10-rastgele-sorular.png');

  const tas = page.locator('textarea');
  if (await tas.count()) {
    await tas
      .last()
      .fill(`#include <iostream>
using namespace std;
int main() {
  cout << "Merhaba"
  return 0;
}`);
  }
  await page.waitForTimeout(500);

  // Run
  for (const b of ['Run Code', 'Çalıştır', 'Kodu Çalıştır']) {
    const btn = page.getByText(b, { exact: true });
    if (await btn.count()) {
      await btn.first().click({ force: true });
      console.log('run', b);
      break;
    }
  }
  await page.waitForTimeout(15000);
  await shot(page, '11-derleme-hatasi.png');

  // Evaluate
  for (const b of ['Evaluate', 'Değerlendir']) {
    const btn = page.getByText(b, { exact: false });
    if (await btn.count()) {
      const w = page
        .waitForResponse((r) => r.url().includes('evaluate') || r.url().includes('/ai/'), {
          timeout: 60000,
        })
        .catch(() => null);
      await btn.first().click({ force: true });
      console.log('evaluate', b);
      await w;
      await page.waitForTimeout(3000);
      break;
    }
  }
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(500);
  await shot(page, '12-ai-oneri-degerlendirme.png');

  // Analyze
  for (const b of ['Analyze Code', 'Analiz']) {
    const btn = page.getByText(b, { exact: false });
    if (await btn.count()) {
      await btn.first().click({ force: true });
      await page.waitForTimeout(20000);
      break;
    }
  }
  await page.mouse.wheel(0, 400);
  await shot(page, '13-ai-oneri-paneli.png');

  // ===== Other screens same dark theme =====
  await forceClick(page, 'Home', true).catch(() => {});
  await page.waitForTimeout(800);
  await shot(page, '02-ana-ekran.png');

  await forceClick(page, 'Learn', true).catch(async () => forceClick(page, 'Öğren', true));
  await page.waitForTimeout(1500);
  await shot(page, '02-dersler.png');
  try {
    await forceClick(page, 'İlk C++');
    await page.waitForTimeout(2000);
  } catch {
    try {
      await forceClick(page, 'Hello');
    } catch {}
  }
  await shot(page, '03-ders-icerik.png');

  await forceClick(page, 'Quiz', true);
  await page.waitForTimeout(1200);
  await shot(page, '04-quiz-secim.png');
  try {
    await forceClick(page, 'Temel Değişkenler');
    await page.waitForTimeout(2000);
  } catch {}
  await shot(page, '05-quiz.png');
  try {
    await page.getByText('int', { exact: true }).first().click({ force: true });
    await page.waitForTimeout(400);
    for (const b of ['Gönder', 'Devam', 'Sonraki']) {
      const btn = page.getByText(b, { exact: false });
      if (await btn.count()) {
        await btn.first().click({ force: true });
        await page.waitForTimeout(1000);
      }
    }
  } catch {}
  await shot(page, '05b-quiz-2.png');

  await forceClick(page, 'Chead Chat', true).catch(async () => forceClick(page, 'Chat', true));
  await page.waitForTimeout(2000);
  const box = page.getByPlaceholder(/Mesaj|message/i);
  if (await box.count()) {
    await box.fill('Pointer nedir kisaca?');
    await page.evaluate(() => {
      const ta = document.querySelector('textarea');
      const btn = ta?.parentElement?.children?.[1];
      if (btn) btn.click();
    });
    await page.waitForTimeout(20000);
    await box.fill('iki sayi toplayan fonksiyon yaz');
    await page.evaluate(() => {
      const ta = document.querySelector('textarea');
      const btn = ta?.parentElement?.children?.[1];
      if (btn) btn.click();
    });
    await page.waitForTimeout(25000);
  }
  await shot(page, '07-ai-chat.png');
  await page.mouse.wheel(0, -1500);
  await page.waitForTimeout(400);
  await shot(page, '07b-ai-chat-scroll.png');

  await forceClick(page, 'Profile', true);
  await page.waitForTimeout(1000);
  await shot(page, '06-profil.png');

  // clean login (no auth) — also dark if possible
  const c2 = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const p2 = await c2.newPage();
  await p2.addInitScript(() => {
    localStorage.setItem('colorScheme', 'dark');
  });
  await p2.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p2.waitForTimeout(2500);
  await p2.screenshot({ path: path.join(OUT, '01-login.png') });
  console.log('LIVE 01-login');
  await c2.close();

  await browser.close();
  console.log('ALL LIVE DONE');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
