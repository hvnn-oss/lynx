import { DataSource } from "typeorm";
import { UserEntity } from "./entities/User.entity";

export const AppDataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  synchronize: false, // 안정성을 위해 false 권장 (마이그레이션 필수)
  logging: process.env.NODE_ENV !== "production",
  entities: [UserEntity],
  migrations: [__dirname + "/migrations/*.ts"],
  subscribers: [],
});
