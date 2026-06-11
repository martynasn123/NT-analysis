// =============================================================
//  VERTINIMO VARIKLIS ("smegenys")
//  Duomenų šaltiniui nepriklauso. Paduodi normalizuotą objektą —
//  gauni 0–100 balą su pilnu išskaidymu (kodėl tiek).
//
//  Normalizuoto objekto forma:
//  {
//    id, url, title,
//    price,        // €
//    area,         // m²
//    rooms, floor, totalFloors, year,
//    district,     // pvz. "Antakalnis"
//    description,  // visas tekstas mažosiomis (būklės atpažinimui)
//  }
// =============================================================

const cfg = require('./config');

// Pagalbinė: ar tekste yra bent vienas iš raktažodžių.
// Dedupe: jei pataikė ir „tvarkytina", ir „tvarkytinas" (tas pats žodis),
// paliekam tik ilgesnįjį — kitaip vienas žodis dirbtinai pučia balą.
function matchAny(text, list) {
  if (!text) return [];
  const hits = [];
  for (const kw of list) {
    if (text.includes(kw)) hits.push(kw);
  }
  return hits.filter(
    (kw) => !hits.some((other) => other !== kw && other.includes(kw))
  );
}

// 0..1 -> apriboti
const clamp01 = (x) => Math.max(0, Math.min(1, x));

// -------------------------------------------------------------
// 1) KAINOS NUOLAIDA (svarbiausia)
//
//   Atskaitos taškų hierarchija:
//   A) RC vidutinė rinkos vertė konkrečiam objektui  ← geriausia
//      (listing.rcMarketValue, € — gauni iš registrucentras.lt/masvert)
//   B) rajono €/m² vidurkis                          ← atsarginis, apytikslis
//
//   SVARBU dėl RC vertės: RC masinio vertinimo vertė yra konservatyvi,
//   modeliu skaičiuota ir DAŽNAI ŽEMESNĖ nei reali rinkos/prašoma kaina.
//   Todėl „prašoma žemiau RC vertės" yra retas ir labai stiprus signalas.
//   Slenksčius (config.priceBaseline) kalibruosi pamatęs realius skaičius.
// -------------------------------------------------------------
function scorePriceDiscount(listing) {
  if (!listing.price || !listing.area) {
    return { value: 0, detail: 'Trūksta kainos arba ploto' };
  }
  const pb = cfg.priceBaseline;

  // --- A) RC vidutinė rinkos vertė (jei žinoma šiam objektui) ---
  if (pb.preferRcValue && listing.rcMarketValue) {
    const discount = (listing.rcMarketValue - listing.price) / listing.rcMarketValue;
    const value = clamp01(discount / pb.rcDiscountForMax);
    return {
      value,
      source: 'RC',
      discountPct: Math.round(discount * 100),
      detail: `prašoma ${listing.price.toLocaleString('lt-LT')} € vs RC vertė ${listing.rcMarketValue.toLocaleString('lt-LT')} € (${
        discount >= 0 ? '-' : '+'
      }${Math.abs(Math.round(discount * 100))}% nuo RC)`,
    };
  }

  // --- B) Atsarginis: rajono €/m² vidurkis ---
  const pricePerM2 = listing.price / listing.area;
  const baseline =
    cfg.districtBaselineEurM2[listing.district] || cfg.defaultBaselineEurM2;
  const discount = (baseline - pricePerM2) / baseline;
  const value = clamp01(discount / pb.districtDiscountForMax);

  return {
    value,
    source: 'rajono vidurkis (apytikslis)',
    pricePerM2: Math.round(pricePerM2),
    baseline,
    discountPct: Math.round(discount * 100),
    detail: `${Math.round(pricePerM2)} €/m² vs rajono ~${baseline} €/m² (${
      discount >= 0 ? '-' : '+'
    }${Math.abs(Math.round(discount * 100))}%) — RC vertė dar neįvesta`,
  };
}

// -------------------------------------------------------------
// 2) RENOVACIJOS POTENCIALAS = prasta būklė + geras „kaulas"
// -------------------------------------------------------------
function scoreRenovation(listing) {
  const text = (listing.description || '').toLowerCase();
  const needsWork = matchAny(text, cfg.keywords.needsWork);
  const goodBones = matchAny(text, cfg.keywords.goodBones);

  // Idealu: prasta apdaila (galima pridėti vertės) + tvirta struktūra
  const needsWorkScore = clamp01(needsWork.length / 2); // 2+ signalai = max
  const bonesScore = clamp01(goodBones.length / 2);

  // Sinergija: abu kartu vertingiau nei vienas. Pamatas 60% būklė, 40% kaulas,
  // + bonusas kai sutampa abu.
  let value = needsWorkScore * 0.6 + bonesScore * 0.4;
  if (needsWork.length && goodBones.length) value = clamp01(value + 0.15);

  return {
    value,
    needsWork,
    goodBones,
    detail:
      (needsWork.length ? `būklė: ${needsWork.join(', ')}` : 'būklė nenurodyta') +
      ' | ' +
      (goodBones.length ? `kaulas: ${goodBones.join(', ')}` : 'kaulas nenurodytas'),
  };
}

// -------------------------------------------------------------
// 3) LOKACIJA
// -------------------------------------------------------------
function scoreLocation(listing) {
  const w = cfg.preferredDistricts[listing.district];
  const value = w != null ? w : 0.3; // nežinomas/nepageidaujamas rajonas -> 0.3
  return {
    value,
    detail: `${listing.district || 'nežinomas rajonas'} (svoris ${value})`,
  };
}

// -------------------------------------------------------------
// 4) PAVELDAS / IŠSKIRTINUMAS
// -------------------------------------------------------------
function scoreHeritage(listing) {
  const text = (listing.description || '').toLowerCase();
  const hits = matchAny(text, cfg.keywords.heritage);
  const value = clamp01(hits.length / 2);
  return {
    value,
    hits,
    detail: hits.length ? hits.join(', ') : 'paveldo signalų nėra',
  };
}

// -------------------------------------------------------------
//  BENDRAS BALAS
// -------------------------------------------------------------
function scoreListing(listing) {
  const price = scorePriceDiscount(listing);
  const reno = scoreRenovation(listing);
  const loc = scoreLocation(listing);
  const heritage = scoreHeritage(listing);

  const w = cfg.weights;
  const total =
    price.value * w.priceDiscount +
    reno.value * w.renovation +
    loc.value * w.location +
    heritage.value * w.heritage;

  const score = Math.round(total * 100);

  return {
    ...listing,
    score,
    breakdown: {
      priceDiscount: { weight: w.priceDiscount, ...price },
      renovation: { weight: w.renovation, ...reno },
      location: { weight: w.location, ...loc },
      heritage: { weight: w.heritage, ...heritage },
    },
  };
}

module.exports = { scoreListing };
