import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PublishStatus } from '../../generated/prisma/enums';
import { PartialType } from '@nestjs/swagger';

export class UpsertCourseDto {
  @IsString() @MinLength(2) @MaxLength(160) title!: string;
  @IsOptional() @IsString() @MaxLength(160) titleEn?: string;
  @IsString() gradeId!: string;
  @IsOptional() @IsString() academicYearId?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsString() @MaxLength(2000) descriptionEn?: string;
  @IsOptional() @IsEnum(PublishStatus) status?: PublishStatus;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
  @IsOptional() @IsInt() @Min(0) priceMinor?: number;
  @IsOptional() @IsBoolean() isProvisional?: boolean;
  @IsOptional() @IsString() thumbnailKey?: string;
  @IsOptional() @IsString() coverKey?: string;
  @IsOptional() @IsDateString() scheduledAt?: string;
}

export class UpsertUnitDto {
  @IsString() @MinLength(2) @MaxLength(160) title!: string;
  @IsOptional() @IsString() @MaxLength(160) titleEn?: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsString() @MaxLength(1000) descriptionEn?: string;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
  @IsOptional() @IsEnum(PublishStatus) status?: PublishStatus;
  @IsOptional() @IsDateString() scheduledAt?: string;
}

export class UpsertChapterDto extends UpsertUnitDto {
  @IsOptional() @IsInt() @Min(0) priceMinor?: number;
}

export class UpsertLessonDto {
  @IsOptional() @IsInt() @Min(0) centerPriceMinor?: number | null;
  @IsString() @MinLength(2) @MaxLength(200) title!: string;
  @IsOptional() @IsString() @MaxLength(200) titleEn?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsString() @MaxLength(2000) descriptionEn?: string;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
  @IsOptional() @IsEnum(PublishStatus) status?: PublishStatus;
  @IsOptional() @IsInt() @Min(0) priceMinor?: number;
  @IsOptional() @IsBoolean() isFreePreview?: boolean;
  @IsOptional() @IsString() thumbnailKey?: string;
  @IsOptional() @IsDateString() scheduledAt?: string;
}

export class UpdateLessonDto extends PartialType(UpsertLessonDto) {}

export class UploadTicketDto {
  @IsString() fileName!: string;
  @IsString() contentType!: string;
  @IsInt() @Min(1) sizeBytes!: number;
}

export class CompleteAttachmentDto extends UploadTicketDto {
  @IsString() key!: string;
  @IsString() @MinLength(1) @MaxLength(200) title!: string;
  @IsOptional() @IsString() @MaxLength(200) titleEn?: string;
}
