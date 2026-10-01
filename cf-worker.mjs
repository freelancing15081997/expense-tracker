/**
 * Cloudflare Worker entry for the existing Express API.
 * Env bindings are copied onto process.env before the server module loads.
 */
let ready;

async function boot(env) {
  if (ready) return ready;
  ready = (async () => {
    for (const [key, value] of Object.entries(env || {})) {
      if (typeof value === 'string') process.env[key] = value;
    }
    process.env.CF_WORKER = '1';
    if (process.versions) {
      try { delete process.versions.node; } catch { /* runtime may freeze versions */ }
    }
    const { default: app } = await import('./server.ts');
    const { createServer } = await import('node:http');
    const { httpServerHandler } = await import('cloudflare:node');
    const server = createServer(app);
    server.listen(8787);
    return httpServerHandler({ port: 8787 });
  })();
  return ready;
}

function isApi(pathname) {
  return pathname.startsWith('/api/') || pathname === '/api' || pathname.startsWith('/neondb/');
}

/** Workers cannot open outbound SMTP, so outbound mail runs on the Node origin. */
function sendsMail(pathname) {
  return pathname === '/api/email/send' || pathname === '/api/email/send-report';
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (
      url.hostname === 'easypado.com' &&
      !isApi(url.pathname) &&
      (request.method === 'GET' || request.method === 'HEAD')
    ) {
      url.hostname = 'www.easypado.com';
      return Response.redirect(url.toString(), 302);
    }
    if (sendsMail(url.pathname) && request.method === 'POST') {
      return fetch(request);
    }
    if (!isApi(url.pathname) && env.ASSETS) {
      const asset = await env.ASSETS.fetch(request);
      const headers = new Headers(asset.headers);
      headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
      return new Response(asset.body, { status: asset.status, statusText: asset.statusText, headers });
    }
    if (env.FILES) globalThis.BYJAN_R2 = env.FILES;
    if (env.AI) globalThis.BYJAN_AI = env.AI;
    if (ctx && typeof ctx.waitUntil === 'function') {
      globalThis.BYJAN_WAIT = (promise) => ctx.waitUntil(promise);
    }
    const handler = await boot(env);
    return handler.fetch(request);
  },
};
