import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppDataSource } from '@repo/database';
import { PostgresConnectionCredentialsOptions } from 'typeorm/driver/postgres/PostgresConnectionCredentialsOptions.js';
import { AdminModule } from './api/admin/admin.module';
import { AgentModule } from './api/agent/agent.module';
import { AuthModule } from './api/auth/auth.module';
import { DashboardModule } from './api/dashboard/dashboard.module';
import { DebugModule } from './api/debug/debug.module';
import { DemoModule } from './api/demo/demo.module';
import { EventModule } from './api/event/event.module';
import { ObserveModule } from './api/observe/observe.module';
import { OrganizationModule } from './api/organization/organization.module';
import { PlanModule } from './api/plan/plan.module';
import { SessionModule } from './api/session/session.module';
import { WorkspaceModule } from './api/workspace/workspace.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RedisModule } from './providers/redis/redis.module';
import { MailerModule } from './providers/smtp/mail.module';

function parseBooleanEnv(
  value: string | boolean | undefined,
  fallback = false,
) {
  if (typeof value === 'boolean') return value;
  if (value === undefined) return fallback;
  return value.toLowerCase() === 'true';
}

function shouldEnableDemoModule() {
  const explicit = process.env.LYNX_DEMO_ENABLED;
  if (explicit !== undefined) {
    return parseBooleanEnv(explicit);
  }

  return process.env.NODE_ENV !== 'production';
}

@Module({
  imports: [
    ConfigModule.forRoot({
      // 앱 전역에서 환경 변수를 사용할 수 있게 설정합니다.
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    TypeOrmModule.forRootAsync({
      // DATABASE_URL이 있으면 우선 사용하고, 없으면 개별 DB 설정을 조합합니다.
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const dbUrl = configService.get<string>('DATABASE_URL');

        return {
          ...(AppDataSource.options as PostgresConnectionCredentialsOptions),
          type: 'postgres' as const,
          url: dbUrl,
          host: !dbUrl ? configService.get<string>('DB_HOST') : undefined,
          port: !dbUrl ? configService.get<number>('DB_PORT') : undefined,
          username: !dbUrl
            ? configService.get<string>('DB_USERNAME')
            : undefined,
          password: !dbUrl
            ? configService.get<string>('DB_PASSWORD')
            : undefined,
          database: !dbUrl
            ? configService.get<string>('DB_DATABASE')
            : undefined,
          autoLoadEntities: false,
          synchronize:
            configService.get<string>('NODE_ENV') === 'production'
              ? false
              : parseBooleanEnv(configService.get<string>('DB_SYNCHRONIZE')),
          logging: parseBooleanEnv(configService.get<string>('DB_LOGGING')),
        };
      },
    }),
    MailerModule,
    RedisModule,
    AuthModule,
    OrganizationModule,
    ScheduleModule.forRoot(),
    EventModule,
    ObserveModule,
    DashboardModule,
    DebugModule,
    ...(shouldEnableDemoModule() ? [DemoModule] : []),
    WorkspaceModule,
    SessionModule,
    AgentModule,
    PlanModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
