const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT = path.join('C:/Users/nadire/Desktop/nadire-portfolio/assets/bitirme');
const BASE = process.env.APP_URL || 'http://127.0.0.1:8081';

async function shot(page, name) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: false });
  console.log('saved', name, fs.statSync(file).size);
}

async function clickText(page, texts) {
  for (const t of texts) {
    const loc = page.getByText(t, { exact: false }).first();
    if (await loc.count()) {
      try {
        await loc.click({ timeout: 3000 });
        await page.waitForTimeout(1200);
        return t;
      } catch {}
    }
  }
  return null;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  console.log('goto', BASE);
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2500);
  await shot(page, '_debug-start.png');

  // try email login fields
  const email = page.locator('input').first();
  if (await email.count()) {
    const inputs = page.locator('input');
    const n = await inputs.count();
    console.log('inputs', n);
    if (n >= 2) {
      await inputs.nth(0).fill('nadire@test.com');
      await inputs.nth(1).fill('Test1234!');
      await clickText(page, ['Giriş', 'Sign In', 'Login', 'Giriş Yap']);
      await page.waitForTimeout(3000);
      await shot(page, '_debug-after-login.png');
    }
  }

  // Bottom tabs - React Native Web often exposes accessibility labels / text
  const tabOrder = [
    ['Ana Sayfa', 'Home'],
    ['Öğren', 'Learn', 'Ders'],
    ['Quiz'],
    ['Chead', 'Chat'],
    ['Kod', 'Code'],
    ['Profil', 'Profile'],
  ];

  for (const labels of tabOrder) {
    const hit = await clickText(page, labels);
    console.log('tab', labels[0], '->', hit);
    await page.waitForTimeout(800);
    await shot(page, `_debug-tab-${labels[0].replace(/\s/g, '')}.png`);
  }

  // Quiz: open first quiz item
  await clickText(page, ['Quiz']);
  await page.waitForTimeout(1000);
  await shot(page, '04-quiz-secim.png');
  const opened = await clickText(page, [
    'Temel Değişkenler',
    'Kontrol Akışı',
    'Döngüler',
    'Kolay',
    'Başla',
    'Start',
  ]);
  console.log('opened quiz', opened);
  await page.waitForTimeout(2000);
  await shot(page, '05-quiz.png');

  // try answer and next
  await clickText(page, ['int', 'Gönder', 'Devam', 'Sonraki', 'Next', '0', 'true']);
  await page.waitForTimeout(1500);
  await shot(page, '05b-quiz-2.png');

  // Lessons
  await clickText(page, ['Öğren', 'Learn']);
  await page.waitForTimeout(1200);
  await shot(page, '02-dersler.png');
  await clickText(page, ['İlk C++', 'Temel Veri', 'Hello', 'Ders']);
  await page.waitForTimeout(1500);
  await shot(page, '03-ders-icerik.png');

  // Chat - multi turn if possible
  await clickText(page, ['Chead', 'Chat']);
  await page.waitForTimeout(1500);
  await shot(page, '07-ai-chat.png');

  const chatInput = page.locator('textarea, input[placeholder*="Mesaj"], input[placeholder*="mesaj"], [contenteditable="true"]').first();
  const questions = [
    'C++ pointer nedir kısaca?',
    'for döngüsü örneği ver',
    'basit hesap makinesi kodu yaz',
  ];
  if (await chatInput.count()) {
    for (let i = 0; i < questions.length; i++) {
      await chatInput.click();
      await chatInput.fill(questions[i]);
      await page.keyboard.press('Enter');
      // also try send button
      await clickText(page, ['Gönder']);
      const sendBtn = page.locator('[aria-label*="send" i], button').last();
      try { await sendBtn.click({ timeout: 1000 }); } catch {}
      console.log('sent', questions[i]);
      // wait for response up to 45s
      await page.waitForTimeout(20000);
      await shot(page, i === 0 ? '07-ai-chat.png' : `07b-ai-chat-scroll.png`);
    }
    // scroll up to show history
    await page.mouse.wheel(0, -800);
    await page.waitForTimeout(500);
    await shot(page, '07b-ai-chat-scroll.png');
  } else {
    console.log('NO chat input found');
  }

  await clickText(page, ['Profil', 'Profile']);
  await page.waitForTimeout(800);
  await shot(page, '06-profil.png');

  await browser.close();
  console.log('DONE');
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
