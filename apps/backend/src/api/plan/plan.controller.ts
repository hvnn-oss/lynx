import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { PlanCodeParamDto } from '@repo/dto';
import type { PlanDetailDto, PlanSummaryDto } from '@repo/dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PlanService } from './plan.service';

@Controller('plan')
@UseGuards(JwtAuthGuard)
export class PlanController {
  constructor(private readonly planService: PlanService) {}

  @Get()
  async listPlans(): Promise<PlanSummaryDto[]> {
    return await this.planService.listPlans();
  }

  @Get(':code')
  async getPlan(@Param() params: PlanCodeParamDto): Promise<PlanDetailDto> {
    return await this.planService.getPlan(params.code);
  }
}
