import { Module } from '@nestjs/common';
import { PlanController } from './plan.controller';
import { PlanService } from './plan.service';
import { WorkspacePlanBootstrapService } from './workspace-plan-bootstrap.service';

@Module({
  controllers: [PlanController],
  providers: [PlanService, WorkspacePlanBootstrapService],
})
export class PlanModule {}
