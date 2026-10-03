import { PrismaClient } from '@prisma/client';
import { seed } from './store.ts';

const url = process.env.DATABASE_URL;
if (!url) {
  console.log('DATABASE_URL is not set. The API keeps the design seed in memory. Set it to persist with Postgres.');
  process.exit(0);
}

const prisma = new PrismaClient();
const data = seed();
await prisma.appState.upsert({
  where: { id: 'live' },
  create: { id: 'live', data: JSON.parse(JSON.stringify({ ...data, refresh: [] })) },
  update: { data: JSON.parse(JSON.stringify({ ...data, refresh: [] })) },
});
console.log('Seeded Postgres from the design mocks.');
await prisma.$disconnect();
