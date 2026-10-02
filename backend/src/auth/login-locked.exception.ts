import { HttpException, HttpStatus } from '@nestjs/common';

export class LoginLockedException extends HttpException {
  constructor(readonly retryAfterSeconds: number) {
    const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
    super(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        code: 'LOGIN_TEMPORARILY_LOCKED',
        message: `تم إيقاف محاولات الدخول مؤقتًا لحماية الحساب. حاول بعد ${minutes} دقيقة.`,
        retryAfterSeconds,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
