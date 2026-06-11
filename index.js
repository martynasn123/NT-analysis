// =============================================================
//  PALEIDIKLIS — sujungia visą grandinę:
//  šaltinis → filtras → vertinimas → atmintis → pranešimas
//
//  Trys režimai (parenkami automatiškai):
//   • PORT nustatytas (Railway web servisas) → paleidžia STATUS serverį
//     + sukasi fone kas RUN_EVERY_MINUTES (numatyta 30). Railway patenkintas.
//   • RUN_EVERY_MINUTES>0, be PORT → tik loop'as (lokaliai ilgam).
//   • Nei vieno → vienkartinis (cron taikinys): padaro darbą ir užsidaro.
// =============================================================

const http = require('http');
const cfg = require('./config');
const { fetchListings } = require('./source');
const { scoreListing } = require('./scorer');
const rc = require('./rc');
const store = require('./store');
const { notify } = require('./notify');

// Paskutinio paleidimo būsena (status puslapiui)
const state = { startedAt: new Date(), lastRun: null, lastError: null, top: [], alerted: 0, runs: 0 };

function passesHardFilters(l) {
  const s = cfg.search;
  if (l.area < s.minArea || l.area > s.maxArea) return false;
  if (l.price > s.maxPrice) return false;
  if (s.excludeNewBuildings) {
    if (l.isNewProject) return false; // aruodas „Naujas projektas" žyma
    if (l.year && l.year >= s.newBuildingYearFrom) return false;
  }
  return true;
}

async function run() {
  console.log(`\n=== Paleidimas ${new Date().toISOString()} (SOURCE=${process.env.SOURCE || 'demo'}) ===`);
  state.runs++;

  let raw;
  try {
    raw = await fetchListings();
  } catch (err) {
    console.error('Klaida traukiant duomenis:', err.message);
    state.lastError = err.message;
    state.lastRun = new Date();
    return;
  }
  console.log(`Gauta skelbimų: ${raw.length}`);

  const candidates = raw.filter(passesHardFilters);
  console.log(`Praėjo bazinius filtrus: ${candidates.length}`);

  const scored = candidates
    .map((l) => rc.enrich(l))
    .map(scoreListing)
    .sort((a, b) => b.score - a.score);

  const toAlert = [];
  for (const item of scored) {
    const { status, oldPrice } = store.upsert(item);
    if (item.score < cfg.minScoreToAlert) continue;

    if (status === 'new' && !store.wasAlerted(item.id)) {
      toAlert.push(item);
      store.markAlerted(item.id);
    } else if (status === 'price_changed' && oldPrice > item.price) {
      toAlert.push({ ...item, priceDrop: { from: oldPrice, to: item.price } });
      store.markAlerted(item.id);
    }
  }

  console.log(`Verti pranešimo (>=${cfg.minScoreToAlert}): ${toAlert.length}`);
  if (toAlert.length) await notify(toAlert);

  console.log('\n--- TOP šios sesijos ---');
  for (const r of scored.slice(0, 10)) {
    console.log(`[${r.score}] ${r.title} — ${r.breakdown.priceDiscount.detail}`);
  }

  state.lastRun = new Date();
  state.lastError = null;
  state.alerted = toAlert.length;
  state.top = scored.slice(0, 15);
}

// --- STATUS puslapis ---
function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function statusHtml() {
  const rows = state.top.map((r) => `
    <tr>
      <td class="score">${r.score}</td>
      <td><a href="${esc(r.url)}" target="_blank">${esc(r.title)}</a></td>
      <td>${r.price ? r.price.toLocaleString('lt-LT') + ' €' : '?'}</td>
      <td>${esc(r.district || '')}</td>
      <td class="muted">${esc(r.breakdown.priceDiscount.detail)}</td>
    </tr>`).join('');

  return `<!doctype html><html lang="lt"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Aruodas Scout</title>
  <style>
    body{font:15px/1.5 -apple-system,system-ui,sans-serif;background:#0e1116;color:#e6e6e6;margin:0;padding:32px}
    h1{font-size:20px;margin:0 0 4px}
    .sub{color:#8a93a0;font-size:13px;margin-bottom:24px}
    table{border-collapse:collapse;width:100%;max-width:900px}
    th,td{text-align:left;padding:8px 12px;border-bottom:1px solid #232a35;vertical-align:top}
    th{color:#8a93a0;font-weight:500;font-size:12px;text-transform:uppercase;letter-spacing:.04em}
    a{color:#7db5ff;text-decoration:none}a:hover{text-decoration:underline}
    .score{font-weight:700;color:#5ad17a}
    .muted{color:#8a93a0;font-size:13px}
    .err{color:#ff7b7b}
  </style></head><body>
  <h1>Aruodas Scout</h1>
  <div class="sub">
    Paleista: ${esc(state.startedAt.toISOString())} ·
    Paskutinis tikrinimas: ${state.lastRun ? esc(state.lastRun.toISOString()) : '—'} ·
    Tikrinimų: ${state.runs} ·
    Šaltinis: ${esc(process.env.SOURCE || 'demo')}
    ${state.lastError ? `· <span class="err">Klaida: ${esc(state.lastError)}</span>` : ''}
  </div>
  <table>
    <thead><tr><th>Balas</th><th>Objektas</th><th>Kaina</th><th>Rajonas</th><th>Kaina vs atskaita</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="5" class="muted">Dar nėra rezultatų — palauk pirmo tikrinimo.</td></tr>'}</tbody>
  </table>
  </body></html>`;
}

// --- Režimo parinkimas ---
const PORT = process.env.PORT;
const everyMin = Number(process.env.RUN_EVERY_MINUTES || (PORT ? 30 : 0));

if (PORT) {
  // Web servisas: status serveris + fono loop'as
  http.createServer((req, res) => {
    if (req.url === '/health') { res.writeHead(200); return res.end('ok'); }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(statusHtml());
  }).listen(PORT, () => console.log(`Status serveris klauso porte ${PORT}`));

  run();
  setInterval(run, everyMin * 60 * 1000);
  console.log(`Fono tikrinimas kas ${everyMin} min.`);
} else if (everyMin > 0) {
  console.log(`LOOP režimas: kartoju kas ${everyMin} min.`);
  run();
  setInterval(run, everyMin * 60 * 1000);
} else {
  run().then(() => process.exit(0));
}
