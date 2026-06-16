import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";

export class RegisterOrganizationDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  name!: string;
}

export class RequestRegisterDto {
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
  organization_info?: RegisterOrganizationDto;
}

export class ResponseRegisterDto {
  @IsNotEmpty()
  @IsBoolean()
  success!: boolean;
}
