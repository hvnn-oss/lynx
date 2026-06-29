import { Module } from '@nestjs/common';
import { WorkspaceAccessService } from '../../common/services/workspace-access.service';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  controllers: [DashboardController],
  providers: [WorkspaceAccessService, DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
