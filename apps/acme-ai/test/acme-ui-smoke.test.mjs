import assert from "node:assert/strict";
import test from "node:test";

const isEnabled = process.env.LYNX_UI_SMOKE_ENABLED === "true";

test(
  "acme-ai chat page renders from the production container",
  { skip: !isEnabled },
  async () => {
    const baseUrl = new URL(
      process.env.ACME_AI_SMOKE_URL ?? "http://127.0.0.1:3200",
    );
    const response = await fetch(baseUrl);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.match(html, /<title>Orbit<\/title>/);
    assert.match(html, /<main/);
  },
);
