import { Module } from '@nestjs/common';
import { WorkspaceAccessService } from '../../common/services/workspace-access.service';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';

@Module({
  controllers: [AgentController],
  providers: [WorkspaceAccessService, AgentService],
})
export class AgentModule {}
