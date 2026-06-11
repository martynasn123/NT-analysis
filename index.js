// =============================================================
//  PALEIDIKLIS — sujungia visą grandinę:
//  šaltinis → filtras → vertinimas → atmintis → pranešimas
//
//  Paleidimas:
//    SOURCE=demo node index.js     (saugu, pavyzdiniai duomenys)
//    SOURCE=live node index.js     (realus aruodas scraping)
//
//  „Nuolat" — du būdai:
//   A) Railway Cron Schedule (pvz. */30 * * * *) — paleidžia ir užsidaro.
//   B) env RUN_EVERY_MINUTES=30 — procesas lieka gyvas ir pats kartoja.
//      Tinka, kai Railway leidi kaip įprastą servisą (be cron) —
//      nebebus „crashed" po kiekvieno paleidimo.
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
  if (s.excludeNewBuildings && l.year && l.year >= s.newBuildingYearFrom) {
    return false;
  }
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
    const { status, oldPrice } = store.upsert(item);
    const worthy = item.score >= cfg.minScoreToAlert;
    if (!worthy) continue;

    if (status === 'new' && !store.wasAlerted(item.id)) {
      // Naujas vertas objektas — pranešam vieną kartą
      toAlert.push(item);
      store.markAlerted(item.id);
    } else if (status === 'price_changed' && oldPrice > item.price) {
      // KAINA NUKRITO — pranešam VISADA, net jei jau buvo pranešta.
      // Kainos kritimas = motyvuotas pardavėjas, svarbiausias signalas.
      toAlert.push({ ...item, priceDrop: { from: oldPrice, to: item.price } });
      store.markAlerted(item.id);
    }
    // Kainos PAKILIMAS pranešimo negeneruoja — tai ne galimybė.
  }

  console.log(`Verti pranešimo (>=${cfg.minScoreToAlert}): ${toAlert.length}`);

  if (toAlert.length) {
    await notify(toAlert);
  }

  console.log('\n--- TOP šios sesijos ---');
  for (const r of scored.slice(0, 10)) {
    console.log(`[${r.score}] ${r.title} — ${r.breakdown.priceDiscount.detail}`);
  }
}

// --- Paleidimo režimai ---
const everyMin = Number(process.env.RUN_EVERY_MINUTES || 0);

if (everyMin > 0) {
  // LOOP režimas: procesas gyvas, kartoja pats (Railway be cron)
  console.log(`LOOP režimas: kartoju kas ${everyMin} min.`);
  run();
  setInterval(run, everyMin * 60 * 1000);
} else {
  // Vienkartinis režimas: padaro darbą ir užsidaro (cron taikinys)
  run().then(() => process.exit(0));
}
