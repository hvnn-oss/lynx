import assert from "node:assert/strict";
import test from "node:test";

const isEnabled = process.env.LYNX_UI_SMOKE_ENABLED === "true";

test(
  "admin login page renders from the production container",
  { skip: !isEnabled },
  async () => {
    const baseUrl = new URL(
      process.env.LYNX_ADMIN_SMOKE_URL ?? "http://127.0.0.1:3001",
    );
    const response = await fetch(new URL("/login", baseUrl), {
      redirect: "manual",
    });
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.match(html, /Lynx Admin/);
    assert.match(html, /type="email"/);
    assert.match(html, /type="password"/);
  },
);
