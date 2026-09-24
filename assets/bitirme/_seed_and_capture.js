/**
 * Seed badges + recapture quiz/stats/forum with filled data (TR, dark).
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('C:/Users/nadire/Desktop/nadire-portfolio/node_modules/playwright');
const { MongoClient, ObjectId } = require('C:/codelearn/nestjs/node_modules/mongodb');

const OUT = path.join('C:/Users/nadire/Desktop/nadire-portfolio/assets/bitirme');
const DOCS = path.join('C:/Users/nadire/Desktop/CodeLearn/docs/screenshots');
const BASE = 'http://localhost:8081';
const API = 'http://localhost:3000';
const MONGO = 'mongodb://root:rootpassword@127.0.0.1:27017/codelearn_ai?authSource=admin';

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
  if (!r.ok) throw new Error(`${method} ${url} => ${r.status} ${text.slice(0, 400)}`);
  return data;
}

function daysAgo(n) {
  const d = new Date();
  d.setHours(15, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

async function seedAll(tok) {
  const userId = tok.user.id;
  const client = new MongoClient(MONGO);
  await client.connect();
  const db = client.db('codelearn_ai');

  // --- badges (match both entity + modern fields; skip mongoose validation) ---
  const badgesCol = db.collection('badges');
  await badgesCol.deleteMany({});
  const badgeDefs = [
    { id: 'welcome', name: 'Hoş Geldin!', description: 'Platforma kayıt oldun', icon: 'hand-left', color: '#00D4FF', xpRequired: 0, type: 'first_quiz' },
    { id: 'first_quiz', name: 'İlk Adım', description: 'İlk quizini tamamladın', icon: 'school', color: '#34D399', xpRequired: 25, type: 'quiz_count' },
    { id: 'quiz_master_10', name: 'Quiz Ustası', description: '10 quiz tamamladın', icon: 'trophy', color: '#FFD700', xpRequired: 100, type: 'quiz_count' },
    { id: 'perfectionist', name: 'Mükemmeliyetçi', description: '%100 skor aldın', icon: 'diamond', color: '#8B5CF6', xpRequired: 50, type: 'perfect_score' },
    { id: 'xp_novice', name: 'XP Çaylak', description: '100 XP kazandın', icon: 'flash', color: '#F59E0B', xpRequired: 100, type: 'xp' },
    { id: 'xp_expert', name: 'XP Uzmanı', description: '400 XP kazandın', icon: 'star', color: '#EF4444', xpRequired: 400, type: 'xp' },
    { id: 'early_bird', name: 'Erken Kuş', description: 'Sabah quiz çözdün', icon: 'sunny', color: '#38BDF8', xpRequired: 30, type: 'streak' },
    { id: 'perfect_streak_5', name: 'Şampiyon', description: '5 mükemmel quiz', icon: 'flame', color: '#FF6B6B', xpRequired: 150, type: 'perfect_score' },
  ].map((b) => ({ ...b, isUnlocked: true, unlockedAt: new Date(), createdAt: new Date(), updatedAt: new Date() }));
  const badgeIns = await badgesCol.insertMany(badgeDefs);
  const badgeIds = Object.values(badgeIns.insertedIds);
  console.log('badges', badgeIds.length);

  const ubCol = db.collection('userbadges');
  await ubCol.deleteMany({ userId });
  await ubCol.insertMany(
    badgeIds.map((badgeId, i) => ({
      userId,
      badgeId,
      unlockedAt: daysAgo(i),
      isNew: i < 2,
      createdAt: daysAgo(i),
      updatedAt: daysAgo(i),
    }))
  );
  console.log('userbadges', badgeIds.length);

  // --- quiz progress (non-zero stats) ---
  const quizzes = await api('GET', '/quiz/all', tok.accessToken);
  const progress = db.collection('quiz_progress');
  await progress.deleteMany({ userId });
  const pick = quizzes.slice(0, 12);
  const docs = pick.map((q, i) => {
    const totalQ = (q.questions && q.questions.length) || 5;
    const totalScore = totalQ * 10;
    const isPerfect = i % 3 !== 2;
    const score = isPerfect ? totalScore : Math.round(totalScore * 0.88);
    const completedAt = daysAgo(Math.min(i, 6));
    return {
      userId,
      quizId: q.id,
      skillId: q.skillId || 'c-basics',
      subjectId: q.subjectId || 'c',
      isCompleted: true,
      score,
      totalScore,
      correctAnswers: isPerfect ? totalQ : totalQ - 1,
      totalQuestions: totalQ,
      timeSpent: 80 + i * 10,
      xpEarned: isPerfect ? 40 : 28,
      heartsUsed: isPerfect ? 0 : 1,
      streak: 4,
      answers: [],
      startedAt: new Date(completedAt.getTime() - 90000),
      completedAt,
      attempts: 1,
      isPerfect,
      newlyAwardedBadges: [],
      createdAt: completedAt,
      updatedAt: completedAt,
    };
  });
  // force streak days 0..6
  for (let i = 0; i < Math.min(7, docs.length); i++) {
    docs[i].completedAt = daysAgo(i);
    docs[i].startedAt = new Date(daysAgo(i).getTime() - 90000);
  }
  await progress.insertMany(docs);
  console.log('progress', docs.length);

  await client.close();

  // ensure forum has questions
  const forum = await api('GET', '/forum/questions?limit=10', null);
  if (!forum.total) {
    console.log('forum empty — unexpected');
  } else {
    console.log('forum', forum.total);
  }

  const stats = await api('GET', '/quiz/stats/user', tok.accessToken);
  const badges = await api('GET', '/badges/user', tok.accessToken);
  console.log('STATS', {
    c: stats.totalCompletedQuizzes,
    xp: stats.totalXP,
    avg: Math.round(stats.averageScore),
    streak: stats.currentStreak,
    perfect: stats.totalPerfectQuizzes,
  });
  console.log('BADGES_API', Array.isArray(badges) ? badges.length : badges);
  return stats;
}

async function shot(page, name) {
  for (const dir of [OUT, DOCS]) {
    fs.mkdirSync(dir, { recursive: true });
    const f = path.join(dir, name);
    await page.screenshot({ path: f, fullPage: false });
    console.log('SHOT', name, fs.statSync(f).size);
  }
}

async function clickLast(page, text) {
  const loc = page.getByText(text, { exact: false });
  const n = await loc.count();
  if (!n) throw new Error('missing: ' + text);
  await loc.nth(n - 1).click({ force: true, timeout: 12000 });
  await page.waitForTimeout(1600);
}

(async () => {
  const tok = await api('POST', '/auth/login', null, {
    email: 'nadire.portfolyo@test.com',
    password: 'Test1234!',
  });
  await seedAll(tok);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 860 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  page.on('response', async (res) => {
    const u = res.url();
    if (/\/quiz|\/badges|\/forum/.test(u) && res.status() >= 400) {
      console.log('HTTP', res.status(), u);
    }
    if (/\/quiz\/all|\/quiz-eng\/all|\/quiz\/stats|\/badges\/user|\/forum\/questions/.test(u)) {
      console.log('OK', res.status(), u.replace(API, ''));
    }
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

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(5000);

  // Force TR language via Profile if needed
  try {
    await clickLast(page, 'Profil');
    await page.waitForTimeout(800);
    const trBtn = page.getByText(/Türkçe|Turkish|TR/i);
    if (await trBtn.count()) {
      await trBtn.first().click({ force: true }).catch(() => {});
      await page.waitForTimeout(800);
    }
    // dark
    const body = await page.locator('body').innerText();
    if (/aydınlık/i.test(body)) {
      const sw = page.locator('[role="switch"]').first();
      if (await sw.count()) await sw.click({ force: true });
    }
  } catch (e) {
    console.log('profile skip', e.message);
  }

  await clickLast(page, 'Ana Sayfa').catch(() => clickLast(page, 'Home'));
  await page.waitForTimeout(2000);
  await shot(page, '02-ana-ekran.png');

  // Forum from home
  try {
    const forum = page.getByText(/Forum|Topluluk/i).first();
    await forum.click({ force: true });
    await page.waitForTimeout(2500);
    await shot(page, '16-forum-liste.png');
    const q = page.getByText(/pointer|string|döngü|Memory|malloc|break/i).first();
    if (await q.count()) {
      await q.click({ force: true });
      await page.waitForTimeout(2000);
      await shot(page, '16b-forum-detay.png');
      await page.goBack().catch(() => {});
      await page.waitForTimeout(800);
    }
  } catch (e) {
    console.log('forum fail', e.message);
  }

  await clickLast(page, 'Ana Sayfa').catch(() => clickLast(page, 'Home'));
  await page.waitForTimeout(1000);

  // Quiz selection with stats header
  await clickLast(page, 'Quiz');
  await page.waitForTimeout(3000);
  // wait for content
  for (let i = 0; i < 8; i++) {
    const t = await page.locator('body').innerText();
    if (/Kolay|Easy|Tamamlanan|Completed|Temel|Değişken|Quiz Seçimi/i.test(t) && !/No quizzes found|Quiz bulunamadı/i.test(t)) break;
    if (/Try Again|Tekrar Dene/i.test(t)) {
      await page.getByText(/Try Again|Tekrar Dene/i).first().click({ force: true }).catch(() => {});
    }
    await page.waitForTimeout(1200);
  }
  console.log('quiz_body_snip', (await page.locator('body').innerText()).slice(0, 200).replace(/\n/g, ' | '));
  await shot(page, '04-quiz-secim.png');

  // Open stats via chart button (top right of quiz header)
  try {
    await page.evaluate(() => {
      const icons = Array.from(document.querySelectorAll('div,button,span'));
      // click near top-right of orange header
    });
    // click coords for stats icon in 1280 viewport (phone centered?)
    // Try text-free: find elements with stats-chart in HTML
    const clicked = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const el = all.find((n) => {
        const name = n.getAttribute && n.getAttribute('name');
        return name === 'stats-chart' || (n.className && String(n.className).includes('stats-chart'));
      });
      if (el) {
        (el.closest('[tabindex]') || el.closest('div') || el).dispatchEvent(
          new MouseEvent('click', { bubbles: true })
        );
        return true;
      }
      return false;
    });
    console.log('stats icon click', clicked);
    if (!clicked) {
      // click absolute near header right inside content area — try multiple spots
      for (const [x, y] of [
        [980, 70],
        [900, 80],
        [1050, 60],
        [640, 70],
        [700, 90],
      ]) {
        await page.mouse.click(x, y);
        await page.waitForTimeout(900);
        const t = await page.locator('body').innerText();
        if (/İstatistikler|Statistics|Tamamlanan Quiz|Completed Quizzes/i.test(t)) {
          console.log('stats via click', x, y);
          break;
        }
      }
    }
    await page.waitForTimeout(2000);
  } catch (e) {
    console.log('stats nav', e.message);
  }

  let body = await page.locator('body').innerText();
  if (!/İstatistikler|Tamamlanan Quiz|Completed Quizzes|Ortalama Skor|Average Score/i.test(body)) {
    // Fallback: Home -> Tümünü Gör
    await clickLast(page, 'Ana Sayfa').catch(() => clickLast(page, 'Home'));
    await page.waitForTimeout(1000);
    const all = page.getByText(/Tümünü Gör|View All/i);
    if (await all.count()) {
      await all.first().click({ force: true });
      await page.waitForTimeout(2000);
    }
  }
  body = await page.locator('body').innerText();
  console.log('stats_snip', body.slice(0, 280).replace(/\n/g, ' | '));
  await shot(page, '10-istatistik.png');
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(800);
  await shot(page, '15-rozet-oyunlastirma.png');

  // Quiz play
  await page.goBack().catch(() => {});
  await clickLast(page, 'Quiz').catch(() => {});
  await page.waitForTimeout(1500);
  try {
    const card = page.getByText(/Temel|Değişken|Giriş|Pointer|Kolay/i).first();
    await card.click({ force: true });
    await page.waitForTimeout(2500);
    await shot(page, '05-quiz.png');
  } catch (e) {
    console.log('quiz open', e.message);
  }

  await browser.close();
  console.log('DONE');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
