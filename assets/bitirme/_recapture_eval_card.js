const path = require('path');
const fs = require('fs');
const { chromium } = require('C:/Users/nadire/Desktop/nadire-portfolio/node_modules/playwright');

const OUT = 'C:/Users/nadire/Desktop/nadire-portfolio/assets/bitirme';
const DOCS = 'C:/Users/nadire/Desktop/CodeLearn/docs/screenshots';
const GOOD = `#include <iostream>
using namespace std;
int main() {
  int n, sum = 0;
  cin >> n;
  for (int i = 2; i <= n; i += 2) sum += i;
  cout << sum << endl;
  return 0;
}`;

(async () => {
  const tok = await (
    await fetch('http://127.0.0.1:3000/auth/login', {
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
      viewport: { width: 900, height: 1100 },
      deviceScaleFactor: 1.5,
    })
  ).newPage();

  await page.route('**/ai/random-question/evaluate', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        evaluation:
          'Kodun genel olarak doğru. Kullanıcıdan N alıp 1..N arası çift sayıların toplamını hesaplıyor ve ekrana yazdırıyorsun. Eksik nokta yok; çözüm soruyu karşılıyor.',
        suggestions: [
          'n > 0 kontrolü ekleyebilirsin',
          'Büyük N için long long kullanabilirsin',
        ],
        suggestedCode: GOOD,
        newlyAwardedBadges: [],
      }),
    })
  );

  await page.route('**/ai/random-question', async (r) => {
    if (r.request().method() !== 'POST' || r.request().url().includes('evaluate')) {
      return r.continue();
    }
    await r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        question:
          "Kullanıcıdan pozitif bir tam sayı (N) alan ve 1'den N'e kadar çift sayıların toplamını yazdıran C++ programı yazınız.",
        expectedAnswer: 'N=10 → 30',
        solutionCode: GOOD,
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

  await page.goto('http://127.0.0.1:8081', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await page.getByText(/Rastgele Sorular/i).first().click({ force: true });
  await page.waitForTimeout(2800);

  await page.evaluate((code) => {
    for (const el of document.querySelectorAll('textarea')) {
      const s = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value'
      ).set;
      s.call(el, code);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, GOOD);

  await page.getByText(/Değerlendir/i).first().click({ force: true });
  await page.waitForTimeout(2500);

  const handle = await page.evaluateHandle(() => {
    const texts = Array.from(document.querySelectorAll('*'));
    const title = texts.find(
      (n) =>
        n.childNodes.length === 1 &&
        n.childNodes[0].nodeType === 3 &&
        n.textContent.trim() === 'Değerlendirme'
    );
    if (!title) return null;
    let el = title;
    for (let i = 0; i < 10; i++) {
      if (!el.parentElement) break;
      el = el.parentElement;
      const t = el.innerText || '';
      if (t.includes('Öneriler') && t.includes('Kodun genel')) return el;
    }
    return title.parentElement && title.parentElement.parentElement;
  });

  const el = handle.asElement();
  if (!el) throw new Error('no eval card');
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);

  for (const dir of [OUT, DOCS]) {
    fs.mkdirSync(dir, { recursive: true });
    const f = path.join(dir, '12-ai-oneri-degerlendirme.png');
    await el.screenshot({ path: f });
    console.log('CARD', f, fs.statSync(f).size);
  }

  // Full frame: scroll so evaluation dominates
  await page.evaluate(() => {
    const title = [...document.querySelectorAll('*')].find(
      (n) =>
        n.childNodes.length === 1 &&
        n.childNodes[0].nodeType === 3 &&
        n.textContent.trim() === 'Değerlendirme'
    );
    let el = title;
    for (let i = 0; i < 8 && el; i++) {
      const t = el.innerText || '';
      if (t.includes('Önerilen kod') || t.includes('Öneriler')) {
        el.scrollIntoView({ block: 'start' });
        break;
      }
      el = el.parentElement;
    }
  });
  await page.waitForTimeout(500);
  for (const dir of [OUT, DOCS]) {
    const f = path.join(dir, '12b-degerlendirme-scroll.png');
    await page.screenshot({ path: f });
    console.log('FULL', f, fs.statSync(f).size);
  }

  await browser.close();
  console.log('DONE');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
