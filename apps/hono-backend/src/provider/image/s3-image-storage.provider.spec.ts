import { S3ImageStorageProvider } from "./s3-image-storage.provider.js";

describe("S3ImageStorageProvider", () => {
  it("AWS S3 virtual-host 방식으로 서명된 업로드 요청을 보낸다", async () => {
    const request = jest
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 200 }));
    const provider = new S3ImageStorageProvider(
      {
        region: "ap-northeast-2",
        bucket: "lynx-images",
        accessKeyId: "access-key",
        secretAccessKey: "secret-key",
      },
      request,
    );

    await provider.putObject({
      storageKey: "profile-images/user 1/image.png",
      contentType: "image/png",
      bytes: new Uint8Array([1, 2, 3]),
      cacheControl: "public, max-age=60",
    });

    const [url, init] = request.mock.calls[0]!;
    expect(String(url)).toBe(
      "https://lynx-images.s3.ap-northeast-2.amazonaws.com/profile-images/user%201/image.png",
    );
    expect(init?.method).toBe("PUT");
    expect(init?.headers).toEqual(
      expect.objectContaining({
        authorization: expect.stringContaining("AWS4-HMAC-SHA256"),
        "content-type": "image/png",
        "x-amz-content-sha256": expect.stringMatching(/^[0-9a-f]{64}$/),
      }),
    );
  });

  it("MinIO용 path-style endpoint를 지원한다", async () => {
    const request = jest
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }));
    const provider = new S3ImageStorageProvider(
      {
        region: "us-east-1",
        bucket: "lynx-images",
        endpoint: "http://minio.internal:9000",
        accessKeyId: "minio-access",
        secretAccessKey: "minio-secret",
        forcePathStyle: true,
      },
      request,
    );

    await provider.deleteObject("profile-images/user-1/image.webp");

    expect(String(request.mock.calls[0]![0])).toBe(
      "http://minio.internal:9000/lynx-images/profile-images/user-1/image.webp",
    );
    expect(request.mock.calls[0]![1]?.method).toBe("DELETE");
  });
});
