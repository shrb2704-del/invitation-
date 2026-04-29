// Netlify serverless function: receives RSVP and forwards to Telegram.
// ENV: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: 'Bad JSON' }; }

  const { answer, name, guestId, wish, ts } = payload;
  if (answer !== 'yes' && answer !== 'no') {
    return { statusCode: 400, body: 'Bad answer' };
  }

  const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
  if (!TOKEN || !CHAT_ID) {
    console.error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
    return { statusCode: 500, body: 'Server not configured' };
  }

  const safe = (s) => String(s || '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])).slice(0, 600);
  const emoji = answer === 'yes' ? '🎉' : '😢';
  const verdict = answer === 'yes' ? '<b>БУДУ</b>' : '<b>не смогу прийти</b>';
  const wishLine = wish ? `\n💬 <i>${safe(wish)}</i>` : '';
  const idLine = guestId ? `\n🔖 id: <code>${safe(guestId)}</code>` : '';
  const text =
    `${emoji} <b>${safe(name)}</b> — ${verdict}` +
    `${wishLine}${idLine}` +
    `\n🕒 ${safe(ts)}`;

  try {
    const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      console.error('TG error', r.status, t);
      return { statusCode: 502, body: 'Telegram failed' };
    }
  } catch (e) {
    console.error(e);
    return { statusCode: 502, body: 'Telegram unreachable' };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true }),
  };
};
