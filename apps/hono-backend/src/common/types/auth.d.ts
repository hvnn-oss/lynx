type AuthDataSource = Pick<DataSource, "getRepository" | "transaction">;
type SignupMailer = Pick<Transporter, "sendMail">;

/** Lynx에서 지원하는 사용자 인증 방식입니다. */
type AuthMethod = "password" | "saml" | "oidc";

/** 인증 공급자 검증을 마친 사용자 신원의 공통 표현입니다. */
interface AuthenticatedIdentity {
  method: AuthMethod;

  /**
   * OIDC: issuer
   * SAML: IdP Entity ID
   * Password: "lynx"
   */
  issuer: string;

  /**
   * OIDC: sub
   * SAML: NameID
   * Password: UserAccount ID
   */
  subject: string;

  userId: string;
  email: string | null;
  attributes: Record<string, unknown>;
}

/** 로그인 세션을 만들고 토큰을 발급하는 데 필요한 입력입니다. */
interface CompleteLoginInput {
  identity: AuthenticatedIdentity;

  /** SAML/OIDC 로그인에서 사용한 SSO 연결 ID */
  connectionId?: string;

  /** 로그인이 특정 워크스페이스에서 시작된 경우 사용 */
  expectedWorkspaceId?: string;

  ipAddress?: string;
  userAgent?: string;
}

/** Access Token에 포함할 사용자 및 세션 식별자입니다. */
interface AccessTokenPayload {
  userId: string;
  sessionId: string;
}

/**
 * Redis에 저장되는 로그인 세션 정보입니다.
 * Refresh Token 원문이 아닌 secret의 해시를 저장합니다.
 */
interface RefreshSession {
  sessionId: string;
  userId: string;
  secretHash: string;
  /** 직전에 사용한 secret의 해시로, 한 단계 이전 토큰의 재사용을 감지한다. */
  previousSecretHash?: string;
  createdAt: number;
  ipAddress?: string;
  userAgent?: string;
}
