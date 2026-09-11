import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleBlobUploadRequest } from '../_lib/blob-store';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await handleBlobUploadRequest(req, res);
}
