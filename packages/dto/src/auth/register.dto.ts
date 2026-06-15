import { IsEmail, IsNotEmpty, MaxLength, MinLength } from "class-validator";

export class RegisterDto {
  @IsNotEmpty()
  @IsEmail()
  email!: string;

  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(20)
  password!: string;
}
