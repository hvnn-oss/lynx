import { createHash, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { gunzip, gzip } from "node:zlib";
import type {
  RuntimeConfigBundle,
  RuntimeConfigCacheSnapshot,
} from "./runtime-config.types.js";

const MAGIC = Buffer.from("LXCF", "ascii");
const LEGACY_FORMAT_VERSION = 2;
const FORMAT_VERSION = 3;
const GZIP_CODEC = 1;
const HEADER_LENGTH = MAGIC.length + 1 + 1 + 32;
const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

type CompactPrompt = [
  promptId: string,
  name: string,
  versionId: string,
  version: string,
  content: string,
  contentHash: string,
];

type CompactPolicy = [
  policyId: string,
  name: string,
  description: string | null,
  version: string,
  condition: string,
  severity: string,
  action: string,
];

type CompactExperiment = [
  experimentId: string,
  promptId: string,
  assignmentSalt: string,
  variants: [weight: number, prompt: CompactPrompt][],
];

type CompactCachePayload = [
  identity: string,
  savedAt: number,
  revision: string,
  etag: string | null,
  prompts: CompactPrompt[],
  policies: CompactPolicy[],
  experiments: CompactExperiment[] | null,
  target:
    | [
        environment: string,
        requestedAgentId: string | null,
        resolvedAgentId: string | null,
      ]
    | null,
  signing: [algorithm: "Ed25519", keyId: string, signature: string] | null,
];

/** Encodes a validated bundle as a checksummed gzip-compressed `.lynxconf`. */
export async function encodeRuntimeConfigCache(
  snapshot: RuntimeConfigCacheSnapshot,
): Promise<Uint8Array> {
  const payload: CompactCachePayload = [
    snapshot.identity,
    snapshot.savedAt,
    snapshot.bundle.revision,
    snapshot.etag ?? null,
    snapshot.bundle.prompts.map((prompt) => [
      prompt.promptId,
      prompt.name,
      prompt.versionId,
      prompt.version,
      prompt.content,
      prompt.contentHash,
    ]),
    snapshot.bundle.policies.map((policy) => [
      policy.policyId,
      policy.name,
      policy.description,
      policy.version,
      policy.condition,
      policy.severity,
      policy.action,
    ]),
    snapshot.bundle.experiments
      ? snapshot.bundle.experiments.map((experiment) => [
          experiment.experimentId,
          experiment.promptId,
          experiment.assignmentSalt,
          experiment.variants.map((variant) => [
            variant.weight,
            [
              variant.prompt.promptId,
              variant.prompt.name,
              variant.prompt.versionId,
              variant.prompt.version,
              variant.prompt.content,
              variant.prompt.contentHash,
            ],
          ]),
        ])
      : null,
    snapshot.bundle.target
      ? [
          snapshot.bundle.target.environment,
          snapshot.bundle.target.requestedAgentId ?? null,
          snapshot.bundle.target.resolvedAgentId ?? null,
        ]
      : null,
    snapshot.bundle.signing
      ? [
          snapshot.bundle.signing.algorithm,
          snapshot.bundle.signing.keyId,
          snapshot.bundle.signing.signature,
        ]
      : null,
  ];
  const compressed = await gzipAsync(
    Buffer.from(JSON.stringify(payload), "utf8"),
    { level: 9 },
  );
  const checksum = createHash("sha256").update(compressed).digest();
  const header = Buffer.alloc(HEADER_LENGTH);
  MAGIC.copy(header, 0);
  header[MAGIC.length] = FORMAT_VERSION;
  header[MAGIC.length + 1] = GZIP_CODEC;
  checksum.copy(header, MAGIC.length + 2);

  return Buffer.concat([header, compressed]);
}

/** Verifies and decodes one portable `.lynxconf` byte sequence. */
export async function decodeRuntimeConfigCache(
  data: Uint8Array,
): Promise<RuntimeConfigCacheSnapshot> {
  const file = Buffer.from(data);
  if (file.length <= HEADER_LENGTH) {
    throw new Error("Runtime configuration cache is truncated");
  }
  if (!file.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error("Runtime configuration cache has an invalid signature");
  }
  const formatVersion = file[MAGIC.length];
  if (
    formatVersion !== LEGACY_FORMAT_VERSION &&
    formatVersion !== FORMAT_VERSION
  ) {
    throw new Error("Runtime configuration cache version is unsupported");
  }
  if (file[MAGIC.length + 1] !== GZIP_CODEC) {
    throw new Error("Runtime configuration cache codec is unsupported");
  }

  const expectedChecksum = file.subarray(MAGIC.length + 2, HEADER_LENGTH);
  const compressed = file.subarray(HEADER_LENGTH);
  const actualChecksum = createHash("sha256").update(compressed).digest();
  if (
    expectedChecksum.length !== actualChecksum.length ||
    !timingSafeEqual(expectedChecksum, actualChecksum)
  ) {
    throw new Error("Runtime configuration cache checksum does not match");
  }

  const json = await gunzipAsync(compressed);
  return parsePayload(
    JSON.parse(json.toString("utf8")) as unknown,
    formatVersion,
  );
}

/** Expands the versioned tuple representation into the public bundle shape. */
function parsePayload(
  value: unknown,
  formatVersion: number,
): RuntimeConfigCacheSnapshot {
  const expectedLength = formatVersion === LEGACY_FORMAT_VERSION ? 7 : 9;
  if (!Array.isArray(value) || value.length !== expectedLength) {
    throw new Error("Runtime configuration cache payload is invalid");
  }
  const [identity, savedAt, revision, etag, prompts, policies] = value;
  const experiments = formatVersion === LEGACY_FORMAT_VERSION ? [] : value[6];
  const target = formatVersion === LEGACY_FORMAT_VERSION ? null : value[7];
  const signing = formatVersion === LEGACY_FORMAT_VERSION ? value[6] : value[8];
  if (
    typeof identity !== "string" ||
    typeof savedAt !== "number" ||
    !Number.isFinite(savedAt) ||
    typeof revision !== "string" ||
    (etag !== null && typeof etag !== "string") ||
    !Array.isArray(prompts) ||
    !Array.isArray(policies) ||
    (experiments !== null && !Array.isArray(experiments))
  ) {
    throw new Error("Runtime configuration cache metadata is invalid");
  }

  const bundle: RuntimeConfigBundle = {
    revision,
    prompts: prompts.map(parsePrompt),
    policies: policies.map(parsePolicy),
    experiments:
      formatVersion === LEGACY_FORMAT_VERSION
        ? undefined
        : experiments?.map(parseExperiment),
    target: parseTarget(target),
    signing: parseSigning(signing),
  };
  return {
    identity,
    savedAt,
    etag: etag ?? undefined,
    bundle,
  };
}

/** Expands one compact prompt experiment and all immutable variants. */
function parseExperiment(value: unknown) {
  const fields = readTuple(value, 4, "experiment");
  if (!Array.isArray(fields[3])) {
    throw new Error(
      "Runtime configuration cache experiment variants are invalid",
    );
  }
  return {
    experimentId: readString(fields[0], "experimentId"),
    promptId: readString(fields[1], "experiment promptId"),
    assignmentSalt: readString(fields[2], "experiment assignmentSalt"),
    variants: fields[3].map((variant) => {
      const variantFields = readTuple(variant, 2, "experiment variant");
      if (
        typeof variantFields[0] !== "number" ||
        !Number.isInteger(variantFields[0])
      ) {
        throw new Error(
          "Runtime configuration cache experiment weight is invalid",
        );
      }
      return {
        weight: variantFields[0],
        prompt: parsePrompt(variantFields[1]),
      };
    }),
  };
}

/** Expands optional environment and Agent resolution metadata. */
function parseTarget(value: unknown): RuntimeConfigBundle["target"] {
  if (value === null) return undefined;
  const fields = readTuple(value, 3, "target");
  const requestedAgentId = readNullableString(
    fields[1],
    "target requestedAgentId",
  );
  const resolvedAgentId = readNullableString(
    fields[2],
    "target resolvedAgentId",
  );
  return {
    environment: readString(fields[0], "target environment"),
    requestedAgentId: requestedAgentId ?? undefined,
    resolvedAgentId: resolvedAgentId ?? undefined,
  };
}

/** Validates the optional compact Ed25519 signature tuple. */
function parseSigning(value: unknown): RuntimeConfigBundle["signing"] {
  if (value === null) return null;
  const fields = readTuple(value, 3, "signature");
  if (fields[0] !== "Ed25519") {
    throw new Error("Runtime configuration cache signature is invalid");
  }
  return {
    algorithm: "Ed25519",
    keyId: readString(fields[1], "signature keyId"),
    signature: readString(fields[2], "signature value"),
  };
}

/** Validates one compact prompt tuple before expanding it. */
function parsePrompt(value: unknown) {
  const fields = readTuple(value, 6, "prompt");
  return {
    promptId: readString(fields[0], "promptId"),
    name: readString(fields[1], "prompt name"),
    versionId: readString(fields[2], "prompt versionId"),
    version: readString(fields[3], "prompt version"),
    content: readString(fields[4], "prompt content", true),
    contentHash: readString(fields[5], "prompt contentHash"),
  };
}

/** Validates one compact policy tuple before expanding it. */
function parsePolicy(value: unknown) {
  const fields = readTuple(value, 7, "policy");
  const description = fields[2];
  if (description !== null && typeof description !== "string") {
    throw new Error(
      "Runtime configuration cache policy description is invalid",
    );
  }
  return {
    policyId: readString(fields[0], "policyId"),
    name: readString(fields[1], "policy name"),
    description,
    version: readString(fields[3], "policy version"),
    condition: readString(fields[4], "policy condition", true),
    severity: readString(fields[5], "policy severity"),
    action: readString(fields[6], "policy action"),
  };
}

/** Requires an exact tuple length so future formats cannot be misinterpreted. */
function readTuple(value: unknown, length: number, label: string): unknown[] {
  if (!Array.isArray(value) || value.length !== length) {
    throw new Error(`Runtime configuration cache ${label} is invalid`);
  }
  return value;
}

/** Reads a string field while allowing empty prompt content and conditions. */
function readString(value: unknown, label: string, allowEmpty = false): string {
  if (typeof value !== "string" || (!allowEmpty && value.length === 0)) {
    throw new Error(`Runtime configuration cache ${label} is invalid`);
  }
  return value;
}

/** Reads a nullable compact string field. */
function readNullableString(value: unknown, label: string): string | null {
  if (value === null) return null;
  return readString(value, label);
}
