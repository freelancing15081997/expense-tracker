import type { IncomingMessage, ServerResponse } from 'http';
import { applyCors, requestPath, sendJson } from './http';
import { neonAuthSuffix, proxyToNeonAuth } from './auth-proxy';

export async function handleAuthRequest(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    const extra = neonAuthSuffix(requestPath(req).pathname);
    await proxyToNeonAuth(req, res, extra);
  } catch (err: any) {
    sendJson(res, 500, { error: err?.message || 'Auth failed' });
  }
}
