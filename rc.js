// =============================================================
//  RC VERTĖS ŠALTINIS  (atskaitos taškas kainai)
// -------------------------------------------------------------
//  Kol kas — RANKINIS tiltas. Tu pats pasižiūri objekto vidutinę
//  rinkos vertę čia:
//      https://www.registrucentras.lt/masvert/paieska-obj
//  (unikalų numerį randi pagal adresą) ir įrašai į failą:
//      data/rc-values.json
//  formatu:  { "skelbimo-id": 175000, "kitas-id": 142000 }
//
//  Darbo eiga praktiškai:
//   1. Paleidi įrankį — jis parodo kandidatus (be RC vertės, per
//      rajono vidurkį).
//   2. Įdomiems objektams pasižiūri RC vertę, įrašai į rc-values.json.
//   3. Paleidi vėl — dabar kaina vertinama prieš tikrą RC vertę.
//
//  VĖLIAU: kai/jei atsiras automatinė prieiga (RC užklausa pagal
//  unikalų numerį), pakeisi tik resolve() vidų — sąsaja ta pati.
// =============================================================

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'rc-values.json');

function loadMap() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return {};
  }
}

// Grąžina RC vidutinę rinkos vertę (€) objektui arba null
function resolve(listing) {
  const map = loadMap();
  const v = map[listing.id];
  return typeof v === 'number' && v > 0 ? v : null;
}

// Patogumui: praturtina skelbimą rcMarketValue lauku (jei yra)
function enrich(listing) {
  const v = resolve(listing);
  return v ? { ...listing, rcMarketValue: v } : listing;
}

module.exports = { resolve, enrich };
