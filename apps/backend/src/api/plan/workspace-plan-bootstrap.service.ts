import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { WorkspacePlanEntity } from '@repo/database';
import { DataSource } from 'typeorm';
import { DEFAULT_WORKSPACE_PLANS } from './default-workspace-plans';

@Injectable()
export class WorkspacePlanBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(WorkspacePlanBootstrapService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    const planRepository = this.dataSource.getRepository(WorkspacePlanEntity);
    let insertedCount = 0;

    for (const defaultPlan of DEFAULT_WORKSPACE_PLANS) {
      const existingPlan = await planRepository.findOne({
        where: { code: defaultPlan.code },
      });

      if (existingPlan) {
        continue;
      }

      await planRepository.save(
        Object.assign(new WorkspacePlanEntity(), defaultPlan),
      );
      insertedCount += 1;
    }

    if (insertedCount > 0) {
      this.logger.log(`Inserted ${insertedCount} missing workspace plans.`);
    }
  }
}
