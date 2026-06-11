// =============================================================
//  PRANEŠIMAI
//  Numatytai — į terminalą/log. Norint el. pašto: užpildyk SMTP
//  aplinkos kintamuosius (žr. README) ir bus siunčiama per nodemailer.
// =============================================================

function formatListing(l) {
  const b = l.breakdown;
  const priceStr = l.price != null ? l.price.toLocaleString('lt-LT') + ' €' : '?';
  const head = l.priceDrop
    ? `▼ KAINA KRITO: ${l.priceDrop.from.toLocaleString('lt-LT')} € → ${l.priceDrop.to.toLocaleString('lt-LT')} €  (★ ${l.score} balų) — ${l.title}`
    : `★ ${l.score} balų — ${l.title}`;
  // Aruodas pats pažymi kainos kritimą — papildomas signalas
  const aruodasFlag = l.aruodasPriceChange === 'down' ? '  [aruodas: kaina sumažėjusi]' : '';
  return [
    head + aruodasFlag,
    `  ${l.url}`,
    `  Kaina: ${priceStr} | ${l.area ?? '?'} m² | ${b.priceDiscount.detail}`,
    `  Būklė: ${l.equipment || '—'} | Renovacija: ${b.renovation.detail}`,
    `  Lokacija: ${b.location.detail} | Paveldas: ${b.heritage.detail}`,
  ].join('\n');
}

async function notify(items) {
  const body = items.map(formatListing).join('\n\n');

  // 1) Visada — į log
  console.log('\n========= NAUJOS GALIMYBĖS =========\n' + body + '\n');

  // 2) Pasirinktinai — el. paštas
  if (process.env.SMTP_HOST && process.env.ALERT_TO) {
    try {
      const nodemailer = require('nodemailer');
      const transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      await transport.sendMail({
        from: process.env.SMTP_USER,
        to: process.env.ALERT_TO,
        subject: `Aruodas Scout: ${items.length} nauja(-os) galimybė(-ės)`,
        text: body,
      });
      console.log('El. laiškas išsiųstas.');
    } catch (err) {
      console.error('El. pašto klaida:', err.message);
    }
  }
}

module.exports = { notify };
