const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT = path.join('C:/Users/nadire/Desktop/nadire-portfolio/assets/bitirme');
const BASE = 'http://127.0.0.1:8081';
const tokens = JSON.parse(fs.readFileSync(path.join(OUT, '_tokens.json'), 'utf8'));

async function shot(page, name) {
  const f = path.join(OUT, name);
  await page.screenshot({ path: f, fullPage: false });
  console.log('saved', name, fs.statSync(f).size);
}

async function clickText(page, text, opts = {}) {
  const loc = page.getByText(text, { exact: opts.exact || false });
  const n = await loc.count();
  if (!n) throw new Error('missing: ' + text);
  await loc.nth(opts.last ? n - 1 : 0).click({ force: true, timeout: 8000 });
  await page.waitForTimeout(opts.wait || 1200);
}

(async () => {
  // refresh token
  const loginRes = await fetch('http://127.0.0.1:3000/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'nadire.portfolyo@test.com', password: 'Test1234!' }),
  });
  const fresh = await loginRes.json();
  fs.writeFileSync(path.join(OUT, '_tokens.json'), JSON.stringify(fresh));

  const browser = await chromium.launch({ headless: true });

  // ===== WIDE viewport for Code Builder (thesis-like) =====
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  await page.addInitScript((t) => {
    localStorage.setItem('accessToken', t.accessToken);
    localStorage.setItem('refreshToken', t.refreshToken);
    localStorage.setItem('user', JSON.stringify(t.user));
    localStorage.setItem('onboarding_' + t.user.id, 'true');
  }, fresh);

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(3500);

  // Open Code Builder from home card or tab
  try {
    await clickText(page, 'Kod Oluşturucu');
  } catch {
    try {
      await clickText(page, 'Code Builder');
    } catch {
      await clickText(page, 'Start Coding');
    }
  }
  await page.waitForTimeout(2000);
  await shot(page, '08a-kod-olusturucu-bos.png');

  // Create new project
  try {
    await clickText(page, 'Yeni Proje');
  } catch {
    try {
      await clickText(page, 'Yeni Proje Oluştur');
    } catch {
      await clickText(page, 'New Project');
    }
  }
  await page.waitForTimeout(1500);
  await shot(page, '08b-yeni-proje-modal.png');

  // Fill project name/description if inputs exist
  const inputs = page.locator('input, textarea');
  const ic = await inputs.count();
  console.log('modal inputs', ic);
  if (ic >= 1) {
    await inputs.nth(0).fill('StringLibrary');
  }
  if (ic >= 2) {
    await inputs.nth(1).fill('C++ string yardimci kutuphanesi');
  }
  // confirm create
  for (const b of ['Oluştur', 'Create', 'Kaydet', 'Tamam', 'Yeni Proje Oluştur']) {
    const btn = page.getByText(b, { exact: false });
    if (await btn.count()) {
      await btn.first().click({ force: true });
      await page.waitForTimeout(4000);
      break;
    }
  }
  await shot(page, '08-ai-kod-olusturucu.png');

  // Try AI generate code into project
  const aiBox = page.getByPlaceholder(/AI|ne istiyorsunuz|What do you want/i);
  if (await aiBox.count()) {
    await aiBox.first().fill('string_utils icin reverse ve length fonksiyonlari yaz');
    for (const b of ['KOD OLUŞTUR', 'Generate Code', 'Kod Oluştur']) {
      const btn = page.getByText(b, { exact: false });
      if (await btn.count()) {
        await btn.first().click({ force: true });
        console.log('clicked generate, waiting');
        await page.waitForTimeout(25000);
        break;
      }
    }
  }
  await shot(page, '08c-kod-olusturuldu.png');

  // ===== Random Questions: error + AI evaluate =====
  try {
    await clickText(page, 'Rastgele', { last: true });
  } catch {
    try {
      await clickText(page, 'Random Questions', { last: true });
    } catch {
      await clickText(page, 'Random', { last: true });
    }
  }
  await page.waitForTimeout(3000);
  await shot(page, '10-rastgele-sorular.png');

  // Put broken code in editor
  const codeArea = page.locator('textarea').first();
  if (await codeArea.count()) {
    await codeArea.click({ force: true });
    await codeArea.fill(`#include <iostream>
int main() {
  std::cout << "Merhaba"
  return 0;
}`);
  } else {
    // contenteditable / RN TextInput
    const any = page.locator('[contenteditable="true"], textarea, input').first();
    if (await any.count()) {
      await any.fill(`#include <iostream>\nint main(){ std::cout << "x" return 0; }`);
    }
  }
  await page.waitForTimeout(500);

  // Run to get compile error
  for (const b of ['Çalıştır', 'Kodu Çalıştır', 'Run']) {
    const btn = page.getByText(b, { exact: true });
    if (await btn.count()) {
      await btn.first().click({ force: true });
      console.log('run clicked');
      await page.waitForTimeout(12000);
      break;
    }
  }
  await shot(page, '11-derleme-hatasi.png');

  // Evaluate for AI suggestions
  for (const b of ['Değerlendir', 'Evaluate']) {
    const btn = page.getByText(b, { exact: false });
    if (await btn.count()) {
      await btn.first().click({ force: true });
      console.log('evaluate clicked');
      await page.waitForTimeout(25000);
      break;
    }
  }
  await shot(page, '12-ai-oneri-degerlendirme.png');
  // scroll down to evaluation panel
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(500);
  await shot(page, '13-ai-oneri-paneli.png');

  await ctx.close();

  // Also copy exact thesis figures as reference-quality gallery items
  const emb = path.join(OUT, '_tez_pages', 'embedded');
  const map = [
    ['p12_x36.png', '08-tez-kod-olusturucu.png'],
    ['p19_x55.png', '08d-tez-kod-editor.png'],
    ['p13_x39.png', '10-tez-rastgele-sorular.png'],
    ['p25_x73.png', '11-tez-derleme-hatasi.png'],
    ['p25_x74.png', '12-tez-ai-oneri.png'],
    ['p24_x70.png', '13-tez-degerlendirme.png'],
  ];
  for (const [src, dst] of map) {
    const s = path.join(emb, src);
    if (fs.existsSync(s)) {
      fs.copyFileSync(s, path.join(OUT, dst));
      console.log('copied', dst);
    }
  }

  await browser.close();
  console.log('DONE');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
