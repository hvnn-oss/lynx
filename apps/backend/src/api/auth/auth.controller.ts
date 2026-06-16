import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  RequestRegisterDto,
  RequestVerifyCodeDto,
  RequestVerifyEmailDto,
} from '@repo/dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/signup/create-verify')
  async createVerify(@Body() createVerifyDto: RequestVerifyCodeDto) {
    return await this.authService.createEmailVerify(createVerifyDto);
  }

  @Post('/signup/verify')
  async verify(@Body() requestVerifyEmailDto: RequestVerifyEmailDto) {
    return await this.authService.verifyEmail(requestVerifyEmailDto);
  }

  @Post('/signup')
  async signup(@Body() requestRegisterDto: RequestRegisterDto) {
    return await this.authService.register(requestRegisterDto);
  }
}
