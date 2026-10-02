import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const workerDirectory = path.resolve(scriptsDirectory, '..');
const repositoryDirectory = path.resolve(workerDirectory, '..');
const packagedSchema = path.join(workerDirectory, 'prisma', 'schema.prisma');
const repositorySchema = path.join(repositoryDirectory, 'backend', 'prisma', 'schema.prisma');
const sourceSchema = existsSync(packagedSchema) ? packagedSchema : repositorySchema;
const temporaryDirectory = path.join(workerDirectory, '.prisma-build');
const temporarySchema = path.join(temporaryDirectory, 'schema.prisma');
const packagedPrismaCli = path.join(workerDirectory, 'node_modules', 'prisma', 'build', 'index.js');
const repositoryPrismaCli = path.join(repositoryDirectory, 'node_modules', 'prisma', 'build', 'index.js');
const prismaCli = existsSync(packagedPrismaCli) ? packagedPrismaCli : repositoryPrismaCli;
const packagedPrismaConfig = path.join(workerDirectory, 'prisma.config.ts');
const repositoryPrismaConfig = path.join(repositoryDirectory, 'backend', 'prisma.config.ts');
const prismaConfig = existsSync(packagedPrismaConfig)
  ? packagedPrismaConfig
  : repositoryPrismaConfig;

await mkdir(temporaryDirectory, { recursive: true });

try {
  await writeFile(temporarySchema, await readFile(sourceSchema, 'utf8'), 'utf8');

  const result = spawnSync(
    process.execPath,
    [
      prismaCli,
      'generate',
      '--schema',
      temporarySchema,
      '--config',
      prismaConfig,
    ],
    {
      cwd: workerDirectory,
      env: {
        ...process.env,
        DATABASE_URL:
          process.env.DATABASE_URL ?? 'postgresql://build:build@localhost:5432/build',
      },
      stdio: 'inherit',
    },
  );

  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status ?? 1;
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
