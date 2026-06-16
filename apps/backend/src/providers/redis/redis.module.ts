import { Module, Global, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

const redisProvider: Provider = {
  provide: REDIS_CLIENT,
  useFactory: (configService: ConfigService) => {
    const host = configService.get<string>('REDIS_HOST', '127.0.0.1');
    const port = configService.get<number>('REDIS_PORT', 6379);
    const password = configService.get<string>('REDIS_PASSWORD');

    return new Redis({
      host,
      port,
      password,
      // 온프레미스/클라우드 환경 공통 순단 대비 재연결 전략
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });
  },
  inject: [ConfigService],
};

@Global() // 전역 모듈로 선언하여 api/auth 등에서 바로 주입받을 수 있게 함
@Module({
  providers: [redisProvider],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
