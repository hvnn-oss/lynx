import { LOGIN_PROVIDERS, type LoginProviders } from "@repo/constants";
import {
  Column,
  Entity,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { UserEntity } from "../organization/user.entity";
import { OidcAccountEntity } from "./oidc-account.entity";

@Entity("user-account")
export class UserAccountEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", default: LOGIN_PROVIDERS.LOCAL })
  provider!: LoginProviders; // 로컬, SSO, OAuth 같은 로그인 제공자입니다.

  @Column({ nullable: true })
  providerAccountId?: string; // 외부 로그인 제공자의 사용자 고유 ID입니다.

  @Column({ nullable: true })
  passwordHash?: string; // 로컬 로그인 전용 비밀번호 해시입니다.

  @OneToOne(
    () => OidcAccountEntity,
    (oidc: OidcAccountEntity) => oidc.userAccount,
    {
      cascade: true,
    },
  )
  oidcAccount?: OidcAccountEntity;

  @ManyToOne(() => UserEntity, (user: UserEntity) => user.accounts, {
    onDelete: "CASCADE",
  })
  user!: UserEntity;
}
