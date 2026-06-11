// =============================================================
//  KRITERIJAI IR NUSTATYMAI
//  Čia keiti VISKĄ, kas susiję su tavo strategija.
//  Vertinimo variklis (scorer.js) liečiamas nebūtų.
// =============================================================

module.exports = {
  // --- Bazinė paieška ---
  search: {
    city: 'Vilnius',
    type: 'butai',              // tik butai renovacijai/perpardavimui
    minArea: 30,                // m² — atmesti per mažus
    maxArea: 120,               // m² — atmesti per didelius (per brangus „bilietas")
    maxPrice: 250000,           // € — viršutinė riba įvažiavimui
    excludeNewBuildings: true,  // nauja statyba = mažas renovacijos potencialas
  },

  // --- Svoriai (gauti iš tavo prioritetų rikiavimo) ---
  // Suma turi būti 1.0
  weights: {
    priceDiscount: 0.40, // 1. Kaina/m² žemiau rajono vidurkio
    renovation:    0.30, // 2. Bloga būklė + stiprus „kaulas"
    location:      0.20, // 3. Konkreti lokacija
    heritage:      0.10, // 4. Paveldo / išskirtinumo potencialas
  },

  // Žemiau šio balo objektai net nerodomi pranešime
  minScoreToAlert: 55,

  // --- Kainos atskaitos taškas ---
  priceBaseline: {
    preferRcValue: true,       // jei objektui žinoma RC vertė — naudoti ją
    rcDiscountForMax: 0.10,    // prašoma 10%+ žemiau RC vertės -> max balas
    districtDiscountForMax: 0.25, // atsarginiame režime: 25% žemiau rajono -> max
  },

  // --- Pageidaujami rajonai (location balui) ---
  // Aukštesnis weight = labiau nori. Nesantys sąraše gauna 0.3 bazę.
  preferredDistricts: {
    'Senamiestis': 1.0,
    'Naujamiestis': 0.9,
    'Žvėrynas': 0.9,
    'Antakalnis': 0.8,
    'Šnipiškės': 0.7,
    'Žirmūnai': 0.6,
    'Naujininkai': 0.5,
  },

  // --- Rajonų kainos €/m² (antrinė rinka, apytiksliai 2026) ---
  // SVARBU: šiuos skaičius privalai kalibruoti pagal realią rinką.
  // Geriausia — periodiškai perskaičiuoti iš pačių surinktų skelbimų medianos.
  districtBaselineEurM2: {
    'Senamiestis': 3500,
    'Naujamiestis': 3200,
    'Žvėrynas': 3400,
    'Antakalnis': 2800,
    'Šnipiškės': 3000,
    'Žirmūnai': 2400,
    'Lazdynai': 2000,
    'Karoliniškės': 2100,
    'Justiniškės': 2000,
    'Fabijoniškės': 2000,
    'Pašilaičiai': 2200,
    'Pilaitė': 2300,
    'Naujininkai': 2200,
    'Vilkpėdė': 2400,
    'Naujoji Vilnia': 1700,
  },
  defaultBaselineEurM2: 2300, // jei rajonas nežinomas

  // --- Raktažodžiai būklės/„kaulo" atpažinimui ---
  keywords: {
    // Prasta būklė = renovacijos potencialas (gerai mums)
    needsWork: [
      'reikia remonto', 'reikalingas remontas', 'kapitalinio remonto',
      'dalinė apdaila', 'be apdailos', 'neįrengtas', 'neįrengtos',
      'dalinė įranga', 'tvarkytinas', 'tvarkytina', 'senas remontas',
      'avarinės', 'nudėvėtas', 'paveldėtas', 'po gaisro',
    ],
    // Geras „kaulas" = verta investuoti
    goodBones: [
      'mūrinis', 'mūro', 'plytų', 'plytinis', 'monolitinis',
      'tarpukario', 'tarpukaris', 'aukštos lubos', 'aukštos lubų',
      'parketas', 'autentišk', 'tvirtos sienos',
    ],
    // Paveldo signalai
    heritage: [
      'paveldo', 'saugomas', 'kultūros vertyb', 'tarpukario',
      'senamiestis', 'autentišk', 'istorin',
    ],
  },
};
