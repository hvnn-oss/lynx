import { ImageService } from "./image.service.js";
import type {
  ImageStorageProvider,
  ImageUrlProvider,
} from "./image-storage.provider.js";

describe("ImageService", () => {
  const storage: jest.Mocked<ImageStorageProvider> = {
    putObject: jest.fn(),
    deleteObject: jest.fn(),
  };
  const urls: ImageUrlProvider = {
    getUrl: (storageKey) => `https://images.example.com/${storageKey}`,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("프로필 이미지를 업로드하고 공개 URL을 반환한다", async () => {
    const service = new ImageService(storage, urls, 1024);

    const result = await service.upload({
      ownerType: "user",
      ownerId: "user-1",
      contentType: "image/png",
      bytes: new Uint8Array([1, 2, 3]),
    });

    expect(result.storageKey).toBe("profile-images/users/user-1/profile");
    expect(result.url).toBe(`https://images.example.com/${result.storageKey}`);
    expect(storage.putObject).toHaveBeenCalledWith({
      storageKey: result.storageKey,
      contentType: "image/png",
      bytes: new Uint8Array([1, 2, 3]),
      cacheControl: "public, max-age=300, must-revalidate",
    });
  });

  it("이미지 업데이트 시 같은 사용자의 기존 객체를 덮어쓴다", async () => {
    const service = new ImageService(storage, urls, 1024);
    const result = await service.update({
      ownerType: "user",
      ownerId: "user-1",
      currentStorageKey: "profile-images/users/user-1/previous.png",
      contentType: "image/webp",
      bytes: new Uint8Array([4, 5, 6]),
    });

    expect(result.storageKey).toBe("profile-images/users/user-1/previous.png");
    expect(storage.putObject).toHaveBeenCalledTimes(1);
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it("다른 사용자의 저장소 키는 삭제하지 않는다", async () => {
    const service = new ImageService(storage, urls, 1024);

    await expect(
      service.update({
        ownerType: "user",
        ownerId: "user-1",
        currentStorageKey: "profile-images/users/user-2/previous.png",
        contentType: "image/png",
        bytes: new Uint8Array([1]),
      }),
    ).rejects.toThrow("PROFILE_IMAGE_KEY_OWNER_MISMATCH");

    expect(storage.putObject).not.toHaveBeenCalled();
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it("지원하지 않는 형식과 최대 크기를 거부한다", async () => {
    const service = new ImageService(storage, urls, 2);

    await expect(
      service.upload({
        ownerType: "user",
        ownerId: "user-1",
        contentType: "image/svg+xml",
        bytes: new Uint8Array([1]),
      }),
    ).rejects.toThrow("PROFILE_IMAGE_TYPE_NOT_SUPPORTED");
    await expect(
      service.upload({
        ownerType: "user",
        ownerId: "user-1",
        contentType: "image/png",
        bytes: new Uint8Array([1, 2, 3]),
      }),
    ).rejects.toThrow("PROFILE_IMAGE_TOO_LARGE");
  });

  it("저장소 키가 없으면 공개 URL도 반환하지 않는다", () => {
    const service = new ImageService(storage, urls, 1024);

    expect(service.getUrl(null)).toBeNull();
    expect(service.getUrl("profile-images/users/user-1/image.png")).toBe(
      "https://images.example.com/profile-images/users/user-1/image.png",
    );
  });
});
