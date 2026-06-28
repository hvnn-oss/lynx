/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ERROR_CODES } from '@repo/constants';
import { json, urlencoded } from 'express';
import { ingestionRateLimit } from './common/middleware/ingestion-rate-limit.middleware';
import { securityHeaders } from './common/middleware/security-headers.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const bodyLimit = process.env.JSON_BODY_LIMIT ?? '2mb';

  app.enableCors({
    origin:
      process.env.CORS_ORIGIN?.split(',').map((origin) => origin.trim()) ??
      true,
    credentials: true,
  });
  app.use(securityHeaders);
  app.use(ingestionRateLimit());
  app.use(json({ limit: bodyLimit }));
  app.use(
    urlencoded({
      extended: true,
      limit: bodyLimit,
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      exceptionFactory: (validationErrors) => {
        const result = validationErrors.map((error) => {
          const constraints = error.constraints;
          if (!constraints) {
            return {
              field: error.property,
              error_code: ERROR_CODES.COULD_NOT_VALIDATE_INPUT,
              message: 'Unknown exception occured.',
            };
          }
          const firstKey = Object.keys(constraints)[0];
          const rawMessage = constraints[firstKey];

          try {
            // DTO에서 정의한 JSON 문자열을 객체로 파싱합니다.
            const customError: {
              error_code: string;
              message: string;
            } = JSON.parse(rawMessage);
            return {
              field: error.property,
              error_code: customError.error_code,
              message: customError.message,
            };
          } catch {
            // 만약 JSON 파싱이 안 되는 기본 에러 문구라면 예외 처리
            return {
              field: error.property,
              error_code: ERROR_CODES.INVALID_INPUT,
              message: rawMessage,
            };
          }
        });

        // 400 Bad Request 응답으로 커스텀 에러 배열을 반환합니다.
        return new BadRequestException({ errors: result });
      },
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
