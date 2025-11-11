const dns = require('dns').promises;

// Use global fetch (Node 18+) or fall back to node-fetch if available
let fetchFn = global.fetch;
try {
  if (!fetchFn) fetchFn = require('node-fetch');
} catch (e) {
  // node-fetch not installed; assume platform provides fetch
}

const TIMEOUT = 5000;

const cleanDomain = (d) => {
  if (!d) return '';
  let s = String(d).trim();
  s = s.replace(/^https?:\/\//i, '');
  s = s.split('/')[0];
  return s.toLowerCase();
};

const timeoutFetch = (url, opts = {}) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT);
  const signal = controller.signal;
  return (fetchFn || global.fetch)(url, { ...opts, signal })
    .then((res) => {
      clearTimeout(id);
      return res;
    })
    .catch((err) => {
      clearTimeout(id);
      throw err;
    });
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const body = typeof req.body === 'object' ? req.body : (() => {
    try { return JSON.parse(req.body || '{}'); } catch { return {}; }
  })();

  const domainRaw = body.domain;
  const domain = cleanDomain(domainRaw);
  if (!domain) return res.status(400).json({ error: 'missing domain' });

  // DNS resolution
  let ip = null;
  let dns_resolves = false;
  try {
    const info = await dns.lookup(domain);
    ip = info && info.address ? info.address : null;
    dns_resolves = !!ip;
  } catch (e) {
    dns_resolves = false;
  }

  // HTTP checks
  const makeCheck = async (url) => {
    const out = { ok: false, status_code: null, url, error: null };
    try {
      const r = await timeoutFetch(url, { method: 'GET', redirect: 'follow' });
      out.status_code = r.status || (r.statusCode ? r.statusCode : null);
      out.ok = out.status_code >= 200 && out.status_code < 400;
    } catch (err) {
      out.error = err && err.message ? err.message : String(err);
    }
    return out;
  };

  const [httpRes, httpsRes] = await Promise.all([
    makeCheck(`http://${domain}/`),
    makeCheck(`https://${domain}/`),
  ]);

  return res.json({
    domain,
    dns_resolves,
    ip,
    http: httpRes,
    https: httpsRes,
  });
}
