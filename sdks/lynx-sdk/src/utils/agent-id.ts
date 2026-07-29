const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const MAX_AGENT_ID_LENGTH = 255;

/**
 * Validates a user-provided stable agent identifier.
 *
 * The SDK intentionally keeps `agentId` as an opaque string. The Lynx server
 * resolves it to its internal Agent UUID, so callers do not need to know the
 * server-side database identifier.
 *
 * @param agentId Agent identifier supplied through SDK configuration or run options.
 * @throws {TypeError} When the identifier cannot be sent safely to the Lynx API.
 */
export function assertValidAgentId(agentId: unknown): asserts agentId is string {
  if (typeof agentId !== "string") {
    throw new TypeError("agentId must be a string.");
  }
  if (agentId.length === 0 || agentId.length > MAX_AGENT_ID_LENGTH) {
    throw new TypeError("agentId must contain between 1 and 255 characters.");
  }
  if (agentId !== agentId.trim()) {
    throw new TypeError(
      "agentId must not have leading or trailing whitespace.",
    );
  }
  if (CONTROL_CHARACTER_PATTERN.test(agentId)) {
    throw new TypeError("agentId must not contain control characters.");
  }
}
