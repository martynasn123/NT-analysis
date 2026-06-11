// =============================================================
//  DUOMENŲ SLUOKSNIS  ⚠️  KEIČIAMA / RIZIKINGA DALIS
// -------------------------------------------------------------
//  Vienintelė dalis, priklausanti nuo aruodas.lt HTML struktūros.
//  Selektoriai pritaikyti pagal 2026-06 aruodas paieškos puslapio
//  „advert-flex" kortelę. Jei aruodas pakeis dizainą — taisyk ČIA.
//
//  SVARBU: scraping prieštarauja aruodas taisyklėms ir gali nustoti
//  veikti. Jei pamatysi, kad blokuoja (captcha, tuščias HTML) —
//  pereik prie išsaugotų paieškų + el. pašto kelio.
// =============================================================

const cfg = require('./config');

// --- Demo duomenys (SOURCE=demo) ---
function fetchDemoListings() {
  return [
    { id: 'demo-1', url: 'https://www.aruodas.lt/demo-1',
      title: 'Tarpukario butas, reikia remonto', price: 165000, area: 60,
      rooms: 3, floor: 2, totalFloors: 4, year: 1935, district: 'Naujamiestis',
      description: 'tarpukario mūrinis namas aukštos lubos reikia remonto autentiškas parketas' },
    { id: 'demo-2', url: 'https://www.aruodas.lt/demo-2',
      title: 'Antakalnis, dalinė apdaila', price: 150000, area: 58,
      rooms: 2, floor: 3, totalFloors: 5, year: 1972, district: 'Antakalnis',
      description: 'plytinis namas dalinė apdaila tvarkytinas geras planas' },
    { id: 'demo-3', url: 'https://www.aruodas.lt/demo-3',
      title: 'Renovuotas butas Pilaitėje', price: 230000, area: 65,
      rooms: 3, floor: 5, totalFloors: 9, year: 2015, district: 'Pilaitė',
      description: 'puiki būklė šviežias remontas įrengtas' },
  ];
}

// --- Pagalbinės parsinimo funkcijos ---
const num = (s) => {
  // "289 000 €" / "107.1 m²" / "2 699 €/m²" -> skaičius
  if (!s) return null;
  const cleaned = s.replace(/\s|\u00a0/g, '').replace(',', '.').replace(/[^\d.]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
};

function parseCard($, el) {
  const $el = $(el);

  // Nuoroda + ID (iš adreso antraštės)
  const $link = $el.find('.list-adress-v2 h3 a').first();
  let url = $link.attr('href') || '';
  url = url.split('?')[0]; // nuimam ?search_pos=...
  const id = ($el.find('.list-photo-v2 img').attr('data-id') || url).toString();

  // Adresas / rajonas. Struktūra: "Vilnius, Santariškės" <br> <strong>Dangeručio g.</strong>
  // Gatvė yra <strong>, prieš ją — miestas + rajonas.
  const $clone = $link.clone();
  const street = $clone.find('strong').text().trim();
  $clone.find('strong').remove();
  const prefix = $clone.text().replace(/\s+/g, ' ').trim(); // "Vilnius, Santariškės"
  const parts = prefix.split(',').map((s) => s.trim()).filter(Boolean);
  const district = parts[1] || parts[0] || ''; // antra dalis = rajonas
  const title = [prefix, street].filter(Boolean).join(', ');

  // Kaina ir plotas
  const price = num($el.find('.list-item-price-v2').first().text());
  const area = num($el.find('.list-AreaOverall-v2 .list-detail-value-v2').first().text());

  // Aukštas "3/4 aukšt." -> floor 3, total 4
  const floorsRaw = $el.find('.list-Floors-v2 .list-detail-value-v2').first().text();
  const fm = floorsRaw.match(/(\d+)\s*\/\s*(\d+)/);
  const floor = fm ? parseInt(fm[1], 10) : null;
  const totalFloors = fm ? parseInt(fm[2], 10) : null;

  // Kambariai "4 k." / metai / įrengimas / šildymas
  const rooms = num($el.find('.list-RoomNum-v2 .list-detail-value-v2').first().text());
  const year = num($el.find('.list-BuildYear-v2 .list-detail-value-v2').first().text());
  const equipment = $el.find('.list-Equipment-v2 .list-detail-value-v2').first().text().trim();
  const heating = $el.find('.list-HeatingType-v2 .list-detail-value-v2').first().text().trim();

  // Naujos statybos žyma
  const isNewProject = $el.find('.in-project--new').length > 0;

  // Kainos pokytis: aruodas pats pažymi
  let aruodasPriceChange = null; // 'up' | 'down' | null
  if ($el.find('.price-change .icon-down').length) aruodasPriceChange = 'down';
  else if ($el.find('.price-change .icon-up').length) aruodasPriceChange = 'up';

  // „description" vertinimo varikliui: sudedam tekstinius signalus
  // (įrengimas + šildymas + adresas) — iš jų scorer atpažįsta būklę/kaulą.
  const description = [equipment, heating, street, prefix]
    .filter(Boolean).join(' ').toLowerCase();

  if (!url || !price || !area) return null;

  return {
    id, url, title, price, area, rooms,
    floor, totalFloors, year, district,
    equipment, heating, isNewProject, aruodasPriceChange,
    description,
  };
}

// --- Realus aruodas scraping (SOURCE=live) ---
async function fetchLiveListings() {
  const cheerio = require('cheerio');

  // Paieškos URL — pasiimk iš naršyklės atlikęs norimą paiešką.
  // FOrderBy=3 = naujausi viršuje.
  const baseUrl = 'https://www.aruodas.lt/butai/vilniuje/?FOrderBy=3';

  const res = await fetch(baseUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      'Accept-Language': 'lt-LT,lt;q=0.9',
      'Accept': 'text/html,application/xhtml+xml',
    },
  });

  if (!res.ok) {
    throw new Error(`aruodas atsakė ${res.status} (galbūt blokuoja robotą)`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  const cards = $('.advert-flex');
  if (cards.length === 0) {
    throw new Error('Nerasta nė vienos kortelės — pasikeitė HTML arba blokuoja');
  }

  const seen = new Set();
  const results = [];
  cards.each((_, el) => {
    const obj = parseCard($, el);
    if (obj && !seen.has(obj.id)) {
      seen.add(obj.id);
      results.push(obj);
    }
  });

  return results;
}

async function fetchListings() {
  const mode = process.env.SOURCE || 'demo';
  if (mode === 'live') return fetchLiveListings();
  return fetchDemoListings();
}

module.exports = { fetchListings, parseCard, num };
