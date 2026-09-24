const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const OUT = path.join('C:/Users/nadire/Desktop/nadire-portfolio/assets/bitirme');

async function login() {
  const r = await fetch('http://127.0.0.1:3000/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'nadire.portfolyo@test.com', password: 'Test1234!' }),
  });
  return r.json();
}

async function shot(page, name) {
  const f = path.join(OUT, name);
  await page.screenshot({ path: f, fullPage: false });
  console.log('LIVE', name, fs.statSync(f).size);
}

(async () => {
  const tok = await login();
  if (!tok.accessToken) throw new Error(JSON.stringify(tok));

  const browser = await chromium.launch({ headless: true });
  const page = await (
    await browser.newContext({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 1 })
  ).newPage();

  await page.addInitScript((t) => {
    localStorage.setItem('accessToken', t.accessToken);
    localStorage.setItem('refreshToken', t.refreshToken);
    localStorage.setItem('user', JSON.stringify(t.user));
    localStorage.setItem('onboarding_' + t.user.id, 'true');
    localStorage.setItem('colorScheme', 'dark');
  }, tok);

  await page.goto('http://127.0.0.1:8081', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4000);
  await shot(page, '02-ana-ekran.png');

  // Code Builder
  await page.getByText('Code Builder', { exact: false }).last().click({ force: true });
  await page.waitForTimeout(1500);
  await shot(page, '08a-kod-bos.png');

  await page.getByText('+ New Project', { exact: false }).first().click({ force: true });
  await page.waitForTimeout(1500);
  await shot(page, '08b-yeni-proje-ai.png');

  // Fill visible text fields only (not switches)
  const nameBox = page.getByPlaceholder(/Project Name|Proje ad/i);
  const descBox = page.getByPlaceholder(/Description|Açıklama|details for AI|AI/i);
  if (await nameBox.count()) {
    await nameBox.first().fill('StringLibrary');
  } else {
    // fallback: visible text inputs
    const vis = page.locator('input[type="text"], input:not([type]), textarea');
    const n = await vis.count();
    console.log('visible fields', n);
    for (let i = 0; i < n; i++) {
      const el = vis.nth(i);
      if (await el.isVisible()) {
        const ph = (await el.getAttribute('placeholder')) || '';
        console.log('field', i, ph);
      }
    }
    // fill first two visible editable
    let filled = 0;
    for (let i = 0; i < n && filled < 2; i++) {
      const el = vis.nth(i);
      if (!(await el.isVisible())) continue;
      const typ = await el.getAttribute('type');
      if (typ === 'checkbox' || typ === 'radio') continue;
      await el.fill(filled === 0 ? 'StringLibrary' : 'C++ string utils reverse length concat');
      filled++;
    }
  }
  if (await descBox.count()) {
    await descBox.first().fill('C++ string utils reverse length concat helper');
  }

  await shot(page, '08b-yeni-proje-ai.png');

  const waitCreate = page.waitForResponse(
    (r) => r.url().includes('/ai/create-project'),
    { timeout: 120000 }
  );
  await page.getByText('Create with AI', { exact: false }).first().click({ force: true });
  console.log('waiting create-project...');
  const resp = await waitCreate;
  const data = await resp.json();
  console.log('API', resp.status(), data.success, (data.files || []).map((f) => f.name));

  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(1000);
    const t = await page.locator('body').innerText();
    if (/main\.cpp|StringUtils|Generate Code|KOD OLUŞTUR|AI Assistant|AI Asistan|Files|Dosyalar/i.test(t) && !/Create New AI Project/i.test(t)) {
      console.log('UI ready', i);
      break;
    }
  }
  await page.waitForTimeout(2000);
  await shot(page, '08-ai-kod-olusturucu.png');
  await shot(page, '08c-kod-olusturuldu.png');

  // Random questions
  await page.getByText('Home', { exact: false }).last().click({ force: true });
  await page.waitForTimeout(1000);
  await page.getByText('Random Questions', { exact: false }).first().click({ force: true });
  await page.waitForTimeout(3500);
  await shot(page, '10-rastgele-sorular.png');

  const ta = page.locator('textarea');
  if (await ta.count()) {
    await ta.last().fill(`#include <iostream>
using namespace std;
int main() {
  cout << "Merhaba"
  return 0;
}`);
  }

  const runBtn = page.getByText('Run Code', { exact: true });
  if (await runBtn.count()) await runBtn.first().click({ force: true });
  else await page.getByText('Çalıştır', { exact: true }).first().click({ force: true });
  await page.waitForTimeout(15000);
  await shot(page, '11-derleme-hatasi.png');

  const ev = page.getByText('Evaluate', { exact: false });
  const wEv = page.waitForResponse((r) => r.url().includes('evaluate') || r.url().includes('/ai/'), { timeout: 90000 }).catch(() => null);
  if (await ev.count()) await ev.first().click({ force: true });
  else await page.getByText('Değerlendir', { exact: false }).first().click({ force: true });
  await wEv;
  await page.waitForTimeout(4000);
  await page.mouse.wheel(0, 700);
  await shot(page, '12-ai-oneri-degerlendirme.png');
  await shot(page, '13-ai-oneri-paneli.png');

  // Lessons, quiz, chat, profile — same dark session
  await page.getByText('Home', { exact: false }).last().click({ force: true });
  await page.waitForTimeout(800);
  await page.getByText('Learn', { exact: false }).last().click({ force: true });
  await page.waitForTimeout(1500);
  await shot(page, '02-dersler.png');
  try {
    await page.getByText('İlk C++', { exact: false }).first().click({ force: true });
    await page.waitForTimeout(2000);
  } catch {}
  await shot(page, '03-ders-icerik.png');

  await page.getByText('Quiz', { exact: true }).last().click({ force: true });
  await page.waitForTimeout(1200);
  await shot(page, '04-quiz-secim.png');
  try {
    await page.getByText('Temel Değişkenler', { exact: false }).first().click({ force: true });
    await page.waitForTimeout(2000);
    await page.getByText('int', { exact: true }).first().click({ force: true });
    await page.waitForTimeout(500);
    for (const b of ['Gönder', 'Devam', 'Sonraki']) {
      const x = page.getByText(b, { exact: false });
      if (await x.count()) {
        await x.first().click({ force: true });
        await page.waitForTimeout(900);
      }
    }
  } catch {}
  await shot(page, '05-quiz.png');
  await shot(page, '05b-quiz-2.png');

  await page.getByText('Chead Chat', { exact: false }).last().click({ force: true });
  await page.waitForTimeout(2000);
  const chat = page.getByPlaceholder(/Mesaj/i);
  if (await chat.count()) {
    await chat.fill('Pointer nedir kisaca?');
    await page.evaluate(() => document.querySelector('textarea')?.parentElement?.children?.[1]?.click());
    await page.waitForTimeout(22000);
    await chat.fill('iki sayi toplayan fonksiyon yaz');
    await page.evaluate(() => document.querySelector('textarea')?.parentElement?.children?.[1]?.click());
    await page.waitForTimeout(25000);
  }
  await shot(page, '07-ai-chat.png');
  await page.mouse.wheel(0, -1200);
  await shot(page, '07b-ai-chat-scroll.png');

  await page.getByText('Profile', { exact: false }).last().click({ force: true });
  await page.waitForTimeout(1000);
  await shot(page, '06-profil.png');

  // login phone dark
  const c2 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p2 = await c2.newPage();
  await p2.addInitScript(() => localStorage.setItem('colorScheme', 'dark'));
  await p2.goto('http://127.0.0.1:8081', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p2.waitForTimeout(2500);
  await p2.screenshot({ path: path.join(OUT, '01-login.png') });
  console.log('LIVE 01-login');
  await c2.close();
  await browser.close();
  console.log('DONE ALL LIVE DARK');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
