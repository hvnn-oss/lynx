import { randomUUID } from "node:crypto";
import type { UserEntity } from "@repo/database";
import type { ImageService } from "../../provider/image/image.service.js";
import type { ProfileRepository } from "./profile.repository.js";
import { ProfileService } from "./profile.service.js";

describe("ProfileService", () => {
  const userId = randomUUID();

  function createDependencies(profileImageKey: string | null = null) {
    const repository = {
      findByUserId: jest.fn().mockResolvedValue({
        id: userId,
        email: "user@example.com",
        name: "Lynx User",
        profileImageKey,
      } as UserEntity),
      updateImageKey: jest.fn(),
    } as unknown as ProfileRepository;
    const images = {
      upload: jest.fn().mockResolvedValue({
        storageKey: `profile-images/users/${userId}/profile`,
        url: "https://images.example.com/user",
      }),
      update: jest.fn().mockResolvedValue({
        storageKey: `profile-images/users/${userId}/profile`,
        url: "https://images.example.com/user",
      }),
      getUrl: jest.fn((key: string) => `https://images.example.com/${key}`),
    } as unknown as ImageService;

    return {
      repository,
      images,
      service: new ProfileService(repository, () => images),
    };
  }

  it("현재 사용자의 프로필과 이미지 URL을 조회한다", async () => {
    const storageKey = `profile-images/users/${userId}/profile`;
    const { service } = createDependencies(storageKey);

    await expect(service.getProfile(userId)).resolves.toEqual({
      id: userId,
      email: "user@example.com",
      name: "Lynx User",
      profileImageUrl: `https://images.example.com/${storageKey}`,
    });
  });

  it("저장된 이미지가 없으면 설정된 기본 사용자 이미지를 반환한다", async () => {
    const { repository, images } = createDependencies();
    const service = new ProfileService(
      repository,
      () => images,
      "https://images.example.com/default-user.png",
    );

    await expect(service.getProfile(userId)).resolves.toMatchObject({
      profileImageUrl: "https://images.example.com/default-user.png",
    });
    expect(images.getUrl).not.toHaveBeenCalled();
  });

  it("저장된 이미지가 없으면 설정된 기본 사용자 이미지를 반환한다", async () => {
    const { repository, images } = createDependencies();
    const service = new ProfileService(
      repository,
      () => images,
      "https://images.example.com/default-user.png",
    );

    await expect(service.getProfile(userId)).resolves.toMatchObject({
      profileImageUrl: "https://images.example.com/default-user.png",
    });
    expect(images.getUrl).not.toHaveBeenCalled();
  });

  it("최초 이미지를 업로드하고 저장소 키를 사용자에게 연결한다", async () => {
    const { service, repository, images } = createDependencies();

    await expect(
      service.uploadImage(userId, {
        contentType: "image/png",
        bytes: new Uint8Array([1, 2, 3]),
      }),
    ).resolves.toEqual({
      profileImageUrl: "https://images.example.com/user",
    });

    expect(images.upload).toHaveBeenCalledWith({
      ownerType: "user",
      ownerId: userId,
      contentType: "image/png",
      bytes: new Uint8Array([1, 2, 3]),
    });
    expect(repository.updateImageKey).toHaveBeenCalledWith(
      userId,
      `profile-images/users/${userId}/profile`,
    );
  });

  it("기존 저장소 키가 있으면 같은 이미지 객체를 업데이트한다", async () => {
    const storageKey = `profile-images/users/${userId}/profile`;
    const { service, images } = createDependencies(storageKey);

    await service.uploadImage(userId, {
      contentType: "image/webp",
      bytes: new Uint8Array([4, 5]),
    });

    expect(images.update).toHaveBeenCalledWith({
      ownerType: "user",
      ownerId: userId,
      currentStorageKey: storageKey,
      contentType: "image/webp",
      bytes: new Uint8Array([4, 5]),
    });
  });
});
