export interface AccessTokenPayload {
  sub: string;
  iat: number;
  exp: number;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  exp: number;
}
