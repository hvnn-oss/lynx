import { Module } from '@nestjs/common';
import { ObserveController } from './observe.controller';
import { ObserveService } from './observe.service';
import { WorkspaceAccessService } from '../../common/services/workspace-access.service';

@Module({
  controllers: [ObserveController],
  providers: [ObserveService, WorkspaceAccessService],
  exports: [ObserveService],
})
export class ObserveModule {}
