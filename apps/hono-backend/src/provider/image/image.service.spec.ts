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

  it("프로필 이미지를 고유한 키로 업로드하고 공개 URL을 반환한다", async () => {
    const service = new ImageService(storage, urls, 1024, () => "image-id");

    const result = await service.upload({
      ownerType: "user",
      ownerId: "user-1",
      contentType: "image/png",
      bytes: new Uint8Array([1, 2, 3]),
    });

    expect(result.storageKey).toBe("profile-images/users/user-1/image-id.png");
    expect(result.url).toBe(`https://images.example.com/${result.storageKey}`);
    expect(storage.putObject).toHaveBeenCalledWith({
      storageKey: result.storageKey,
      contentType: "image/png",
      bytes: new Uint8Array([1, 2, 3]),
      cacheControl: "public, max-age=300, must-revalidate",
    });
  });

  it("새 이미지를 저장한 후 같은 사용자의 기존 객체를 삭제한다", async () => {
    const service = new ImageService(
      storage,
      urls,
      1024,
      () => "replacement-id",
    );
    const result = await service.update({
      ownerType: "user",
      ownerId: "user-1",
      currentStorageKey: "profile-images/users/user-1/previous.png",
      contentType: "image/webp",
      bytes: new Uint8Array([4, 5, 6]),
    });

    expect(result.storageKey).toBe(
      "profile-images/users/user-1/replacement-id.webp",
    );
    expect(storage.putObject).toHaveBeenCalledTimes(1);
    expect(storage.deleteObject).toHaveBeenCalledWith(
      "profile-images/users/user-1/previous.png",
    );
    expect(storage.putObject.mock.invocationCallOrder[0]).toBeLessThan(
      storage.deleteObject.mock.invocationCallOrder[0]!,
    );
  });

  it("새 이미지 저장에 실패하면 기존 객체를 삭제하지 않는다", async () => {
    storage.putObject.mockRejectedValueOnce(new Error("IMAGE_UPLOAD_FAILED"));
    const service = new ImageService(
      storage,
      urls,
      1024,
      () => "replacement-id",
    );

    await expect(
      service.update({
        ownerType: "user",
        ownerId: "user-1",
        currentStorageKey: "profile-images/users/user-1/previous.png",
        contentType: "image/png",
        bytes: new Uint8Array([1]),
      }),
    ).rejects.toThrow("IMAGE_UPLOAD_FAILED");

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

  it("지원하지 않는 형식과 최대 크기 초과를 거절한다", async () => {
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
