import { Controller, Get, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Role } from '../generated/prisma/enums';
import { CurrentUser } from '../common/decorators';
import type { AuthenticatedUser } from '../common/decorators';
import { DEVICE_COOKIE, DevicesService } from './devices.service';

@ApiTags('auth')
@Controller('me')
export class MeDevicesController {
  constructor(private readonly devices: DevicesService) {}

  /** The student's own signed-in devices; removing one is done by support. */
  @Get('devices')
  @ApiOperation({ summary: 'الأجهزة المسجّل عليها حسابي' })
  async myDevices(@CurrentUser() actor: AuthenticatedUser, @Req() req: Request) {
    const [list, currentId] = await Promise.all([
      this.devices.list(actor.id),
      this.devices.currentDeviceId(actor.id, req.cookies?.[DEVICE_COOKIE]),
    ]);
    return {
      limit: actor.role === Role.STUDENT ? list.limit : 0,
      devices: list.devices.map(({ ip: _ip, ...device }) => ({
        ...device,
        isCurrent: device.id === currentId,
      })),
    };
  }
}
