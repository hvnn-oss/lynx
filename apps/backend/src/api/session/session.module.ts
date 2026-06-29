import { Module } from '@nestjs/common';
import { WorkspaceAccessService } from '../../common/services/workspace-access.service';
import { SessionController } from './session.controller';
import { SessionService } from './session.service';

@Module({
  controllers: [SessionController],
  providers: [WorkspaceAccessService, SessionService],
})
export class SessionModule {}
