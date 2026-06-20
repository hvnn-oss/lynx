import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

// 회원가입 시 생성할 조직 정보 DTO
export class RegisterOrganizationDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  name!: string;
}

// 회원가입 요청 DTO
export class SignUpDto {
  @IsNotEmpty()
  @IsUUID()
  token!: string;

  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(20)
  password!: string;

  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(10)
  name!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => RegisterOrganizationDto)
  organization_info?: RegisterOrganizationDto;
}

// 회원가입 응답 DTO
export class SignUpResponseDto {
  @IsNotEmpty()
  @IsBoolean()
  success!: boolean;
}
