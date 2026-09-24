/**
 * Seed badges + recapture filled TR screens: quiz selection, stats, forum.
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('C:/Users/nadire/Desktop/nadire-portfolio/node_modules/playwright');
const { MongoClient } = require('C:/codelearn/nestjs/node_modules/mongodb');

const OUT = path.join('C:/Users/nadire/Desktop/nadire-portfolio/assets/bitirme');
const DOCS = path.join('C:/Users/nadire/Desktop/CodeLearn/docs/screenshots');
const BASE = 'http://127.0.0.1:8081';
const API = 'http://127.0.0.1:3000';
const MONGO =
  'mongodb://root:rootpassword@127.0.0.1:27017/?authSource=admin';
const USER_ID = 'e6fda1bc-4c06-420b-82e7-53521e890f08';

async function api(method, url, token, body) {
  const r = await fetch(API + url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  if (!r.ok) throw new Error(`${method} ${url} => ${r.status} ${text.slice(0, 200)}`);
  return data;
}

async function seedBadges() {
  const client = new MongoClient(MONGO);
  await client.connect();
  const db = client.db('codelearn_ai');
  const badges = [
    {
      id: 'welcome',
      name: 'Hoş Geldin!',
      description: 'Platforma başarıyla kayıt oldun!',
      icon: 'hand-left',
      color: '#00D4FF',
      type: 'first_quiz',
      xpRequired: 0,
      rarity: 'common',
    },
    {
      id: 'first_quiz',
      name: 'İlk Adım',
      description: 'İlk quizini başarıyla tamamladın!',
      icon: 'school',
      color: '#34D399',
      type: 'quiz_count',
      xpRequired: 25,
      rarity: 'common',
    },
    {
      id: 'quiz_master_10',
      name: 'Quiz Ustası',
      description: '10 quiz tamamladın!',
      icon: 'trophy',
      color: '#FFD700',
      type: 'quiz_count',
      xpRequired: 100,
      rarity: 'rare',
    },
    {
      id: 'perfectionist',
      name: 'Mükemmeliyetçi',
      description: 'Bir quizde %100 skor aldın!',
      icon: 'diamond',
      color: '#8B5CF6',
      type: 'perfect_score',
      xpRequired: 50,
      rarity: 'epic',
    },
    {
      id: 'xp_novice',
      name: 'Acemi',
      description: '100 XP kazandın!',
      icon: 'star',
      color: '#34D399',
      type: 'xp',
      xpRequired: 100,
      rarity: 'common',
    },
    {
      id: 'xp_expert',
      name: 'Uzman',
      description: '420+ XP ile ilerliyorsun!',
      icon: 'flash',
      color: '#FFD700',
      type: 'xp',
      xpRequired: 400,
      rarity: 'rare',
    },
    {
      id: 'early_bird',
      name: 'Erken Kuş',
      description: 'Sabah quiz çözdün!',
      icon: 'sunny',
      color: '#F59E0B',
      type: 'streak',
      xpRequired: 30,
      rarity: 'uncommon',
    },
  ];

  const col = db.collection('badges');
  const ids = [];
  for (const b of badges) {
    await col.updateOne(
      { id: b.id },
      { $set: { ...b, isUnlocked: true, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );
    const doc = await col.findOne({ id: b.id });
    ids.push(doc._id);
    console.log('badge', b.id, doc._id.toString());
  }

  const ub = db.collection('userbadges');
  // collection name may be userbadges or user_badges
  const names = (await db.listCollections().toArray()).map((c) => c.name);
  const ubName = names.find((n) => /user.?badge/i.test(n)) || 'userbadges';
  console.log('userbadge col', ubName);
  const ubCol = db.collection(ubName);
  await ubCol.deleteMany({ userId: USER_ID });
  for (const badgeId of ids) {
    await ubCol.insertOne({
      userId: USER_ID,
      badgeId,
      unlockedAt: new Date(),
      isNew: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  console.log('awarded', ids.length);
  await client.close();
}

async function shot(page, name) {
  for (const dir of [OUT, DOCS]) {
    fs.mkdirSync(dir, { recursive: true });
    const f = path.join(dir, name);
    await page.screenshot({ path: f, fullPage: false });
    const size = fs.statSync(f).size;
    console.log('SHOT', name, size);
    if (size < 20000) throw new Error('blank-looking shot: ' + name + ' size=' + size);
  }
}

async function tab(page, labels) {
  for (const label of labels) {
    const loc = page.getByText(label, { exact: true });
    let n = await loc.count();
    if (!n) {
      const loose = page.getByText(label, { exact: false });
      n = await loose.count();
      if (!n) continue;
      await loose.nth(n - 1).click({ force: true });
      await page.waitForTimeout(1600);
      return label;
    }
    await loc.nth(n - 1).click({ force: true });
    await page.waitForTimeout(1600);
    return label;
  }
  throw new Error('tab not found ' + labels.join('/'));
}

async function waitText(page, re, ms = 12000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const t = await page.locator('body').innerText();
    if (re.test(t)) return t;
    await page.waitForTimeout(400);
  }
  return page.locator('body').innerText();
}

(async () => {
  await seedBadges();

  const tok = await api('POST', '/auth/login', null, {
    email: 'nadire.portfolyo@test.com',
    password: 'Test1234!',
  });
  const stats = await api('GET', '/quiz/stats/user', tok.accessToken);
  console.log('API_STATS', {
    c: stats.totalCompletedQuizzes,
    xp: stats.totalXP,
    avg: stats.averageScore,
    streak: stats.currentStreak,
    perfect: stats.totalPerfectQuizzes,
  });
  const badges = await api('GET', '/badges/user', tok.accessToken);
  console.log('API_BADGES', Array.isArray(badges) ? badges.length : badges);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 860 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

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
  await page.evaluate(() => localStorage.setItem('language', 'tr'));

  // ---- Home TR ----
  await tab(page, ['Ana Sayfa', 'Home']).catch(() => {});
  await page.waitForTimeout(2000);
  // If still English, try reload after language
  let body = await page.locator('body').innerText();
  if (/Welcome back|Random Questions|Your Stats/i.test(body) && !/Tekrar hoş|Rastgele|İstatistik/i.test(body)) {
    await page.evaluate(() => {
      localStorage.setItem('language', 'tr');
      location.reload();
    });
    await page.waitForTimeout(5000);
    await tab(page, ['Ana Sayfa', 'Home']).catch(() => {});
  }
  body = await waitText(page, /Ana Sayfa|Home|Chead|Forum|Quiz/i);
  console.log('HOME', body.slice(0, 180).replace(/\n/g, ' | '));
  await shot(page, '02-ana-ekran.png');

  // ---- Forum ----
  try {
    const forum = page.getByText(/Topluluk Forumu|Community Forum|Forum/i).first();
    await forum.click({ force: true });
    await page.waitForTimeout(2800);
    body = await waitText(page, /soru|question|pointer|döngü|Memory|Forum|Topluluk/i);
    console.log('FORUM', body.slice(0, 200).replace(/\n/g, ' | '));
    await shot(page, '16-forum-liste.png');
    const q = page.getByText(/pointer|string|döngü|Memory|for döngüsü|C dilinde/i).first();
    if (await q.count()) {
      await q.click({ force: true });
      await page.waitForTimeout(2200);
      await shot(page, '16b-forum-detay.png');
    }
  } catch (e) {
    console.log('forum fail', e.message);
  }

  // Fresh reload to clear nav stack, then quiz path
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(4500);
  await page.evaluate(() => localStorage.setItem('language', 'tr'));
  await tab(page, ['Ana Sayfa', 'Home']).catch(() => {});
  await page.waitForTimeout(1200);

  // ---- Quiz selection via home card OR tab ----
  try {
    await page.getByText(/Rastgele Sorular|Random Questions/i).first().click({ force: true });
    await page.waitForTimeout(2800);
  } catch (e) {
    console.log('rastgele click', e.message);
    await tab(page, ['Quiz', 'Quizler']).catch((e2) => console.log('quiz tab', e2.message));
    await page.waitForTimeout(2800);
  }
  body = await waitText(page, /Quiz Seçimi|Quiz Selection|Tamamlanan|Completed|Ortalama|Average/i);
  console.log('QUIZ', body.slice(0, 220).replace(/\n/g, ' | '));
  if (/bulunamadı|No quizzes/i.test(body)) {
    await page.getByText(/Tekrar Dene|Try Again/i).first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(2500);
    body = await page.locator('body').innerText();
  }
  // Must show non-zero completed
  if (!/[1-9]\d*/.test(body)) console.log('WARN quiz page may still be empty stats');
  await shot(page, '04-quiz-secim.png');

  // ---- Stats via header chart button ----
  let opened = false;
  // Click ionic stats-chart near header
  opened = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    const icon = all.find(
      (n) =>
        (n.getAttribute && n.getAttribute('name') === 'stats-chart') ||
        (typeof n.className === 'string' && n.className.includes('stats-chart'))
    );
    if (!icon) return false;
    const clickable = icon.closest('[tabindex]') || icon.closest('div') || icon.parentElement;
    if (clickable) {
      clickable.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return true;
    }
    return false;
  });
  console.log('stats icon click', opened);
  await page.waitForTimeout(1500);

  // Brute force click top-right of phone frame (centered ~390 wide at 1280)
  if (!/İstatistikler|Statistics|Genel İstatistik|Tamamlanan Quiz|Completed Quizzes/i.test(
    await page.locator('body').innerText()
  )) {
    for (const [x, y] of [
      [780, 48],
      [800, 55],
      [760, 50],
      [820, 48],
      [740, 55],
      [850, 60],
    ]) {
      await page.mouse.click(x, y);
      await page.waitForTimeout(900);
      const t = await page.locator('body').innerText();
      if (/İstatistikler|Statistics|Genel İstatistik|Tamamlanan Quiz/i.test(t)) {
        console.log('opened stats at', x, y);
        opened = true;
        break;
      }
    }
  }

  body = await waitText(page, /İstatistikler|Statistics|Genel İstatistik|Tamamlanan Quiz/i, 8000);
  console.log('STATS_PAGE', /İstatistik|Statistics|Tamamlanan Quiz/i.test(body), body.slice(0, 280).replace(/\n/g, ' | '));
  // Verify non-zero
  if (!/\b(12|420|95)/.test(body)) {
    console.log('WARN expected filled numbers not visible yet');
  }
  await shot(page, '10-istatistik.png');
  await page.mouse.wheel(0, 450);
  await page.waitForTimeout(700);
  await shot(page, '15-rozet-oyunlastirma.png');

  // ---- Open a quiz card ----
  await page.keyboard.press('Escape').catch(() => {});
  await page.goBack().catch(() => {});
  await page.waitForTimeout(800);
  try {
    await page.getByText(/Rastgele Sorular|Random Questions/i).first().click({ force: true });
    await page.waitForTimeout(2000);
  } catch (_) {
    await tab(page, ['Quiz', 'Quizler']).catch(() => {});
  }
  await page.waitForTimeout(1500);
  try {
    const card = page.getByText(/Temel Değişken|Değişken Tür|Variables/i).first();
    if (await card.count()) {
      await card.click({ force: true });
      await page.waitForTimeout(2500);
      await shot(page, '05-quiz.png');
    }
  } catch (e) {
    console.log('quiz open', e.message);
  }

  // ---- Badges tab ----
  await tab(page, ['Rozetler', 'Badges']).catch(() => {});
  await page.waitForTimeout(1800);
  await shot(page, '15b-rozetler-tab.png');

  await browser.close();
  console.log('DONE');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
