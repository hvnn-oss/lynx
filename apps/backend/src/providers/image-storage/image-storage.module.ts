import { Global, Module, Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { IMAGE_STORAGE_SERVICE } from './image-storage.constants';
import { S3ImageStorageService } from './s3-image-storage.service';

const imageStorageProvider: Provider = {
  provide: IMAGE_STORAGE_SERVICE,
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    const provider =
      configService.get<string>('IMAGE_STORAGE_PROVIDER') ?? 's3';

    if (provider !== 's3') {
      throw new Error(`Unsupported image storage provider: ${provider}`);
    }

    return new S3ImageStorageService(configService);
  },
};

@Global()
@Module({
  imports: [ConfigModule],
  providers: [imageStorageProvider],
  exports: [IMAGE_STORAGE_SERVICE],
})
// 앱 코드는 IMAGE_STORAGE_SERVICE만 주입받고, 실제 저장소는 여기서 고릅니다.
export class ImageStorageModule {}
