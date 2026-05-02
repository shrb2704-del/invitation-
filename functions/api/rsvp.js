// Cloudflare Pages Function: receives RSVP and forwards to Telegram.
// ENV: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

export async function onRequestPost({ request, env }) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }

  const { answer, name, guestId, wish, ts } = payload;
  if (answer !== 'yes' && answer !== 'no') {
    return new Response('Bad answer', { status: 400 });
  }

  const TOKEN = env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = env.TELEGRAM_CHAT_ID;
  if (!TOKEN || !CHAT_ID) {
    console.error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
    return new Response('Server not configured', { status: 500 });
  }

  const safe = (s) => String(s || '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])).slice(0, 600);

  // ===== IP + GEO from Cloudflare =====
  const ip = request.headers.get('CF-Connecting-IP') || '';
  const cf = request.cf || {};
  const country = (cf.country || '').toUpperCase();
  const city = cf.city || '';

  // ===== UA → краткая платформа/браузер =====
  const ua = payload.ua || request.headers.get('User-Agent') || '';
  const device = /iPhone/.test(ua) ? 'iPhone'
              : /iPad/.test(ua) ? 'iPad'
              : /Android/.test(ua) ? 'Android'
              : /Macintosh/.test(ua) ? 'Mac'
              : /Windows/.test(ua) ? 'Windows'
              : 'PC';
  const browser = /CriOS|Chrome\/(\d+)/.test(ua) ? 'Chrome'
               : /FxiOS|Firefox\/(\d+)/.test(ua) ? 'Firefox'
               : /Version\/.+Safari/.test(ua) ? 'Safari'
               : /Edg\//.test(ua) ? 'Edge'
               : 'Browser';

  const emoji = answer === 'yes' ? '🎉' : '😢';
  const verdict = answer === 'yes' ? '<b>БУДУ</b>' : '<b>не смогу прийти</b>';
  const wishLine = wish ? `\n💬 <i>${safe(wish)}</i>` : '';
  const idLine = guestId ? `\n🔖 id: <code>${safe(guestId)}</code>` : '';
  const geoLine = (city || country) ? `\n📍 ${safe(city)}${city && country ? ', ' : ''}${safe(country)}` : '';
  const ipLine = ip ? `\n🌐 <code>${safe(ip)}</code>` : '';
  const uaLine = `\n📱 ${safe(device)} · ${safe(browser)}`;

  const text =
    `${emoji} <b>${safe(name)}</b> — ${verdict}` +
    `${wishLine}${idLine}${geoLine}${ipLine}${uaLine}` +
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
      return new Response('Telegram failed', { status: 502 });
    }
  } catch (e) {
    console.error(e);
    return new Response('Telegram unreachable', { status: 502 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function onRequest() {
  return new Response('Method Not Allowed', { status: 405 });
}
