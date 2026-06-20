import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsUUID,
} from "class-validator";

// 이메일 인증 메일 발송 요청 DTO
export class CreateEmailVerificationDto {
  @IsNotEmpty()
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsUUID()
  invited_organization_id?: string;
}

// 이메일 인증 메일 발송 응답 DTO
export class CreateEmailVerificationResponseDto {
  @IsNotEmpty()
  @IsBoolean()
  success!: boolean;
}

// 이메일 가입 링크 검증 요청 DTO
export class VerifyEmailTokenDto {
  @IsNotEmpty()
  @IsUUID()
  token!: string;
}

// 이메일 가입 링크 검증 응답 DTO
export class VerifyEmailTokenResponseDto {
  @IsNotEmpty()
  @IsBoolean()
  success!: boolean;

  @IsNotEmpty()
  @IsEmail()
  email!: string;
}
