import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/** The only reactions a student can send. Kept short so the bar fits a phone. */
export const LIVE_REACTIONS = ['👍', '❤️', '😂', '😮', '👏', '🔥'] as const;

export class CreateLiveSessionDto {
  @IsString() @MinLength(3) @MaxLength(140) title!: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsString() gradeId!: string;
  @IsDateString() scheduledAt!: string;
  @IsOptional() @IsBoolean() recordingEnabled?: boolean;
}

export class UpdateLiveSessionDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(140) title?: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsString() gradeId?: string;
  @IsOptional() @IsDateString() scheduledAt?: string;
  @IsOptional() @IsBoolean() recordingEnabled?: boolean;
}

export class LiveChatToggleDto {
  @IsBoolean() enabled!: boolean;
}

export class LiveChatMessageDto {
  @IsString() @MinLength(1) @MaxLength(500) body!: string;
}

export class LiveReactionDto {
  @IsString() @IsIn(LIVE_REACTIONS as unknown as string[]) emoji!: string;
}
