import { IsBoolean, IsEmail, IsNotEmpty, IsUUID } from "class-validator";

export class RequestVerifyCodeDto {
  @IsNotEmpty()
  @IsEmail()
  email!: string;

  @IsNotEmpty()
  @IsUUID()
  invited_organization_id?: string;
}

export class ResponseVerifyCodeDto {
  @IsBoolean()
  success!: boolean;
}

export class RequestVerifyEmailDto {
  @IsNotEmpty()
  @IsUUID()
  token!: string;
}

export class ResponseVerifyEmailDto {
  @IsBoolean()
  success!: boolean;
}
