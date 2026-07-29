import assert from "node:assert/strict";
import test from "node:test";

import { importTypeScriptModule } from "./import-typescript.mjs";

test("access token is kept in memory without browser storage", async () => {
  const originalLocalStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem() {
      throw new Error("localStorage must not be read");
    },
    setItem() {
      throw new Error("localStorage must not be written");
    },
    removeItem() {
      throw new Error("localStorage must not be written");
    },
  };

  try {
    const session = await importTypeScriptModule("../lib/auth-session.ts");
    assert.equal(session.getAccessToken(), null);
    session.setAccessToken("access-token");
    assert.equal(session.getAccessToken(), "access-token");
    session.clearAccessToken();
    assert.equal(session.getAccessToken(), null);
  } finally {
    globalThis.localStorage = originalLocalStorage;
  }
});

test("invalid and near-expiry access tokens require refresh", async () => {
  const session = await importTypeScriptModule("../lib/auth-session.ts");
  const expired = createJwt(Math.floor(Date.now() / 1_000) - 1);
  const nearExpiry = createJwt(Math.floor(Date.now() / 1_000) + 10);
  const active = createJwt(Math.floor(Date.now() / 1_000) + 300);

  assert.equal(session.isAccessTokenExpired("not-a-jwt"), true);
  assert.equal(session.isAccessTokenExpired(expired), true);
  assert.equal(session.isAccessTokenExpired(nearExpiry), true);
  assert.equal(session.isAccessTokenExpired(active), false);
});

function createJwt(exp) {
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({ exp })}.signature`;
}
