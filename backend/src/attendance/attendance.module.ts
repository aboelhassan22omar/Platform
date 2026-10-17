import { Module } from '@nestjs/common';
import { MessagingModule } from '../messaging/messaging.module';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';

/** Center attendance by personal QR. */
@Module({
  imports: [MessagingModule],
  controllers: [AttendanceController],
  providers: [AttendanceService],
})
export class AttendanceModule {}
