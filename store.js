// =============================================================
//  ATMINTIS (JSON failas, be priklausomybių)
//  Įsimena matytus skelbimus, kad pranešimas ateitų TIK apie naujus
//  arba pasikeitusios kainos objektus. Failas data/seen.json greta projekto.
//  (Šiam mastui pilnai pakanka; jei kada augs iki tūkstančių per dieną —
//   pakeisi į SQLite, sąsaja ta pati.)
// =============================================================

const fs = require('fs');
const path = require('path');

// Railway: prijungus Volume, nustatyk env DATA_DIR=/data — atmintis
// išliks tarp deploy'ų. Be jo — failas guli greta projekto (lokaliai ok).
const DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const FILE = path.join(DIR, 'seen.json');

if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return {};
  }
}
function save(db) {
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
}

let db = load();

// Grąžina: { status: 'new' | 'price_changed' | 'seen', oldPrice?: number }
function upsert(listing) {
  const now = new Date().toISOString();
  const existing = db[listing.id];

  if (!existing) {
    db[listing.id] = {
      url: listing.url, title: listing.title, price: listing.price,
      area: listing.area, district: listing.district, score: listing.score,
      first_seen: now, last_seen: now, alerted: false,
    };
    save(db);
    return { status: 'new' };
  }

  const oldPrice = existing.price;
  const priceChanged = oldPrice !== listing.price;
  existing.price = listing.price;
  existing.score = listing.score;
  existing.last_seen = now;
  save(db);
  return priceChanged
    ? { status: 'price_changed', oldPrice }
    : { status: 'seen' };
}

function markAlerted(id) {
  if (db[id]) { db[id].alerted = true; save(db); }
}
function wasAlerted(id) {
  return !!(db[id] && db[id].alerted);
}

module.exports = { upsert, markAlerted, wasAlerted };
