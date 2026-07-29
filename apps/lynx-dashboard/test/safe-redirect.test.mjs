import assert from "node:assert/strict";
import test from "node:test";

import { importTypeScriptModule } from "./import-typescript.mjs";

test("same-origin redirect keeps path, query, and fragment", async () => {
  const redirect = await importTypeScriptModule("../lib/safe-redirect.ts");

  assert.equal(
    redirect.getSafeRedirect("/issues/123?tab=activity#latest"),
    "/issues/123?tab=activity#latest",
  );
});

test("external and encoded backslash redirects are rejected", async () => {
  const redirect = await importTypeScriptModule("../lib/safe-redirect.ts");

  assert.equal(redirect.getSafeRedirect("https://evil.example"), "/dashboard");
  assert.equal(redirect.getSafeRedirect("//evil.example"), "/dashboard");
  assert.equal(redirect.getSafeRedirect("/%5C%5Cevil.example"), "/dashboard");
});

test("authentication links encode a validated redirect", async () => {
  const redirect = await importTypeScriptModule("../lib/safe-redirect.ts");

  assert.equal(
    redirect.withRedirect("/login", "/issues/review?status=OPEN"),
    "/login?redirects=%2Fissues%2Freview%3Fstatus%3DOPEN",
  );
});
