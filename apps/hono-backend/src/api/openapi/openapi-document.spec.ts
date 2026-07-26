import { openAPIContract } from "@repo/contract";
import { app } from "../../app.js";
import { openAPIDocument } from "./openapi-document.js";

function toDocumentPath(path: string) {
  return path.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
}

describe("public OpenAPI document", () => {
  it("describes every public runtime endpoint", () => {
    const endpoints = Object.entries(openAPIContract).filter(
      (
        entry,
      ): entry is [
        string,
        {
          method: "GET" | "POST";
          path: string;
        },
      ] =>
        typeof entry[1] === "object" &&
        entry[1] !== null &&
        "method" in entry[1] &&
        "path" in entry[1],
    );

    for (const [, endpoint] of endpoints) {
      const path = toDocumentPath(endpoint.path);
      expect(openAPIDocument.paths).toHaveProperty([
        path,
        endpoint.method.toLowerCase(),
      ]);
    }
  });

  it("publishes a generator-friendly unauthenticated JSON document", async () => {
    const response = await app.request("/openapi.json");
    const document = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("cache-control")).toBe("public, max-age=300");
    expect(document).toMatchObject({
      openapi: "3.0.3",
      info: { title: "Lynx OpenAPI", version: "1.0.0" },
      servers: [{ url: "/openapi/v1" }],
      components: {
        securitySchemes: {
          WorkspaceApiKey: {
            type: "apiKey",
            in: "header",
            name: "X-API-Key",
          },
        },
      },
    });
  });

  it("includes reusable request and response schemas", () => {
    expect(openAPIDocument.components.schemas).toEqual(
      expect.objectContaining({
        IngestEventBatch: expect.any(Object),
        RuntimeConfigResponse: expect.any(Object),
        CreateFirewallApproval: expect.any(Object),
        FirewallApprovalStatusResponse: expect.any(Object),
        RunDetailResponse: expect.any(Object),
        ErrorResponse: expect.any(Object),
      }),
    );
  });
});
