const { MongoClient } = require('C:/codelearn/nestjs/node_modules/mongodb');
(async () => {
  const c = new MongoClient(
    'mongodb://root:rootpassword@127.0.0.1:27017/?authSource=admin'
  );
  await c.connect();
  const db = c.db('codelearn_ai');
  const map = {
    welcome: ['common', 'welcome'],
    first_quiz: ['common', 'learning'],
    quiz_master_10: ['rare', 'learning'],
    perfectionist: ['epic', 'perfection'],
    xp_novice: ['common', 'xp'],
    xp_expert: ['rare', 'xp'],
    early_bird: ['uncommon', 'special'],
    perfect_streak_5: ['legendary', 'perfection'],
  };
  for (const [id, [rarity, category]] of Object.entries(map)) {
    const r = await db
      .collection('badges')
      .updateOne({ id }, { $set: { rarity, category, nameEn: id } });
    console.log(id, r.modifiedCount);
  }
  await c.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
