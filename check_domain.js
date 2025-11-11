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

exports.handler = async function (event, context) {
  let body = {};
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'invalid json' }) };
  }

  const domainRaw = body.domain;
  const domain = cleanDomain(domainRaw);
  if (!domain) return { statusCode: 400, body: JSON.stringify({ error: 'missing domain' }) };

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
      const res = await timeoutFetch(url, { method: 'GET', redirect: 'follow' });
      out.status_code = res.status || (res.statusCode ? res.statusCode : null);
      out.ok = out.status_code >= 200 && out.status_code < 400;
    } catch (err) {
      out.error = err && err.message ? err.message : String(err);
    }
    return out;
  };

  // Note: using top-level await in parallel
  const [httpRes, httpsRes] = await Promise.all([
    makeCheck(`http://${domain}/`),
    makeCheck(`https://${domain}/`),
  ]);

  const result = {
    domain,
    dns_resolves,
    ip,
    http: httpRes,
    https: httpsRes,
  };

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result),
  };
};
