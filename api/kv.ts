import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleKvRequest } from './kv/handler';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await handleKvRequest(req, res);
}
