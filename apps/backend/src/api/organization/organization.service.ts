import { Injectable } from '@nestjs/common';
import { OrganizationDomainEntity, OrganizationEntity } from '@repo/database';
import { DataSource } from 'typeorm';

@Injectable()
export class OrganizationService {
  constructor(private readonly dataSource: DataSource) {}

  async findOrgWithDomain() {
    const orgDomainRepository = this.dataSource.getRepository(
      OrganizationDomainEntity,
    );
    const found = orgDomainRepository.findOne({
      where: {
        domain: '',
      },
      relations: {
        organization: true,
      },
    });
  }
}
