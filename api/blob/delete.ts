import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleBlobDeleteRequest } from '../_lib/blob-store';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await handleBlobDeleteRequest(req, res);
}
