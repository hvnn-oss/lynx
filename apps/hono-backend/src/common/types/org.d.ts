/** 조직 생성 정책을 평가하고 저장할 서비스 입력입니다. */
export type CreateOrganizationInput = {
  userId: string;
  name: string;
  requestId: string;
  source: OrganizationCreationSource;
  planId?: string;
};

/** 조직과 소유자 멤버십, 생성 이력을 함께 저장할 입력입니다. */
export type CreateOrganizationRecordInput = {
  userId: string;
  name: string;
  requestId: string;
  source: OrganizationCreationSource;
  dayStartedAt: Date;
  planId?: string;
};
