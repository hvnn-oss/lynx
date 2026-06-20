import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsUUID,
} from "class-validator";

export class RequestVerifyCodeDto {
  @IsNotEmpty()
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsUUID()
  invited_organization_id?: string;
}

export class ResponseVerifyCodeDto {
  @IsNotEmpty()
  @IsBoolean()
  success!: boolean;
}

export class RequestVerifyEmailDto {
  @IsNotEmpty()
  @IsUUID()
  token!: string;
}

export class ResponseVerifyEmailDto {
  @IsNotEmpty()
  @IsBoolean()
  success!: boolean;

  @IsNotEmpty()
  @IsEmail()
  email!: string;
}
