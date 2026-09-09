import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleAuthRequest } from '../_lib/auth-handler';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await handleAuthRequest(req, res);
}

export const config = {
  maxDuration: 30,
};
