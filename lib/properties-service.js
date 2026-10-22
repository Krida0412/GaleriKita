const FIELDS = 'id,title,location,price,price_note,type,status,description,image,details,features,images';
const TTL = 300_000;
const STALE_TTL = 3_600_000;
const MAX_ROWS = 5000;
const text = (value, max = 2000) => typeof value === 'string' ? value.slice(0, max) : '';
const image = value => { try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; } catch { return ''; } };
function projectProperty(row) {
  if (!row || typeof row !== 'object' || typeof row.id !== 'string' || row.status !== 'active') return null;
  let details = row.details;
  if (typeof details === 'string') { try { details = JSON.parse(details); } catch { details = {}; } }
  details = details && typeof details === 'object' && !Array.isArray(details) ? details : {};
  const safeDetails = {};
  for (const key of ['beds','baths','buildingArea','area','landArea','floors','carport','paymentSystem']) {
    if (typeof details[key] === 'number' && Number.isFinite(details[key])) safeDetails[key] = details[key];
    else if (typeof details[key] === 'string') safeDetails[key] = text(details[key], 120);
  }
  return {
    id: text(row.id, 80), title: text(row.title, 500), location: text(row.location, 300),
    price: text(row.price, 120), price_note: text(row.price_note, 300), type: text(row.type, 80),
    status: 'active', description: text(row.description, 40_000), image: image(row.image), details: safeDetails,
    features: Array.isArray(row.features) ? row.features.filter(v => typeof v === 'string').slice(0, 80).map(v => text(v, 200)) : [],
    images: Array.isArray(row.images) ? [...new Set(row.images.map(image).filter(Boolean))].slice(0, 60) : [],
  };
}

/** Fixed read-only endpoint: no arbitrary URL, table, query, headers, or upstream errors are forwarded. */
export function createPropertiesHandler({ fetchImpl = globalThis.fetch, env = process.env, now = Date.now } = {}) {
  let cached = null;
  let pending = null;
  const validConfiguration = () => /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(env.SUPABASE_URL || '') && typeof env.SUPABASE_ANON_KEY === 'string' && env.SUPABASE_ANON_KEY.length > 20;
  async function load() {
    const endpoint = new URL('/rest/v1/properties', env.SUPABASE_URL);
    const signal = AbortSignal.timeout(10_000);
    const rows = []; let receivedBytes = 0;
    for (let offset = 0; offset <= MAX_ROWS; offset += 500) {
      endpoint.search = new URLSearchParams({ select: FIELDS, status: 'eq.active', order: 'created_at.desc,id.asc', limit: '500', offset: String(offset) }).toString();
      const response = await fetchImpl(endpoint.href, { method: 'GET', headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`, Accept: 'application/json' }, signal, redirect: 'error' });
      if (!response.ok) throw new Error('Upstream unavailable');
      if (Number(response.headers.get('content-length') || 0) > 8_000_000) throw new Error('Payload too large');
      const raw = await response.text();
      receivedBytes += Buffer.byteLength(raw);
      if (receivedBytes > 8_000_000) throw new Error('Payload too large');
      const page = JSON.parse(raw);
      if (!Array.isArray(page) || page.length > 500 || rows.length + page.length > MAX_ROWS) throw new Error('Invalid upstream payload');
      rows.push(...page);
      if (page.length < 500) break;
    }
    const projected = rows.map(projectProperty).filter(Boolean);
    const unique = [...new Map(projected.map(row => [row.id, row])).values()];
    const body=JSON.stringify(unique);
    if(Buffer.byteLength(body)>4_000_000)throw new Error('Response too large');
    cached = { body, at: now() };
    return cached;
  }
  return async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    const fail = (status, message) => { res.statusCode = status; res.end(JSON.stringify({ error: message })); };
    if (!['GET','HEAD'].includes(req.method)) { res.setHeader('Allow', 'GET, HEAD'); return fail(405, 'Metode tidak diizinkan.'); }
    let url;
    try { url = new URL(req.url, 'https://galerikita.invalid'); } catch { return fail(400, 'Permintaan tidak valid.'); }
    if (url.search) return fail(400, 'Parameter tidak didukung.');
    if (!validConfiguration()) return fail(503, 'Layanan properti belum dikonfigurasi.');
    try {
      let result = cached;
      let stale = false;
      if (!result || now() - result.at >= TTL) {
        try {
          if (!pending) pending = load().finally(() => { pending = null; });
          result = await pending;
        } catch {
          if (!cached || now() - cached.at >= STALE_TTL) throw new Error('No cache');
          result = cached; stale = true;
        }
      }
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
      res.setHeader('Vercel-CDN-Cache-Control', stale ? 'max-age=15' : 'max-age=300, stale-while-revalidate=600');
      res.setHeader('X-Data-Cache', stale ? 'stale' : 'fresh');
      res.statusCode = 200;
      res.end(req.method === 'HEAD' ? undefined : result.body);
    } catch { return fail(502, 'Data properti belum bisa dimuat. Silakan coba lagi.'); }
  };
}
