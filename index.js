// =============================================================
//  PALEIDIKLIS — sujungia visą grandinę:
//  šaltinis → filtras → vertinimas → atmintis → pranešimas
//
//  Paleidimas:
//    SOURCE=demo node src/index.js      (saugu, pavyzdiniai duomenys)
//    SOURCE=live node src/index.js      (realus aruodas scraping)
//
//  „Nuolat" — Railway / serverio cron'u, pvz. kas 30 min.
// =============================================================

const cfg = require('./config');
const { fetchListings } = require('./source');
const { scoreListing } = require('./scorer');
const rc = require('./rc');
const store = require('./store');
const { notify } = require('./notify');

function passesHardFilters(l) {
  const s = cfg.search;
  if (l.area < s.minArea || l.area > s.maxArea) return false;
  if (l.price > s.maxPrice) return false;
  if (s.excludeNewBuildings && l.year && l.year >= 2015) return false;
  return true;
}

async function run() {
  console.log(`\n=== Paleidimas ${new Date().toISOString()} (SOURCE=${process.env.SOURCE || 'demo'}) ===`);

  let raw;
  try {
    raw = await fetchListings();
  } catch (err) {
    console.error('Klaida traukiant duomenis:', err.message);
    return;
  }
  console.log(`Gauta skelbimų: ${raw.length}`);

  const candidates = raw.filter(passesHardFilters);
  console.log(`Praėjo bazinius filtrus: ${candidates.length}`);

  const scored = candidates
    .map((l) => rc.enrich(l))   // pridedam RC vertę, jei žinoma
    .map(scoreListing)
    .sort((a, b) => b.score - a.score);

  const toAlert = [];
  for (const item of scored) {
    const status = store.upsert(item);
    const worthy = item.score >= cfg.minScoreToAlert;
    const fresh = status === 'new' || status === 'price_changed';
    if (worthy && fresh && !store.wasAlerted(item.id)) {
      toAlert.push(item);
      store.markAlerted(item.id);
    }
  }

  console.log(`Verti pranešimo (>=${cfg.minScoreToAlert}, nauji): ${toAlert.length}`);

  if (toAlert.length) {
    await notify(toAlert);
  }

  // Visada parodyk dabartinį top sąrašą terminale
  console.log('\n--- TOP šios sesijos ---');
  for (const r of scored.slice(0, 10)) {
    console.log(`[${r.score}] ${r.title} — ${r.breakdown.priceDiscount.detail}`);
  }
}

run().then(() => process.exit(0));
