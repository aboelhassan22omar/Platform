import path from 'node:path';
import { defineConfig, env } from 'prisma/config';

/**
 * Prisma 7 moves the datasource URL out of schema.prisma. This file is used by
 * the Prisma CLI (migrate / studio / db push) only. The runtime client gets its
 * connection through the pg driver adapter in src/prisma/prisma.service.ts.
 */
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    url: env('DATABASE_URL'),
  },
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'ts-node --transpile-only prisma/seed.ts',
  },
});
