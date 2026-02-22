'use strict';

/**
 * ПНД.doc CORS proxy for Yandex Cloud Functions.
 *
 * Mirrors the behaviour of /worker/index.ts but runs as a Yandex Cloud Function
 * instead of a Cloudflare Worker. Yandex Cloud Functions are accessible inside
 * Russia without a VPN, making this the recommended proxy for Russian deployments.
 *
 * LIMITATION: Yandex Cloud Functions do not support streaming responses — the
 * entire upstream response body is buffered before returning to the browser.
 * LLM output will not appear token-by-token; it will appear all at once after
 * the model finishes. For long documents (e.g. МСЭК) this can mean a 20–60 s
 * wait with no visible progress. If streaming is important, use the Cloudflare
 * Worker instead (/worker/).
 *
 * Environment variables:
 *   ALLOWED_HOSTS  Comma-separated list of allowed upstream hostnames.
 *                  Defaults to the same list as wrangler.toml.
 */

const https = require('https');
const http = require('http');

const DEFAULT_ALLOWED_HOSTS =
  'api.anthropic.com,api.openai.com,api.deepseek.com,generativelanguage.googleapis.com,llm.api.cloud.yandex.net';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

/**
 * Make a buffered HTTP/HTTPS request and return { statusCode, headers, body }.
 */
function forwardRequest(targetUrl, method, reqHeaders, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(targetUrl);
    const lib = parsed.protocol === 'https:' ? https : http;

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method,
      headers: reqHeaders,
    };

    const req = lib.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const rawBody = Buffer.concat(chunks);
        // Return body as base64 so binary/JSON/SSE all survive safely
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: rawBody.toString('base64'),
          isBase64Encoded: true,
        });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

module.exports.handler = async function (event) {
  const method = (event.httpMethod || 'POST').toUpperCase();

  // CORS preflight
  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (method !== 'POST') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: 'Method Not Allowed',
    };
  }

  const reqHeaders = event.headers || {};
  const targetUrl = reqHeaders['x-target-url'];

  if (!targetUrl) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: 'Missing x-target-url header',
    };
  }

  // Hostname allowlist check
  let parsedTarget;
  try {
    parsedTarget = new URL(targetUrl);
  } catch {
    return { statusCode: 400, headers: CORS_HEADERS, body: 'Invalid x-target-url' };
  }

  const allowedHosts = (process.env.ALLOWED_HOSTS || DEFAULT_ALLOWED_HOSTS)
    .split(',')
    .map((h) => h.trim());

  if (!allowedHosts.includes(parsedTarget.hostname)) {
    return { statusCode: 403, headers: CORS_HEADERS, body: 'Host not allowed' };
  }

  // Strip hop-by-hop and proxy headers before forwarding
  const forwardHeaders = {};
  for (const [key, value] of Object.entries(reqHeaders)) {
    const lower = key.toLowerCase();
    if (lower === 'x-target-url' || lower === 'host') continue;
    forwardHeaders[lower] = value;
  }

  // Body: YCF passes body as a string (base64 if isBase64Encoded, plain otherwise)
  let bodyBuffer;
  if (event.body) {
    bodyBuffer = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64')
      : Buffer.from(event.body, 'utf8');
  }

  try {
    const upstream = await forwardRequest(targetUrl, 'POST', forwardHeaders, bodyBuffer);

    // Merge CORS headers into upstream response headers
    const responseHeaders = { ...upstream.headers, ...CORS_HEADERS };
    // Remove transfer-encoding — YCF handles framing itself
    delete responseHeaders['transfer-encoding'];

    return {
      statusCode: upstream.statusCode,
      headers: responseHeaders,
      body: upstream.body,
      isBase64Encoded: true,
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: CORS_HEADERS,
      body: `Upstream error: ${err.message}`,
    };
  }
};
