import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Prisma } from '../../generated/prisma/client';

/**
 * Converts every thrown error into a consistent JSON shape with an Arabic
 * message the UI can show directly.
 *
 * Unexpected errors are logged with their stack but reported to the client as
 * a generic message — internal details (SQL, file paths, constraint names)
 * never reach the browser.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'حصل خطأ غير متوقع، حاول تاني';
    let code: string | undefined;
    let retryAfterSeconds: number | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const payload = body as {
          message?: string | string[];
          error?: string;
          code?: string;
          retryAfterSeconds?: number;
        };
        message = payload.message ?? exception.message;
        code = payload.code ?? payload.error;
        retryAfterSeconds = payload.retryAfterSeconds;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      ({ status, message, code } = this.translatePrismaError(exception));
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'البيانات المرسلة غير صحيحة';
      code = 'VALIDATION_ERROR';
    }

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    if (status === HttpStatus.TOO_MANY_REQUESTS && retryAfterSeconds) {
      response.setHeader('Retry-After', Math.ceil(retryAfterSeconds));
    }

    response.status(status).json({
      statusCode: status,
      message,
      ...(code ? { code } : {}),
      ...(retryAfterSeconds ? { retryAfterSeconds } : {}),
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private translatePrismaError(error: Prisma.PrismaClientKnownRequestError): {
    status: number;
    message: string;
    code: string;
  } {
    switch (error.code) {
      case 'P2002':
        return {
          status: HttpStatus.CONFLICT,
          message: 'البيانات دي مسجلة عندنا قبل كده',
          code: 'DUPLICATE',
        };
      case 'P2003':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'في بيانات مرتبطة ناقصة أو غير صحيحة',
          code: 'FOREIGN_KEY',
        };
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          message: 'العنصر المطلوب غير موجود',
          code: 'NOT_FOUND',
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'حصل خطأ في قاعدة البيانات',
          code: 'DATABASE_ERROR',
        };
    }
  }
}
