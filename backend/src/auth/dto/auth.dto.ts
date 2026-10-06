import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  Validate,
  ValidateIf,
  ValidatorConstraint,
  type ValidationArguments,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { EducationSystem, GradeLevel, StudentType } from '../../generated/prisma/enums';
import { normalizeEgyptianPhone } from '../../common/utils/phone.util';

/**
 * Normalises a phone field before validation, so `+20 101 234 5678`,
 * `٠١٠١٢٣٤٥٦٧٨` and `01012345678` all reach the database in one shape.
 */
const NormalizePhone = () =>
  Transform(({ value }) =>
    typeof value === 'string' ? (normalizeEgyptianPhone(value) ?? value) : value,
  );

@ValidatorConstraint({ name: 'isEgyptianPhone', async: false })
class IsEgyptianPhoneConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && normalizeEgyptianPhone(value) !== null;
  }

  defaultMessage(args: ValidationArguments): string {
    return args.property === 'parentPhone'
      ? 'رقم ولي الأمر لازم يكون رقم موبايل مصري صحيح (مثال: 01012345678)'
      : 'رقم الموبايل لازم يكون رقم مصري صحيح (مثال: 01012345678)';
  }
}

/** The grades that are legitimately reachable from each educational system. */
export const GRADES_BY_SYSTEM: Record<EducationSystem, GradeLevel[]> = {
  [EducationSystem.GENERAL]: [GradeLevel.SEC_1, GradeLevel.SEC_2, GradeLevel.SEC_3],
  [EducationSystem.BACC]: [GradeLevel.BACC_1, GradeLevel.BACC_2],
};

@ValidatorConstraint({ name: 'gradeMatchesSystem', async: false })
class GradeMatchesSystemConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    const system = (args.object as RegisterDto).educationSystem;
    if (!system || !(system in GRADES_BY_SYSTEM)) return false;
    return GRADES_BY_SYSTEM[system].includes(value as GradeLevel);
  }

  defaultMessage(args: ValidationArguments): string {
    const system = (args.object as RegisterDto).educationSystem;
    return system === EducationSystem.BACC
      ? 'الصف المختار مش من صفوف البكالوريا المصرية'
      : 'الصف المختار مش من صفوف الثانوية العامة';
  }
}

export class RegisterDto {
  @IsOptional()
  @IsEnum(StudentType)
  studentType?: StudentType;
  @ApiProperty({ example: 'أحمد محمد علي', description: 'الاسم الكامل' })
  @IsString()
  @IsNotEmpty({ message: 'الاسم مطلوب' })
  @MinLength(3, { message: 'الاسم لازم يكون 3 حروف على الأقل' })
  @MaxLength(80, { message: 'الاسم طويل أوي' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value))
  fullName!: string;

  @ApiProperty({ example: 'ahmed.mohamed', description: 'اسم المستخدم' })
  @IsString()
  @IsNotEmpty({ message: 'اسم المستخدم مطلوب' })
  @MinLength(4, { message: 'اسم المستخدم لازم يكون 4 حروف على الأقل' })
  @MaxLength(32, { message: 'اسم المستخدم طويل أوي' })
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message: 'اسم المستخدم يقبل حروف إنجليزية وأرقام و . _ - بس',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  username!: string;

  @ApiProperty({ example: '123456', minLength: 6 })
  @IsString()
  @MinLength(6, { message: 'كلمة السر لازم تكون 6 خانات على الأقل' })
  @MaxLength(128, { message: 'كلمة السر طويلة أوي' })
  password!: string;

  @ApiProperty({ example: '01012345678', description: 'رقم موبايل الطالب' })
  @NormalizePhone()
  @Validate(IsEgyptianPhoneConstraint)
  phone!: string;

  @ApiProperty({ example: '01112345678', description: 'رقم موبايل ولي الأمر' })
  @NormalizePhone()
  @Validate(IsEgyptianPhoneConstraint)
  parentPhone!: string;

  @ApiProperty({ enum: EducationSystem, example: EducationSystem.GENERAL })
  @IsEnum(EducationSystem, { message: 'اختار النظام التعليمي' })
  educationSystem!: EducationSystem;

  @ApiProperty({ enum: GradeLevel, example: GradeLevel.SEC_1 })
  @IsEnum(GradeLevel, { message: 'اختار صفك الدراسي' })
  @ValidateIf((dto: RegisterDto) => Boolean(dto.educationSystem))
  @Validate(GradeMatchesSystemConstraint)
  gradeLevel!: GradeLevel;
}

export class LoginDto {
  @ApiProperty({
    example: 'ahmed.mohamed',
    description: 'اسم المستخدم أو رقم الموبايل',
  })
  @IsString()
  @IsNotEmpty({ message: 'اكتب اسم المستخدم أو رقم الموبايل' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  identifier!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'اكتب كلمة السر' })
  password!: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'اكتب كلمة السر الحالية' })
  currentPassword!: string;

  @ApiProperty({ minLength: 6 })
  @IsString()
  @MinLength(6, { message: 'كلمة السر الجديدة لازم تكون 6 خانات على الأقل' })
  @MaxLength(128)
  newPassword!: string;
}

export class RequestPasswordResetDto {
  @ApiProperty({ example: '01012345678' })
  @NormalizePhone()
  @Validate(IsEgyptianPhoneConstraint)
  phone!: string;
}

export class ConfirmPasswordResetDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'كود إعادة التعيين مطلوب' })
  @Matches(/^[A-Za-z0-9_-]{43}$/, { message: 'جلسة إعادة التعيين غير صالحة' })
  token!: string;

  @ApiProperty({ minLength: 6 })
  @IsString()
  @MinLength(6, { message: 'كلمة السر لازم تكون 6 خانات على الأقل' })
  @MaxLength(128)
  newPassword!: string;
}

export class OtpChallengeDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/, { message: 'جلسة التحقق غير صالحة' })
  challengeId!: string;
}

export class VerifyOtpDto extends OtpChallengeDto {
  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.trim().replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
      : value,
  )
  @Matches(/^\d{6}$/, { message: 'اكتب كود التحقق المكوّن من ٦ أرقام' })
  code!: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'أحمد محمد علي' })
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'الاسم لازم يكون 3 حروف على الأقل' })
  @MaxLength(80)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value))
  fullName?: string;

  @ApiPropertyOptional({ example: '01112345678' })
  @IsOptional()
  @NormalizePhone()
  @Validate(IsEgyptianPhoneConstraint)
  parentPhone?: string;
}
