import {
  Column,
  Entity,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { UserEntity } from "../organization/user.entity";
import { OidcAccountEntity } from "./oidc-account.entity";
import { LOGIN_PROVIDERS, type LoginProviders } from "@repo/constants";

@Entity("user-account")
export class UserAccountEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", default: LOGIN_PROVIDERS.LOCAL })
  provider!: LoginProviders; // sso, oauth 등 지원을 위한 프로바이더

  @Column({ nullable: true })
  providerAccountId?: string; // 외부 서비스 사용자의 고유 아이디

  @Column({ nullable: true })
  passwordHash?: string; // 로컬 로그인 전용 비밀번호 해시

  @OneToOne(() => OidcAccountEntity, (oidc) => oidc.userAccount, {
    cascade: true,
  })
  oidcAccount?: OidcAccountEntity;

  @ManyToOne(() => UserEntity, (user) => user.accounts, { onDelete: "CASCADE" })
  user!: UserEntity;
}
