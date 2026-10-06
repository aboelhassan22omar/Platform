import { Client as MinioClient } from 'minio';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client';
import { DATABASE_URL, REDIS_URL, S3 } from './config';

export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: DATABASE_URL }),
});

export const storage = new MinioClient({
  ...S3,
  pathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
});

const redisUrl = new URL(REDIS_URL);
export const redisConnection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || 6379),
  password: redisUrl.password || undefined,
  maxRetriesPerRequest: null,
};

export const log = (message: string) =>
  console.log(`[worker ${new Date().toISOString()}] ${message}`);
