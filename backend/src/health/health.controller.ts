import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { StorageService } from '../common/storage/storage.service';
import { Public } from '../common/decorators';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly storage: StorageService,
  ) {}

  /** Liveness. Kept dependency-free so the container restarts only on a real hang. */
  @Public()
  @SkipThrottle()
  @Get()
  @ApiOperation({ summary: 'فحص سريع لحالة الخدمة' })
  live() {
    return { status: 'ok', uptime: Math.floor(process.uptime()) };
  }

  /** Readiness. Reports each dependency separately so ops can see what broke. */
  @Public()
  @SkipThrottle()
  @Get('ready')
  @ApiOperation({ summary: 'فحص شامل للاعتماديات' })
  async ready() {
    const [database, redis, storage] = await Promise.all([
      this.prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
      this.redis.client.ping().then(() => true).catch(() => false),
      this.storage.healthCheck(),
    ]);

    const ok = database && redis && storage;
    return {
      status: ok ? 'ok' : 'degraded',
      checks: { database, redis, storage },
    };
  }
}
