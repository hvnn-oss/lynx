import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppDataSource } from '@repo/database';
import { AuthModule } from './api/auth/auth.module';
import { PostgresConnectionCredentialsOptions } from 'typeorm/driver/postgres/PostgresConnectionCredentialsOptions.js';
import { RedisModule } from './providers/redis/redis.module';
import { OrganizationModule } from './api/organization/organization.module';
import { MailerModule } from './providers/smtp/mail.module';
import { ScheduleModule } from '@nestjs/schedule';
import { EventModule } from './api/event/event.module';
import { ObserveModule } from './api/observe/observe.module';
import { DashboardModule } from './api/dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      // 글로벌 .env 주입
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    TypeOrmModule.forRootAsync({
      // 글로벌 db 주입
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
          synchronize: configService.get<boolean>('DB_SYNCHRONIZE'),
          logging: configService.get<boolean>('DB_LOGGING'),
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
