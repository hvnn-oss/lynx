import {
  Column,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { UserAccountEntity } from "./user-account.entity";

@Entity("oidc-account")
@Index(["subject", "issuer"])
export class OidcAccountEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  issuer!: string;

  @Column()
  subject!: string;

  @Column({ nullable: true })
  accessToken?: string;

  @Column({ nullable: true })
  refreshToken?: string;

  @OneToOne(() => UserAccountEntity, (account) => account)
  @JoinColumn()
  userAccount!: UserAccountEntity;
}
