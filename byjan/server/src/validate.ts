import type { FastifyReply } from 'fastify';
import { z } from 'zod';

export function readBody<T>(schema: z.ZodType<T>, body: unknown, reply: FastifyReply): T | undefined {
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) {
    reply.code(400).send({ code: 'BAD_BODY', message: 'Check the fields and try again' });
    return;
  }
  return parsed.data;
}

export const otpSend = z.object({ phone: z.string().min(8).max(16) });
export const otpVerify = z.object({ requestId: z.string().min(1), code: z.string().length(6) });
export const entryCreate = z.object({
  bookId: z.string().min(1),
  amount: z.number().int().nonnegative(),
  title: z.string().optional(),
  category: z.string().optional(),
  paidBy: z.string().optional(),
  split: z.object({ members: z.array(z.string()).optional(), mode: z.string().optional() }).optional(),
}).passthrough();
export const upiIntent = z.object({
  toVpa: z.string().min(3),
  amount: z.number().positive(),
  note: z.string().optional(),
  app: z.string().optional(),
  fromAccountId: z.string().optional(),
  bookId: z.string().optional(),
}).passthrough();
