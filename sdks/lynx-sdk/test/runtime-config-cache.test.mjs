import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";
import { LynxTracer } from "../dist/index.js";

const originalFetch = globalThis.fetch;
const temporaryDirectories = [];

afterEach(async () => {
  globalThis.fetch = originalFetch;
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

function prompt(content = "Use the cached prompt.") {
  return {
    promptId: "72adbb57-96ad-4d3d-a2dc-8faf071673e5",
    name: "support-agent",
    versionId: "c1821bc3-bf1e-46ef-b210-b9376a41cd0c",
    version: "v1",
    content,
    contentHash: createHash("sha256").update(content).digest("hex"),
  };
}

function bundle(content, revision = "runtime-revision-1") {
  return {
    revision,
    prompts: [prompt(content)],
    policies: [],
  };
}

function createTracer(cache, apiKey = "test-api-key") {
  return new LynxTracer({
    clientId: "cache-test-client",
    endpoint: "http://lynx.test",
    apiKey,
    delivery: { flushIntervalMs: 60_000 },
    runtimeConfig: {
      enabled: false,
      cache,
    },
  });
}

test("a validated revision is stored as a compact binary .lynxconf", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lynx-cache-"));
  temporaryDirectories.push(directory);
  const cachePath = join(directory, "runtime.lynxconf");
  const content = "A prompt that should only appear in compressed form.";
  globalThis.fetch = async () =>
    new Response(JSON.stringify(bundle(content)), {
      status: 200,
      headers: { ETag: '"runtime-revision-1"' },
    });

  const tracer = createTracer({ enabled: true, path: cachePath });
  assert.equal((await tracer.getPrompt("support-agent")).content, content);
  await tracer.shutdown();

  const bytes = await readFile(cachePath);
  assert.equal(bytes.subarray(0, 4).toString("ascii"), "LXCF");
  assert.equal(bytes.includes(Buffer.from(content, "utf8")), false);
  assert.equal(tracer.getStatus().runtimeConfig.cache.state, "READY");
  assert.equal(tracer.getStatus().runtimeConfig.cache.path, cachePath);
});

test("a cached prompt is returned before background revalidation finishes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lynx-cache-"));
  temporaryDirectories.push(directory);
  const cachePath = join(directory, "runtime.lynxconf");
  globalThis.fetch = async () =>
    new Response(JSON.stringify(bundle("Persisted prompt")), { status: 200 });

  const firstTracer = createTracer({ enabled: true, path: cachePath });
  await firstTracer.getPrompt("support-agent");
  await firstTracer.shutdown();

  let finishRefresh;
  globalThis.fetch = () =>
    new Promise((resolve) => {
      finishRefresh = resolve;
    });
  const restoredTracer = createTracer({ enabled: true, path: cachePath });
  const restoredPrompt = await Promise.race([
    restoredTracer.getPrompt("support-agent"),
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("cache restore waited for the network")),
        250,
      ),
    ),
  ]);

  assert.equal(restoredPrompt.content, "Persisted prompt");
  assert.equal(
    restoredTracer.getStatus().runtimeConfig.cache.loadedFromCache,
    true,
  );
  finishRefresh(new Response("unavailable", { status: 503 }));
  await restoredTracer.shutdown();
});

test("the same validated revision is not written again", async () => {
  const storage = {
    bytes: null,
    writes: 0,
    async read() {
      return this.bytes;
    },
    async write(data) {
      this.bytes = new Uint8Array(data);
      this.writes += 1;
    },
    async remove() {
      this.bytes = null;
    },
  };
  globalThis.fetch = async () =>
    new Response(JSON.stringify(bundle("Stable prompt")), {
      status: 200,
      headers: { ETag: '"runtime-revision-1"' },
    });

  const firstTracer = createTracer({ enabled: true, storage });
  await firstTracer.getPrompt("support-agent");
  await firstTracer.shutdown();
  assert.equal(storage.writes, 1);

  const secondTracer = createTracer({ enabled: true, storage });
  assert.equal(
    (await secondTracer.getPrompt("support-agent")).content,
    "Stable prompt",
  );
  await secondTracer.shutdown();
  assert.equal(storage.writes, 1);
});

test("a changed revision atomically replaces an existing cache file", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lynx-cache-"));
  temporaryDirectories.push(directory);
  const cachePath = join(directory, "runtime.lynxconf");
  let currentBundle = bundle("Version one", "runtime-revision-1");
  globalThis.fetch = async () =>
    new Response(JSON.stringify(currentBundle), { status: 200 });

  const firstTracer = createTracer({ enabled: true, path: cachePath });
  await firstTracer.getPrompt("support-agent");
  await firstTracer.shutdown();

  currentBundle = bundle("Version two", "runtime-revision-2");
  const secondTracer = createTracer({ enabled: true, path: cachePath });
  assert.equal(
    (await secondTracer.getPrompt("support-agent")).content,
    "Version one",
  );
  await secondTracer.shutdown();

  let finishRefresh;
  globalThis.fetch = () =>
    new Promise((resolve) => {
      finishRefresh = resolve;
    });
  const thirdTracer = createTracer({ enabled: true, path: cachePath });
  assert.equal(
    (await thirdTracer.getPrompt("support-agent")).content,
    "Version two",
  );
  finishRefresh(new Response(null, { status: 304 }));
  await thirdTracer.shutdown();
});

test("a cache created with another API key is never reused", async () => {
  const storage = {
    bytes: null,
    removals: 0,
    async read() {
      return this.bytes;
    },
    async write(data) {
      this.bytes = new Uint8Array(data);
    },
    async remove() {
      this.bytes = null;
      this.removals += 1;
    },
  };
  globalThis.fetch = async () =>
    new Response(JSON.stringify(bundle("Workspace one")), { status: 200 });

  const firstTracer = createTracer(
    { enabled: true, storage },
    "workspace-one-key",
  );
  await firstTracer.getPrompt("support-agent");
  await firstTracer.shutdown();

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify(bundle("Workspace two", "runtime-revision-2")),
      { status: 200 },
    );
  const secondTracer = createTracer(
    { enabled: true, storage },
    "workspace-two-key",
  );

  assert.equal(
    (await secondTracer.getPrompt("support-agent")).content,
    "Workspace two",
  );
  assert.equal(storage.removals, 1);
  await secondTracer.shutdown();
});
