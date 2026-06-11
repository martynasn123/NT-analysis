// =============================================================
//  DUOMENŲ SLUOKSNIS  ⚠️  KEIČIAMA / RIZIKINGA DALIS
// -------------------------------------------------------------
//  Čia gyvena VIENINTELIS dalykas, priklausantis nuo aruodas.lt.
//  Visa kita (scorer, store, index) veikia nepriklausomai.
//
//  SVARBU, sąžiningai:
//   • aruodas.lt neturi viešo „skaitymo" API.
//   • Šis scraping būdas prieštarauja jų naudojimo taisyklėms ir
//     gali bet kada nustoti veikti (jie keičia HTML / deda apsaugą).
//   • HTML selektoriai (žemiau) beveik garantuotai reikalaus
//     pataisymo — juos reikia patikrinti naršyklėje (DevTools).
//
//  ŠVARESNĖS ALTERNATYVOS (rekomenduoju realiam naudojimui):
//   A) aruodas išsaugotos paieškos + el. pašto pranešimai → tada šis
//      įrankis tik įvertina atėjusius skelbimus, nieko nescrapina.
//   B) komercinis LT NT duomenų API (mokamas, bet legalus ir stabilus).
//
//  Norint perjungti šaltinį — pakeisk tik fetchListings() grąžinimą.
//  Forma, kurią privalo grąžinti (masyvas):
//   { id, url, title, price, area, rooms, floor, totalFloors, year,
//     district, description }
// =============================================================

const cfg = require('./config');

// --- Demo režimas: grąžina pavyzdinius duomenis, kad galėtum
//     paleisti ir matyti pilną grandinę be jokio scraping. ---
function fetchDemoListings() {
  return [
    {
      id: 'demo-1', url: 'https://www.aruodas.lt/demo-1',
      title: 'Tarpukario butas, reikia remonto', price: 165000, area: 60,
      rooms: 3, floor: 2, totalFloors: 4, year: 1935, district: 'Naujamiestis',
      description: 'tarpukario mūrinis namas, aukštos lubos, reikia remonto, autentiškas parketas',
    },
    {
      id: 'demo-2', url: 'https://www.aruodas.lt/demo-2',
      title: 'Antakalnis, dalinė apdaila', price: 150000, area: 58,
      rooms: 2, floor: 3, totalFloors: 5, year: 1972, district: 'Antakalnis',
      description: 'plytinis namas, dalinė apdaila, tvarkytinas, geras planas',
    },
    {
      id: 'demo-3', url: 'https://www.aruodas.lt/demo-3',
      title: 'Renovuotas butas Pilaitėje', price: 230000, area: 65,
      rooms: 3, floor: 5, totalFloors: 9, year: 2015, district: 'Pilaitė',
      description: 'puiki būklė, šviežias remontas, įrengtas',
    },
  ];
}

// --- Realus scraping (CHEERIO). Selektorius BŪTINA patikrinti! ---
async function fetchLiveListings() {
  const cheerio = require('cheerio');
  const results = [];

  // aruodas paieškos URL formuojamas iš filtrų. Šį URL pasiimk iš
  // naršyklės adreso juostos atlikęs norimą paiešką ir įklijuok čia.
  const baseUrl =
    'https://www.aruodas.lt/butai/vilniuje/?FOrderBy=3'; // pvz: rūšiuoti pagal datą

  const res = await fetch(baseUrl, {
    headers: {
      // Realistiškas naršyklės antraštės rinkinys
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      'Accept-Language': 'lt-LT,lt;q=0.9',
    },
  });
  const html = await res.text();
  const $ = cheerio.load(html);

  // ⚠️ ŠIE SELEKTORIAI YRA PAVYZDINIAI. Patikrink DevTools ir pataisyk.
  $('.list-row-v2, tr.list-row').each((_, el) => {
    const $el = $(el);
    const url = $el.find('a.list-adress-v2, a').attr('href');
    const priceText = $el.find('.list-item-price-v2, .list-Price-v2').text();
    const areaText = $el.find('.list-AreaOverall-v2, .list-Area').text();
    const title = $el.find('.list-adress-v2, .list-adress').text().trim();

    const price = parseInt(priceText.replace(/[^\d]/g, ''), 10);
    const area = parseFloat(areaText.replace(',', '.').replace(/[^\d.]/g, ''));
    if (!url || !price || !area) return;

    results.push({
      id: url,                 // URL kaip unikalus ID
      url: url.startsWith('http') ? url : 'https://www.aruodas.lt' + url,
      title,
      price,
      area,
      district: (title.split(',')[1] || '').trim(), // grubiai iš adreso
      description: title.toLowerCase(),
      // detales (year, floor, kambariai) — geriausia traukti įėjus į skelbimą
    });
  });

  return results;
}

// Pasirenkamas šaltinis pagal aplinkos kintamąjį
async function fetchListings() {
  const mode = process.env.SOURCE || 'demo';
  if (mode === 'live') return fetchLiveListings();
  return fetchDemoListings();
}

module.exports = { fetchListings };
