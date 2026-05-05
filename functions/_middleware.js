// Personalize OG meta tags per guest based on ?n=ID
// Runs on Cloudflare Pages for every request; only modifies HTML pages with ?n= param.

export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);
  const guestId = url.searchParams.get('n');

  if (!guestId) return next();
  if (url.pathname !== '/' && url.pathname !== '/index.html') return next();

  const response = await next();
  const ct = response.headers.get('Content-Type') || '';
  if (!ct.includes('text/html')) return response;

  let guests;
  try {
    const guestsRes = await env.ASSETS.fetch(new URL('/guests.json', request.url));
    if (!guestsRes.ok) return response;
    guests = await guestsRes.json();
  } catch (_) { return response; }

  const g = guests[guestId];
  if (!g) return response;
  const name = typeof g === 'string' ? g : g.name;
  if (!name) return response;

  const title = `Приглашение для ${name}`;

  return new HTMLRewriter()
    .on('title', { element(el) { el.setInnerContent(title); } })
    .on('meta[property="og:title"]', { element(el) { el.setAttribute('content', title); } })
    .on('meta[name="twitter:title"]', { element(el) { el.setAttribute('content', title); } })
    .transform(response);
}
