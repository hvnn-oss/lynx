import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  RequestRegisterDto,
  RequestVerifyCodeDto,
  RequestVerifyEmailDto,
  ResponseRegisterDto,
  ResponseVerifyCodeDto,
  ResponseVerifyEmailDto,
} from '@repo/dto';
import {
  OrganizationDomainEntity,
  OrganizationEntity,
  OrganizationUserEntity,
  UserAccountEntity,
  UserEntity,
} from '@repo/database';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { REDIS_CLIENT } from '../../providers/redis/redis.constants';
import { MailerService } from '../../providers/smtp/mail.service';
import Redis from 'ioredis';
import * as bcrypt from 'bcrypt';
import {
  AccessTokenPayload,
  BCRYPT_SALT_ROUNDS,
  ERROR_CODES,
  LOGIN_PROVIDERS,
  RefreshTokenPayload,
} from '@repo/constants';
import ms, { StringValue } from 'ms';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private readonly jwtService: JwtService,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly mailService: MailerService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  // =====================================================
  // 회원가입
  // =====================================================

  /**
   * 이메일 인증 URL을 생성합니다.
   * @param requestEmailVerifyDto 인증 URL 생성에 필요한 정보를 입력받습니다.
   * @returns 결과를 리턴합니다.
   */
  async createEmailVerify(
    requestVerifyCodeDto: RequestVerifyCodeDto,
  ): Promise<ResponseVerifyCodeDto> {
    const domainRepository = this.dataSource.getRepository(
      OrganizationDomainEntity,
    );

    const emailParts = requestVerifyCodeDto.email.split('@');
    if (emailParts.length !== 2) {
      throw new BadRequestException({
        error_code: ERROR_CODES.INVALID_EMAIL,
        message: 'Invalid email.',
      });
    }
    const emailDomain = emailParts[1];

    // 조직 전용 이메일 여부 확인
    const foundDomain = await domainRepository.findOne({
      where: { domain: emailDomain },
      relations: { organization: true },
    });
    if (foundDomain && foundDomain.organization.useSso) {
      throw new ForbiddenException({
        error_code: ERROR_CODES.ORG_ALREADY_USING_SSO,
        message: `This organization is currently using sso options. Please sign in with sso.`,
      });
    }

    // 사용자 존재 여부 확인
    const userRepository = this.dataSource.getRepository(UserEntity);
    const existsUser = await userRepository.findOneBy({
      email: requestVerifyCodeDto.email,
    });
    if (existsUser) {
      throw new ConflictException({
        error_code: ERROR_CODES.USER_ALREADY_EXISTS,
        message: 'User already exists.',
      });
    }

    // 인증 토큰 생성 및 저장
    const token = crypto.randomUUID();
    const verifyCodeOptions = {
      email: requestVerifyCodeDto.email,
      domain: requestVerifyCodeDto.email.split('@')[1],
      email_verified: false,
      invited_organization: requestVerifyCodeDto.invited_organization_id,
    };
    await this.redis.set(
      `signup:stage:${token}`,
      JSON.stringify(verifyCodeOptions),
      'EX',
      60 * 30,
    );

    //이메일 전송
    await this.mailService.sendMail(
      requestVerifyCodeDto.email,
      'Verify Your Email',
      `Verify URL : https://${this.configService.get('FRONTEND_URL')}/signup/verify?token=${token}`,
    );

    return {
      success: true,
    };
  }

  /**
   * 이메일 인증을 진행 후 인증 만료 시간을 10분으로 변경합니다
   * @param verifyEmailDto 인증에 필요한 토큰을 입력받습니다.
   * @returns 결과를 리턴합니다.
   */
  async verifyEmail(
    verifyEmailDto: RequestVerifyEmailDto,
  ): Promise<ResponseVerifyEmailDto> {
    // 인증 정보 받아오기
    const rawData = await this.redis.get(
      `signup:stage:${verifyEmailDto.token}`,
    );
    if (!rawData) {
      throw new NotFoundException({
        error_code: ERROR_CODES.INVALID_SIGNUP_TOKEN,
        message: 'Unexpected token.',
      });
    }
    const signUpInfo = JSON.parse(rawData) as {
      email: string;
      domain: string;
      email_verified: boolean;
      invited_organization?: string;
    };

    // 인증 여부 및 만료 시간 설정
    signUpInfo.email_verified = true;

    await this.redis.set(
      `signup:stage:${verifyEmailDto.token}`,
      JSON.stringify(signUpInfo),
      'EX',
      60 * 10,
    );

    return {
      success: true,
    };
  }

  /**
   * 이메일 인증 여부를 확인하고 사용자를 생성합니다
   * @param registerDto 사용자 생성을 위한 정보입니다.
   * @returns 사용자 생성 결과를 리턴합니다.
   */
  async register(
    registerDto: RequestRegisterDto,
  ): Promise<ResponseRegisterDto> {
    const domainRepository = this.dataSource.getRepository(
      OrganizationDomainEntity,
    );

    // 인증 정보 받아오기
    const rawData = await this.redis.get(`signup:stage:${registerDto.token}`);
    if (!rawData) {
      throw new NotFoundException({
        error_code: ERROR_CODES.INVALID_SIGNUP_TOKEN,
        message: 'Unexpected token.',
      });
    }
    const signUpInfo = JSON.parse(rawData) as {
      email: string;
      domain: string;
      email_verified: boolean;
      invited_organization?: string;
    };
    if (!signUpInfo.invited_organization && !registerDto.organization_info)
      throw new ConflictException({
        error_code: ERROR_CODES.INVALID_ORG,
        message: 'Invalid organization informations',
      });

    // 인증 여부 및 정보 검토
    if (!signUpInfo.email_verified)
      throw new ForbiddenException({
        error_code: ERROR_CODES.EMAIL_NOT_VERIFIED,
        message: 'Not verified email. check your email and try again.',
      });
    const foundDomain = await domainRepository.findOne({
      where: {
        domain: signUpInfo.domain,
      },
      relations: {
        organization: true,
      },
    });
    if (foundDomain && foundDomain?.organization?.useSso) {
      throw new ConflictException({
        error_code: ERROR_CODES.ORG_ALREADY_USING_SSO,
        message:
          'This organization is currently using sso options. Please sign in with sso.',
      });
    }

    // 로컬 로그인 유저 생성 트랜잭션
    await this.dataSource.transaction(async (entityManager) => {
      const userRepository = entityManager.getRepository(UserEntity);
      const userAccountRepositoy =
        entityManager.getRepository(UserAccountEntity);
      const orgRepository = entityManager.getRepository(OrganizationEntity);
      const orgUserRepository = entityManager.getRepository(
        OrganizationUserEntity,
      );

      let organization: OrganizationEntity;
      if (signUpInfo.invited_organization) {
        const foundOrg = await orgRepository.findOneBy({
          id: signUpInfo.invited_organization,
        });
        if (!foundOrg)
          throw new ConflictException({
            error_code: ERROR_CODES.ORG_NOT_FOUND,
            message: "Couldn't find organization",
          });
        organization = foundOrg;
      } else {
        organization = orgRepository.create({
          name: registerDto.organization_info?.name,
        });
        await orgRepository.save(organization);
      }
      const currentDate = new Date();
      const salt = await bcrypt.genSalt(BCRYPT_SALT_ROUNDS);
      const hashedPassword = await bcrypt.hash(registerDto.password, salt);
      const user = userRepository.create({
        email: signUpInfo.email,
        name: registerDto.name,
        createdAt: currentDate,
        organizations: [organization],
      });
      await userRepository.save(user);
      const userAccount = userAccountRepositoy.create({
        provider: LOGIN_PROVIDERS.LOCAL,
        passwordHash: hashedPassword,
        user,
      });
      await userAccountRepositoy.save(userAccount);
      const orgUser = orgUserRepository.create({
        joinedAt: currentDate,
        role: 'OWNER',
        organization,
        user,
      });
      await orgUserRepository.save(orgUser);
    });

    // 기존 인증 정보 삭제
    await this.redis.del(`signup:stage:${registerDto.token}`);
    return {
      success: true,
    };
  }

  // =====================================================
  // 토큰 관리
  // =====================================================
  async generateAccessToken(userId: string) {
    const exp_time = this.configService.get<string>('JWT_ACCESS_EXPIRES_IN');
    if (!exp_time) throw new InternalServerErrorException();
    const nowInSeconds = Math.floor(Date.now() / 1000);
    const expInSeconds =
      nowInSeconds + Math.floor(ms(exp_time as StringValue) / 1000);
    const payload: AccessTokenPayload = {
      sub: userId,
      iat: nowInSeconds,
      exp: expInSeconds,
    };
    const newToken = await this.jwtService.signAsync(payload);
    return newToken;
  }

  async generateRefreshToken(userId: string) {
    const exp_time = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN');
    if (!exp_time) throw new InternalServerErrorException();
    const nowInSeconds = Math.floor(Date.now() / 1000);
    const expInSeconds =
      nowInSeconds + Math.floor(ms(exp_time as StringValue) / 1000);
    const jti = crypto.randomUUID();
    const payload: RefreshTokenPayload = {
      sub: userId,
      jti,
      exp: expInSeconds,
    };
    const newToken = await this.jwtService.signAsync(payload, {
      expiresIn: exp_time as StringValue,
    });
    await this.redis.set(`refresh:${userId}`, jti);
    return newToken;
  }
}
