# Aruodas Scout

Automatinis **Vilniaus butų renovacijai / perpardavimui** filtras. Periodiškai
peržiūri skelbimus, įvertina kiekvieną pagal tavo kriterijus (0–100 balų) ir
praneša tik apie naujas vertas galimybes.

## Kaip vertinama (balo logika)

Balas sudaromas iš keturių dalių su tavo prioritetų svoriais:

| Dalis | Svoris | Ką matuoja |
|---|---|---|
| **Kainos nuolaida** | 40% | kaina/m² vs rajono vidurkis (25%+ pigiau = max) |
| **Renovacijos potencialas** | 30% | prasta būklė + stiprus „kaulas" (sinergija premijuojama) |
| **Lokacija** | 20% | pageidaujami rajonai |
| **Paveldas** | 10% | išskirtinumo / paveldo signalai |

Viską keiti `src/config.js` — svorius, rajonų bazines kainas, raktažodžius,
ribą nuo kurios siunčiamas pranešimas (`minScoreToAlert`).

## Paleidimas lokaliai

```bash
npm install
npm run demo      # pavyzdiniai duomenys, saugu, nieko nescrapina
npm test          # tik vertinimo variklio testas
```

## Kainos atskaitos taškas (RC vertė)

Filtro esmė — „ar tai gera kaina". Geriausias atskaitos taškas yra ne kitų
skelbimų prašomos kainos, o **RC vidutinė rinkos vertė** konkrečiam objektui.

Darbo eiga (kol kas pusiau rankinė):

1. Paleidi įrankį — jis parodo kandidatus, kainą vertindamas per rajono
   vidurkį (žymima „RC vertė dar neįvesta").
2. Įdomiems objektams pasižiūri RC vertę:
   https://www.registrucentras.lt/masvert/paieska-obj (unikalų numerį randi
   pagal adresą).
3. Įrašai į `data/rc-values.json`: `{ "skelbimo-id": 185000 }`
4. Paleidi vėl — dabar kaina vertinama prieš tikrą RC vertę (stipresnis balas).

Slenksčiai keičiami `config.js` → `priceBaseline`. **Pastaba:** RC masinio
vertinimo vertė konservatyvi ir dažnai žemesnė nei reali rinkos kaina, todėl
„prašoma žemiau RC vertės" yra retas, bet labai stiprus signalas. Slenksčius
kalibruosi pamatęs pirmus realius skaičius.

## Duomenų šaltinis (skelbimų srautas)

`src/source.js` — **vienintelė** dalis, priklausanti nuo aruodas.lt. Trys keliai:

- **`demo`** (numatyta) — pavyzdiniai duomenys grandinei išbandyti.
- **`live`** — realus scraping. ⚠️ Prieštarauja aruodas taisyklėms ir gali
  bet kada nustoti veikti. HTML selektorius `fetchLiveListings()` viduje
  **būtina patikrinti naršyklės DevTools** ir pataisyti — jie pavyzdiniai.
- **Švariausia (rekomenduoju):** aruodas išsaugotos paieškos + el. pašto
  pranešimai, o šis įrankis tik įvertina atėjusius skelbimus. Arba mokamas
  LT NT duomenų API. Tada `live` scraping nereikia visai.

```bash
SOURCE=live node src/index.js   # tik patikrinus/pataisius selektorius
```

## „Nuolat" — deploy su cron

Ta pati schema kaip tavo lino agronomijos app:

1. Įkelk į GitHub, prijunk prie **Railway**.
2. Pridėk **Cron** servisą, komanda `npm start`, dažnis pvz. `*/30 * * * *`
   (kas 30 min).
3. `data/seen.json` saugo matytus skelbimus tarp paleidimų — Railway tam
   reikės persistent volume (kitaip atmintis išsivalys per redeploy).

## El. pašto pranešimai (pasirinktinai)

Nustatyk aplinkos kintamuosius — tada `notify.js` siųs laišką:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tavo@gmail.com
SMTP_PASS=app-specific-password
ALERT_TO=tavo@gmail.com
```

Be jų — pranešimai tiesiog rašomi į log (matosi Railway konsolėje).

## Kalibravimas (būtina)

`districtBaselineEurM2` — apytiksliai 2026 m. skaičiai. **Privalai juos
periodiškai atnaujinti** pagal realią rinką; idealiai — perskaičiuoti medianą
iš pačių surinktų skelbimų. Nuo šių skaičių tiesiogiai priklauso „nuolaidos"
balas, t.y. visa filtro vertė.

## Struktūra

```
src/
  config.js   ← tavo kriterijai (keiti čia)
  scorer.js   ← vertinimo variklis (stabilus, neliečiamas)
  source.js   ← duomenų šaltinis (keičiamas/rizikingas)
  store.js    ← atmintis (JSON failas)
  notify.js   ← pranešimai (log + el. paštas)
  index.js    ← paleidiklis (cron taikinys)
```
