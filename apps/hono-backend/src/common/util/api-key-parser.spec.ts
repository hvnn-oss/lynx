import { apiKeyParser, generateApiKey } from "./api-key-parser.js";

describe("API Key parser", () => {
  it("round-trips a base64url secret containing underscores", () => {
    const input = {
      environment: "production",
      id: "70302e18-767c-42d3-9674-80c302475981",
      secret: "secret_with_multiple_underscores",
    };

    expect(apiKeyParser(generateApiKey(input))).toEqual(input);
  });

  it("rejects malformed keys", () => {
    expect(() => apiKeyParser("invalid-key")).toThrow(
      "Invalid API Key format.",
    );
  });
});
