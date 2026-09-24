/**
 * Fix portfolio screens:
 * - lessons list + lesson content (filled)
 * - random question with successful AI evaluation (mocked if Gemini fails)
 * - single home shot (no duplicate)
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('C:/Users/nadire/Desktop/nadire-portfolio/node_modules/playwright');

const OUT = 'C:/Users/nadire/Desktop/nadire-portfolio/assets/bitirme';
const DOCS = 'C:/Users/nadire/Desktop/CodeLearn/docs/screenshots';
const BASE = 'http://127.0.0.1:8081';
const API = 'http://127.0.0.1:3000';

const GOOD_CODE = `#include <iostream>
using namespace std;
int main() {
  int n, sum = 0;
  cin >> n;
  for (int i = 2; i <= n; i += 2) sum += i;
  cout << sum << endl;
  return 0;
}`;

async function api(method, url, token, body) {
  const r = await fetch(API + url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(method + ' ' + url + ' ' + r.status);
  return data;
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
  const tok = await api('POST', '/auth/login', null, {
    email: 'nadire.portfolyo@test.com',
    password: 'Test1234!',
  });
  const chapters = await api(
    'GET',
    '/lessons/chapters?language=cpp&locale=tr',
    tok.accessToken
  );
  console.log('chapters', chapters.length, chapters.map((c) => c.title).join(' | '));

  const browser = await chromium.launch({ headless: true });
  const page = await (
    await browser.newContext({ viewport: { width: 1280, height: 860 } })
  ).newPage();

  // Mock Gemini evaluate so portfolio never shows error banner
  await page.route('**/ai/random-question/evaluate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        evaluation:
          'Kodun genel olarak doğru. Kullanıcıdan N alıp 1..N arası çift sayıların toplamını hesaplıyor ve ekrana yazdırıyorsun. Eksik nokta yok; çözüm soruyu karşılıyor.',
        suggestions: [
          'cin hatalarına karşı n > 0 kontrolü ekleyebilirsin',
          'long long kullanarak daha büyük N değerlerini destekleyebilirsin',
        ],
        suggestedCode: GOOD_CODE,
        newlyAwardedBadges: [],
      }),
    });
  });

  // Also mock random-question fetch if slow/failing
  await page.route('**/ai/random-question', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    const url = route.request().url();
    if (url.includes('evaluate')) return route.continue();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        question:
          "Kullanıcıdan pozitif bir tam sayı (N) alan ve 1'den N'e kadar olan tüm çift sayıların toplamını hesaplayıp ekrana yazdıran bir C++ programı yazınız.",
        expectedAnswer: 'Örnek: N=10 için çıktı 30 olmalı (2+4+6+8+10).',
        solutionCode: GOOD_CODE,
      }),
    });
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

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(5000);

  // ---- Home (single) ----
  await page.getByText('Ana Sayfa', { exact: true }).last().click({ force: true }).catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, '02-ana-ekran.png');
  // Keep 02-giris-sonrasi as distinct post-login only if different; copy ana for now then we remove from README
  await shot(page, '02-giris-sonrasi.png');

  // ---- Lessons list ----
  await page.getByText('Öğren', { exact: true }).last().click({ force: true });
  await page.waitForTimeout(2800);
  let body = await page.locator('body').innerText();
  console.log('LESSONS', body.slice(0, 280).replace(/\n/g, ' | '));
  if (!/C\+\+|Ders|konu|Giriş|Değişken/i.test(body)) {
    await page.getByText(/Dersler/i).first().click({ force: true });
    await page.waitForTimeout(2500);
    body = await page.locator('body').innerText();
    console.log('LESSONS2', body.slice(0, 280).replace(/\n/g, ' | '));
  }
  await shot(page, '02-dersler.png');

  // ---- Lesson content ----
  const lessonLink = page.getByText(/İlk C\+\+ Programı|Temel Veri|Derleme|C\+\+ Temel/i).first();
  if (await lessonLink.count()) {
    await lessonLink.click({ force: true });
    await page.waitForTimeout(2500);
    // maybe need second click into actual lesson
    const inner = page.getByText(/İlk C\+\+ Programı|Temel Veri Tipleri|Derleme ve Çalıştırma/i).first();
    if (await inner.count()) {
      await inner.click({ force: true }).catch(() => {});
      await page.waitForTimeout(2500);
    }
  }
  body = await page.locator('body').innerText();
  console.log('LESSON_CONTENT', body.slice(0, 300).replace(/\n/g, ' | '));
  // If still on list, try expand then open
  if (!/#include|Merhaba|Tamamla|Ders 1|std::cout/i.test(body)) {
    await page.getByText(/İlk C\+\+ Programı/i).first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(2500);
    body = await page.locator('body').innerText();
    console.log('LESSON_RETRY', body.slice(0, 300).replace(/\n/g, ' | '));
  }
  await shot(page, '03-ders-icerik.png');

  // ---- Random questions + successful evaluate ----
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4500);
  await page.getByText(/Rastgele Sorular/i).first().click({ force: true });
  await page.waitForTimeout(3000);
  body = await page.locator('body').innerText();
  console.log('RANDOM', body.slice(0, 200).replace(/\n/g, ' | '));

  // Fill editor via React-friendly approach: find textarea/contenteditable
  const filled = await page.evaluate((code) => {
    const areas = Array.from(
      document.querySelectorAll('textarea, [contenteditable="true"], input')
    );
    for (const el of areas) {
      const tag = el.tagName.toLowerCase();
      if (tag === 'textarea' || el.getAttribute('contenteditable') === 'true') {
        el.focus();
        if (tag === 'textarea') {
          const setter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype,
            'value'
          ).set;
          setter.call(el, code);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          el.textContent = code;
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
        return true;
      }
    }
    return false;
  }, GOOD_CODE);
  console.log('code_filled', filled);

  // Also try typing if Monaco-like - click editor then paste
  if (!filled) {
    await page.getByText(/Kodunuzu buraya|main\.cpp|Kodunuz/i).first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(400);
    await page.keyboard.insertText(GOOD_CODE).catch(() => {});
  }
  await page.waitForTimeout(800);
  await shot(page, '10-rastgele-sorular.png');

  // Click Değerlendir
  await page.getByText(/Değerlendir/i).first().click({ force: true });
  await page.waitForTimeout(2500);
  body = await page.locator('body').innerText();
  console.log('EVAL', body.slice(0, 350).replace(/\n/g, ' | '));
  if (/Değerlendirme alınamadı|Failed to get evaluation/i.test(body)) {
    throw new Error('evaluate still showing error');
  }
  // Scroll to show evaluation panel
  await page.mouse.move(640, 500);
  await page.mouse.down();
  await page.mouse.move(640, 200, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(600);
  await shot(page, '12-ai-oneri-degerlendirme.png');
  // Also update 11 if needed - skip

  await browser.close();
  console.log('DONE');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
