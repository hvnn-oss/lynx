/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST') || '',
      port: this.configService.get<number>('SMTP_PORT') || 587,
      secure: this.configService.get<boolean>('SMTP_SECURE') || false,
      auth: {
        user: this.configService.get<string>('SMTP_USER') || '',
        pass: this.configService.get<string>('SMTP_PASSWORD') || '',
      },
      tls: {
        rejectUnauthorized:
          this.configService.get<string>('NODE_ENV') === 'production',
      },
    });
  }

  async sendMail(to: string, subject: string, html: string) {
    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('SMTP_FROM_EMAIL'),
        to,
        subject,
        html,
      });
      this.logger.log(`Successfully sent mail to : ${to}`);
      return true;
    } catch (error) {
      this.logger.error('Failed to send mail :', error);
      return false;
    }
  }
}
