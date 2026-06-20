import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationService } from './organization.service';
import { DataSource } from 'typeorm';

describe('OrganizationService', () => {
  let service: OrganizationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrganizationService, { provide: DataSource, useValue: {} }],
    }).compile();

    service = module.get<OrganizationService>(OrganizationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
