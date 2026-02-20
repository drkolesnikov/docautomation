interface Env {
  ALLOWED_HOSTS: string;
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: CORS_HEADERS });
    }

    const targetUrl = request.headers.get("x-target-url");
    if (!targetUrl) {
      return new Response("Missing x-target-url header", { status: 400, headers: CORS_HEADERS });
    }

    const allowedHosts = env.ALLOWED_HOSTS.split(",").map((h) => h.trim());
    const { hostname } = new URL(targetUrl);
    if (!allowedHosts.includes(hostname)) {
      return new Response("Host not allowed", { status: 403, headers: CORS_HEADERS });
    }

    const headers = new Headers(request.headers);
    headers.delete("x-target-url");
    headers.delete("host");

    const response = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: request.body,
    });

    const responseHeaders = new Headers(response.headers);
    for (const [key, value] of Object.entries(CORS_HEADERS)) {
      responseHeaders.set(key, value);
    }

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  },
} satisfies ExportedHandler<Env>;
