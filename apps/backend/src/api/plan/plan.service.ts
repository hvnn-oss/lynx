import { Injectable, NotFoundException } from '@nestjs/common';
import { ERROR_CODES } from '@repo/constants';
import { WorkspacePlanEntity } from '@repo/database';
import type { PlanDetailDto, PlanSummaryDto } from '@repo/dto';
import { DataSource } from 'typeorm';

@Injectable()
export class PlanService {
  constructor(private readonly dataSource: DataSource) {}

  async listPlans(): Promise<PlanSummaryDto[]> {
    const plans = await this.dataSource
      .getRepository(WorkspacePlanEntity)
      .find({
        where: { isActive: true },
        order: { code: 'ASC' },
      });

    return plans.map((plan) => this.toPlanDto(plan));
  }

  async getPlan(code: string): Promise<PlanDetailDto> {
    const plan = await this.dataSource
      .getRepository(WorkspacePlanEntity)
      .findOne({ where: { code: code.toUpperCase(), isActive: true } });

    if (!plan) {
      throw new NotFoundException({
        error_code: ERROR_CODES.INVALID_INPUT,
        message: 'Plan not found.',
      });
    }

    return this.toPlanDto(plan);
  }

  private toPlanDto(plan: WorkspacePlanEntity): PlanSummaryDto {
    return {
      code: plan.code,
      name: plan.name,
      retentionDays: plan.retentionDays,
      monthlyEventLimit: plan.monthlyEventLimit,
      includedLogCount: plan.includedLogCount,
      logOverageUnitPrice: this.toOptionalNumber(plan.logOverageUnitPrice),
      features: plan.features,
      isActive: plan.isActive,
    };
  }

  private toOptionalNumber(
    value: number | string | undefined,
  ): number | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    return Number(value);
  }
}
