import type { VercelRequest, VercelResponse } from '@vercel/node';

function json(res: VercelResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(payload));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { handleKvRequest } = await import('./_lib/kv-handler');
    await handleKvRequest(req, res);
  } catch (err: any) {
    json(res, 500, { error: err?.message || 'Data request failed' });
  }
}
