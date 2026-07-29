import { AwsContainerCredentialProvider } from "./aws-credential.provider.js";

describe("AwsContainerCredentialProvider", () => {
  it("ECS relative URI에서 임시 자격 증명을 받고 만료 전까지 재사용한다", async () => {
    const request = jest.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          AccessKeyId: "task-role-access-key",
          SecretAccessKey: "task-role-secret",
          Token: "task-role-session-token",
          Expiration: new Date(Date.now() + 60 * 60_000).toISOString(),
        }),
        { status: 200 },
      ),
    );
    const provider = new AwsContainerCredentialProvider(
      { relativeUri: "/v2/credentials/task-id" },
      request,
    );

    const first = await provider.getCredentials();
    const second = await provider.getCredentials();

    expect(first).toMatchObject({
      accessKeyId: "task-role-access-key",
      sessionToken: "task-role-session-token",
    });
    expect(second).toBe(first);
    expect(request).toHaveBeenCalledTimes(1);
    expect(String(request.mock.calls[0]![0])).toBe(
      "http://169.254.170.2/v2/credentials/task-id",
    );
  });

  it("허용되지 않은 full URI로 credential 요청을 보내지 않는다", async () => {
    const request = jest.fn<typeof fetch>();
    const provider = new AwsContainerCredentialProvider(
      { fullUri: "https://attacker.example/credentials" },
      request,
    );

    await expect(provider.getCredentials()).rejects.toThrow(
      "AWS_CONTAINER_CREDENTIALS_FULL_URI_NOT_ALLOWED",
    );
    expect(request).not.toHaveBeenCalled();
  });

  it("불완전한 ECS credential 응답을 거부한다", async () => {
    const provider = new AwsContainerCredentialProvider(
      { relativeUri: "/v2/credentials/task-id" },
      jest.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ AccessKeyId: "only-key" }), {
          status: 200,
        }),
      ),
    );

    await expect(provider.getCredentials()).rejects.toThrow(
      "AWS_CONTAINER_CREDENTIALS_RESPONSE_INVALID",
    );
  });
});
