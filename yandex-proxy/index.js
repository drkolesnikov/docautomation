const http  = require('node:http');
const https = require('node:https');

const PORT = process.env.PORT || 8080;
const ALLOWED_HOSTS = (process.env.ALLOWED_HOSTS ||
  'api.anthropic.com,api.openai.com,api.deepseek.com,' +
  'generativelanguage.googleapis.com,llm.api.cloud.yandex.net')
  .split(',').map(s => s.trim());

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

const server = http.createServer((req, res) => {
  for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.method !== 'POST')   { res.writeHead(405); res.end('Method Not Allowed'); return; }

  const targetUrl = req.headers['x-target-url'];
  if (!targetUrl) { res.writeHead(400); res.end('Missing x-target-url'); return; }

  let parsed;
  try { parsed = new URL(targetUrl); }
  catch { res.writeHead(400); res.end('Invalid URL'); return; }

  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    res.writeHead(403); res.end('Host not allowed'); return;
  }

  const fwdHeaders = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (k === 'x-target-url' || k === 'host') continue;
    fwdHeaders[k] = v;
  }

  const lib = parsed.protocol === 'https:' ? https : http;
  const proxyReq = lib.request(targetUrl, { method: 'POST', headers: fwdHeaders }, (proxyRes) => {
    const outHeaders = { ...CORS };
    for (const [k, v] of Object.entries(proxyRes.headers)) {
      if (k === 'transfer-encoding' || k === 'connection') continue;
      outHeaders[k] = v;
    }
    res.writeHead(proxyRes.statusCode, outHeaders);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', () => { if (!res.headersSent) { res.writeHead(502); res.end('Bad Gateway'); } });
  req.pipe(proxyReq);
});

server.listen(PORT, () => console.log(`Proxy listening on :${PORT}`));
