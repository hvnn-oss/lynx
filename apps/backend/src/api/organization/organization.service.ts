import { Injectable, NotFoundException } from '@nestjs/common';
import { OrganizationEntity } from '@repo/database';
import { DataSource } from 'typeorm';
import { ERROR_CODES } from '@repo/constants';

export class UpdateSsoSettingsDto {
  useSso?: boolean;
  forceSSO?: boolean;
  oidcClientId?: string;
  oidcClientSecret?: string;
  oidcIssuer?: string;
  samlEntryPoint?: string;
  samlIssuer?: string;
  samlCert?: string;
}

@Injectable()
export class OrganizationService {
  constructor(private readonly dataSource: DataSource) {}

  // 조직의 SSO 연동 설정을 조회합니다.
  async getSsoSettings(orgId: string) {
    const orgRepository = this.dataSource.getRepository(OrganizationEntity);
    const org = await orgRepository.findOne({
      where: { id: orgId },
    });
    if (!org) {
      throw new NotFoundException({
        error_code: ERROR_CODES.ORG_NOT_FOUND,
        message: 'Organization not found',
      });
    }
    return {
      useSso: org.useSso,
      forceSSO: org.forceSSO,
      oidcClientId: org.oidcClientId,
      oidcClientSecret: org.oidcClientSecret,
      oidcIssuer: org.oidcIssuer,
      samlEntryPoint: org.samlEntryPoint,
      samlIssuer: org.samlIssuer,
      samlCert: org.samlCert,
    };
  }

  // 조직의 SSO 연동 설정을 저장 및 갱신합니다.
  async updateSsoSettings(orgId: string, settings: UpdateSsoSettingsDto) {
    const orgRepository = this.dataSource.getRepository(OrganizationEntity);
    const org = await orgRepository.findOne({
      where: { id: orgId },
    });
    if (!org) {
      throw new NotFoundException({
        error_code: ERROR_CODES.ORG_NOT_FOUND,
        message: 'Organization not found',
      });
    }

    if (settings.useSso !== undefined) org.useSso = settings.useSso;
    if (settings.forceSSO !== undefined) org.forceSSO = settings.forceSSO;
    if (settings.oidcClientId !== undefined)
      org.oidcClientId = settings.oidcClientId;
    if (settings.oidcClientSecret !== undefined)
      org.oidcClientSecret = settings.oidcClientSecret;
    if (settings.oidcIssuer !== undefined) org.oidcIssuer = settings.oidcIssuer;
    if (settings.samlEntryPoint !== undefined)
      org.samlEntryPoint = settings.samlEntryPoint;
    if (settings.samlIssuer !== undefined) org.samlIssuer = settings.samlIssuer;
    if (settings.samlCert !== undefined) org.samlCert = settings.samlCert;

    await orgRepository.save(org);
    return { success: true };
  }
}
