import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleBlobDeleteRequest } from './store';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await handleBlobDeleteRequest(req, res);
}
