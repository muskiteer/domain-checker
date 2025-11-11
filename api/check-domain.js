const dns = require('dns').promises;

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
  return fetch(url, { ...opts, signal })
    .then((res) => {
      clearTimeout(id);
      return res;
    })
    .catch((err) => {
      clearTimeout(id);
      throw err;
    });
};

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method not allowed' });
  }

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
      out.status_code = r.status;
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
};
