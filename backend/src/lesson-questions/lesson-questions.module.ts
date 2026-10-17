import { Module } from '@nestjs/common';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { MessagingModule } from '../messaging/messaging.module';
import { LessonQuestionsController } from './lesson-questions.controller';
import { LessonQuestionsService } from './lesson-questions.service';

/** Questions and answers under each lesson. */
@Module({
  imports: [EntitlementsModule, MessagingModule],
  controllers: [LessonQuestionsController],
  providers: [LessonQuestionsService],
})
export class LessonQuestionsModule {}
