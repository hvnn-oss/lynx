import { Module } from '@nestjs/common';
import { WorkspaceAccessService } from '../../common/services/workspace-access.service';
import { DebugController } from './debug.controller';
import { DebugService } from './debug.service';

@Module({
  controllers: [DebugController],
  providers: [WorkspaceAccessService, DebugService],
})
export class DebugModule {}
