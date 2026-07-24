import { createTransport } from "nodemailer";
import { env } from "../../common/config/config.js";

/** 회원가입 확인 메일을 전송하는 공용 SMTP transport입니다. */
export const smtpTransporter = createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  auth: {
    user: env.SMTP_USERNAME,
    pass: env.SMTP_PASSWORD,
  },
  secure: env.SMTP_SECURE,
  from: env.SMTP_FROM_EMAIL,
});
