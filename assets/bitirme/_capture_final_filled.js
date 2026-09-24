/**
 * Final filled captures: stats (non-zero), quiz selection (filled), forum (counts), badges.
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('C:/Users/nadire/Desktop/nadire-portfolio/node_modules/playwright');
const { Client } = require('C:/codelearn/nestjs/node_modules/pg');

const OUT = path.join('C:/Users/nadire/Desktop/nadire-portfolio/assets/bitirme');
const DOCS = path.join('C:/Users/nadire/Desktop/CodeLearn/docs/screenshots');
const BASE = 'http://localhost:8081';
const API = 'http://localhost:3000';

async function api(method, url, token, body) {
  const r = await fetch(API + url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(data));
  return data;
}

async function bumpForumCounts() {
  for (const port of [5435, 5432]) {
    const client = new Client({
      host: '127.0.0.1',
      port,
      user: 'nestjs_user',
      password: 'nestjs_password',
      database: 'nestjs_db',
    });
    try {
      await client.connect();
      const tables = await client.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name ILIKE '%question%'`
      );
      console.log('pg', port, 'tables', tables.rows.map((r) => r.table_name).join(','));
      for (const t of tables.rows.map((r) => r.table_name)) {
        const cols = await client.query(
          `SELECT column_name FROM information_schema.columns WHERE table_name=$1`,
          [t]
        );
        const names = cols.rows.map((r) => r.column_name);
        const sets = [];
        if (names.includes('viewCount') || names.includes('view_count')) {
          const c = names.includes('viewCount') ? '"viewCount"' : 'view_count';
          sets.push(`${c} = GREATEST(${c}, 12 + (random()*40)::int)`);
        }
        if (names.includes('answerCount') || names.includes('answer_count')) {
          const c = names.includes('answerCount') ? '"answerCount"' : 'answer_count';
          sets.push(`${c} = GREATEST(${c}, 1 + (random()*4)::int)`);
        }
        if (names.includes('voteCount') || names.includes('vote_count')) {
          const c = names.includes('voteCount') ? '"voteCount"' : 'vote_count';
          sets.push(`${c} = GREATEST(${c}, 3 + (random()*15)::int)`);
        }
        if (sets.length) {
          const r = await client.query(`UPDATE "${t}" SET ${sets.join(', ')}`);
          console.log('updated', t, 'rows', r.rowCount);
        }
      }
      await client.end();
      return;
    } catch (e) {
      console.log('pg', port, e.message);
      try {
        await client.end();
      } catch (_) {}
    }
  }
}

async function shot(page, name) {
  for (const dir of [OUT, DOCS]) {
    fs.mkdirSync(dir, { recursive: true });
    const f = path.join(dir, name);
    await page.screenshot({ path: f, fullPage: false });
    console.log('SHOT', name, fs.statSync(f).size);
  }
}

async function tab(page, labels) {
  for (const label of labels) {
    const loc = page.getByText(label, { exact: true });
    let n = await loc.count();
    if (!n) {
      const loc2 = page.getByText(label, { exact: false });
      n = await loc2.count();
      if (!n) continue;
      await loc2.nth(n - 1).click({ force: true });
      await page.waitForTimeout(1800);
      return label;
    }
    await loc.nth(n - 1).click({ force: true });
    await page.waitForTimeout(1800);
    return label;
  }
  throw new Error('no tab ' + labels.join('/'));
}

(async () => {
  await bumpForumCounts();

  const tok = await api('POST', '/auth/login', null, {
    email: 'nadire.portfolyo@test.com',
    password: 'Test1234!',
  });
  console.log('stats', await api('GET', '/quiz/stats/user', tok.accessToken).then((s) => ({
    c: s.totalCompletedQuizzes,
    xp: s.totalXP,
    avg: Math.round(s.averageScore),
    streak: s.currentStreak,
  })));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 860 },
  });
  const page = await context.newPage();

  page.on('console', (msg) => {
    const t = msg.text();
    if (/quiz|Quiz|API|Error|bulun/i.test(t)) console.log('CONSOLE', t.slice(0, 180));
  });

  await page.addInitScript((t) => {
    const keys = {
      accessToken: t.accessToken,
      refreshToken: t.refreshToken,
      user: JSON.stringify(t.user),
      ['onboarding_' + t.user.id]: 'true',
      colorScheme: 'dark',
      theme: 'dark',
      language: 'tr',
    };
    Object.entries(keys).forEach(([k, v]) => localStorage.setItem(k, v));
  }, tok);

  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 120000 }).catch(() =>
    page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 })
  );
  await page.waitForTimeout(4000);

  // Force language TR in running app
  await page.evaluate(() => {
    localStorage.setItem('language', 'tr');
  });

  await tab(page, ['Ana Sayfa', 'Home']);
  await page.waitForTimeout(1500);
  await shot(page, '02-ana-ekran.png');

  // Stats via top-right blue chart icon OR "Rastgele" path
  // Click the first circular header button (stats)
  try {
    await page.evaluate(() => {
      // Find buttons near welcome header
      const buttons = Array.from(document.querySelectorAll('div[tabindex="0"],button,[role="button"]'));
      // Prefer ionicon pulse/stats
      const icon = Array.from(document.querySelectorAll('*')).find(
        (n) =>
          n.getAttribute &&
          ['stats-chart', 'analytics', 'pulse'].includes(n.getAttribute('name') || '')
      );
      if (icon) {
        (icon.closest('[tabindex]') || icon.parentElement || icon).click();
        return;
      }
    });
    await page.waitForTimeout(500);
    // coordinate click for blue stats button (top-right of phone frame)
    // App is centered on 1280 canvas - phone ~390 wide. Try several.
    for (const [x, y] of [
      [780, 48],
      [760, 55],
      [800, 50],
      [720, 50],
      [850, 55],
    ]) {
      await page.mouse.click(x, y);
      await page.waitForTimeout(900);
      const t = await page.locator('body').innerText();
      if (/İstatistikler|Statistics|Tamamlanan Quiz|Completed Quizzes|Genel İstatistik/i.test(t)) {
        console.log('opened stats at', x, y);
        break;
      }
    }
  } catch (e) {
    console.log('stats icon', e.message);
  }

  let body = await page.locator('body').innerText();
  if (!/İstatistikler|Tamamlanan Quiz|Genel İstatistik|Completed Quizzes/i.test(body)) {
    // Fallback Rozetler tab might show badges; also try View All
    const va = page.getByText(/Tümünü Gör|View All/i);
    if (await va.count()) {
      await va.first().click({ force: true });
      await page.waitForTimeout(2000);
    }
  }
  body = await page.locator('body').innerText();
  console.log('STAT_PAGE', /İstatistik|Tamamlanan|Completed Quizzes/i.test(body), body.slice(0, 250).replace(/\n/g, ' | '));
  await shot(page, '10-istatistik.png');
  await page.mouse.wheel(0, 420);
  await page.waitForTimeout(600);
  await shot(page, '15-rozet-oyunlastirma.png');

  // Back home
  await page.keyboard.press('Escape').catch(() => {});
  await page.goBack().catch(() => {});
  await page.waitForTimeout(800);
  await tab(page, ['Ana Sayfa', 'Home']).catch(() => {});

  // Quiz via home card "Rastgele Sorular" then also Quiz tab
  try {
    await page.getByText(/Rastgele Sorular/i).first().click({ force: true });
    await page.waitForTimeout(3000);
  } catch (_) {
    await tab(page, ['Quiz']);
    await page.waitForTimeout(3000);
  }

  // Probe quiz API from page
  const probe = await page.evaluate(async () => {
    const token = localStorage.getItem('accessToken');
    const r = await fetch('http://localhost:3000/quiz/all', {
      headers: { Authorization: 'Bearer ' + token },
    });
    const j = await r.json();
    return { status: r.status, n: Array.isArray(j) ? j.length : Object.keys(j), lang: localStorage.getItem('language') };
  });
  console.log('probe', probe);

  body = await page.locator('body').innerText();
  console.log('QUIZ_PAGE', body.slice(0, 220).replace(/\n/g, ' | '));

  // If empty, click Try Again
  if (/bulunamadı|No quizzes/i.test(body)) {
    await page.getByText(/Tekrar Dene|Try Again/i).first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(2500);
    body = await page.locator('body').innerText();
    console.log('QUIZ_RETRY', body.slice(0, 220).replace(/\n/g, ' | '));
  }
  await shot(page, '04-quiz-secim.png');

  // Open first quiz if list visible
  if (/Kolay|Temel|Tamamlanan|Ortalama/i.test(body)) {
    const card = page.getByText(/Temel Değişken|Değişken Tür|Temel/i).first();
    if (await card.count()) {
      await card.click({ force: true });
      await page.waitForTimeout(2500);
      await shot(page, '05-quiz.png');
    }
  }

  // Forum
  await tab(page, ['Ana Sayfa', 'Home']).catch(() => {});
  await page.waitForTimeout(800);
  await page.getByText(/Topluluk Forumu|Forum/i).first().click({ force: true });
  await page.waitForTimeout(2500);
  await shot(page, '16-forum-liste.png');
  try {
    await page.getByText(/Memory leak|pointer|döngü|string/i).first().click({ force: true });
    await page.waitForTimeout(2000);
    await shot(page, '16b-forum-detay.png');
  } catch (_) {}

  // Rozetler tab
  await tab(page, ['Rozetler', 'Badges']).catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, '15b-rozetler-tab.png');

  await browser.close();
  console.log('DONE');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
