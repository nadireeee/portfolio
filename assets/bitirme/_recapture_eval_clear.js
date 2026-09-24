/**
 * Recapture AI evaluation panel clearly in viewport (scrolled into view).
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

async function shot(page, name) {
  for (const dir of [OUT, DOCS]) {
    fs.mkdirSync(dir, { recursive: true });
    const f = path.join(dir, name);
    await page.screenshot({ path: f, fullPage: false });
    console.log('SHOT', name, fs.statSync(f).size);
  }
}

(async () => {
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
  const page = await (
    await browser.newContext({
      viewport: { width: 1280, height: 900 },
      deviceScaleFactor: 1.25,
    })
  ).newPage();

  await page.route('**/ai/random-question/evaluate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        evaluation:
          'Kodun genel olarak doğru. Kullanıcıdan N alıp 1..N arası çift sayıların toplamını hesaplıyor ve ekrana yazdırıyorsun. Eksik nokta yok; çözüm soruyu karşılıyor.',
        suggestions: [
          'n > 0 kontrolü ekleyebilirsin',
          'Büyük N için long long kullanabilirsin',
        ],
        suggestedCode: GOOD_CODE,
        newlyAwardedBadges: [],
      }),
    });
  });

  await page.route('**/ai/random-question', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    if (route.request().url().includes('evaluate')) return route.continue();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        question:
          "Kullanıcıdan pozitif bir tam sayı (N) alan ve 1'den N'e kadar olan tüm çift sayıların toplamını hesaplayıp ekrana yazdıran bir C++ programı yazınız.",
        expectedAnswer: 'N=10 → 30',
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
  await page.waitForTimeout(4500);
  await page.getByText(/Rastgele Sorular/i).first().click({ force: true });
  await page.waitForTimeout(2800);

  await page.evaluate((code) => {
    const areas = Array.from(
      document.querySelectorAll('textarea, [contenteditable="true"]')
    );
    for (const el of areas) {
      el.focus();
      if (el.tagName.toLowerCase() === 'textarea') {
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
    }
  }, GOOD_CODE);
  await page.waitForTimeout(500);

  await page.getByText(/Değerlendir/i).first().click({ force: true });
  await page.waitForTimeout(2000);

  // Scroll evaluation card into center of viewport
  const scrolled = await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('*'));
    const label = nodes.find(
      (n) =>
        n.childNodes.length === 1 &&
        n.childNodes[0].nodeType === 3 &&
        /Değerlendirme|Evaluation/i.test(n.textContent || '')
    );
    if (!label) return false;
    const card =
      label.closest('[class*="result"]') ||
      label.parentElement?.parentElement ||
      label.parentElement;
    if (card && card.scrollIntoView) {
      card.scrollIntoView({ block: 'center', behavior: 'instant' });
      return true;
    }
    return false;
  });
  console.log('scrolled_to_eval', scrolled);

  // Extra drag scroll if needed
  for (let i = 0; i < 4; i++) {
    const t = await page.locator('body').innerText();
    if (/Kodun genel olarak doğru/i.test(t)) {
      // Check if evaluation text is near top of visible area by scrolling more
      await page.mouse.move(640, 620);
      await page.mouse.down();
      await page.mouse.move(640, 180, { steps: 14 });
      await page.mouse.up();
      await page.waitForTimeout(400);
    }
  }

  // Prefer element screenshot of evaluation card if we can find it
  const evalLoc = page.getByText(/Kodun genel olarak doğru/i).first();
  if (await evalLoc.count()) {
    await evalLoc.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    // Shot full page first for context, then a focused crop via clip around eval
    const box = await evalLoc.boundingBox();
    console.log('eval_box', box);
    if (box) {
      // Expand clip to include title + card
      const clip = {
        x: Math.max(0, box.x - 40),
        y: Math.max(0, box.y - 80),
        width: Math.min(1280 - Math.max(0, box.x - 40), Math.max(box.width + 80, 520)),
        height: Math.min(900 - Math.max(0, box.y - 80), Math.max(box.height + 120, 280)),
      };
      for (const dir of [OUT, DOCS]) {
        const f = path.join(dir, '12-ai-oneri-degerlendirme.png');
        await page.screenshot({ path: f, clip });
        console.log('CLIP', f, fs.statSync(f).size, clip);
      }
    } else {
      await shot(page, '12-ai-oneri-degerlendirme.png');
    }
  } else {
    throw new Error('evaluation text not found');
  }

  // Also save a full scrolled view as alternate clear shot of whole bottom section
  await shot(page, '12b-degerlendirme-scroll.png');

  const body = await page.locator('body').innerText();
  console.log('BODY', body.slice(body.indexOf('Değerlendir'), body.indexOf('Değerlendir') + 280).replace(/\n/g, ' | '));

  await browser.close();
  console.log('DONE');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
