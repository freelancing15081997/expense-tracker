import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleAuthRequest } from './auth/handler';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await handleAuthRequest(req, res);
}
