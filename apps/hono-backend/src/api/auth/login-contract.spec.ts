import { authContract } from "@repo/contract";

describe("login contract", () => {
  it("이메일을 정규화하고 로그인 입력을 검증한다", () => {
    const input = authContract.login.request.parse({
      email: "  USER@Example.COM ",
      password: "password123",
      expectedWorkspaceId: "workspace-1",
    });

    expect(input).toEqual({
      email: "user@example.com",
      password: "password123",
      expectedWorkspaceId: "workspace-1",
    });
  });

  it("로그인 응답에는 Refresh Token을 요구하지 않는다", () => {
    const response = authContract.login.response.parse({
      success: true,
      access_token: "access-token",
    });

    expect(response).toEqual({
      success: true,
      access_token: "access-token",
    });
  });
});
