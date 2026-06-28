import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const secret =
          configService.get<string>('JWT_SECRET') ??
          configService.get<string>('JWT_ACCESS_SECRET');

        if (!secret) {
          throw new Error(
            'JWT_SECRET or JWT_ACCESS_SECRET must be configured.',
          );
        }

        return { secret };
      },
      inject: [ConfigService],
      global: true,
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
