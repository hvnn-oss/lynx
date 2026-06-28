import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
} from "class-validator";

// 로그인 요청 DTO
export class LoginDto {
  @IsNotEmpty()
  @IsEmail()
  email!: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  password!: string;
}

// 로그인 응답 DTO
export class LoginResponseDto {
  @IsNotEmpty()
  @IsBoolean()
  success!: boolean;

  @IsNotEmpty()
  @IsString()
  accessToken!: string;
}
