import { Module } from '@nestjs/common';
import { DashboardModule } from '../dashboard/dashboard.module';
import { DemoController } from './demo.controller';

@Module({
  imports: [DashboardModule],
  controllers: [DemoController],
})
export class DemoModule {}
