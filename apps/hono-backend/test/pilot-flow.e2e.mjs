import assert from "node:assert/strict";
import test from "node:test";

const isEnabled = process.env.LYNX_E2E_ENABLED === "true";

test(
  "pilot flow: invite, signup, workspace, ingestion, issue, tenant isolation",
  { skip: !isEnabled },
  async () => {
    const baseUrl = requireUrl(
      "LYNX_E2E_BASE_URL",
      process.env.LYNX_E2E_BASE_URL ?? "http://127.0.0.1:8000",
    );
    const mailboxUrl = requireUrl(
      "LYNX_E2E_MAILBOX_URL",
      process.env.LYNX_E2E_MAILBOX_URL ?? "http://127.0.0.1:8025",
    );
    const adminEmail =
      process.env.LYNX_E2E_BOOTSTRAP_ADMIN_EMAIL ??
      "pilot-admin@localhost.test";
    const password = process.env.LYNX_E2E_PASSWORD ?? "PilotPass123!";
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const pilotEmail = `pilot-${suffix}@localhost.test`;

    const adminToken = await ensureBootstrapAdmin({
      baseUrl,
      mailboxUrl,
      email: adminEmail,
      password,
    });
    const adminOrganization = await getFirstOrganization(baseUrl, adminToken);
    const adminWorkspace = await createWorkspace(baseUrl, adminToken, {
      name: `admin-${suffix}`,
      orgId: adminOrganization.id,
    });
    const adminApiKey = await createApiKey(
      baseUrl,
      adminToken,
      adminWorkspace.id,
      `e2e-admin-${suffix}`,
    );

    await apiRequest(baseUrl, "/access/invitations", {
      method: "POST",
      accessToken: adminToken,
      body: { email: pilotEmail, expiresInHours: 1 },
      expectedStatus: [201],
    });
    const invitationMail = await waitForMail(
      mailboxUrl,
      pilotEmail,
      "You are invited to the Lynx pilot",
    );
    const invitationToken = extractMatch(
      invitationMail,
      /invite=([A-Za-z0-9_-]{32,256})/,
      "pilot invitation token",
    );

    await apiRequest(baseUrl, "/auth/signup/create-verify", {
      method: "POST",
      body: {
        email: pilotEmail,
        invitation_token: invitationToken,
      },
      expectedStatus: [200],
    });
    const verificationMail = await waitForMail(
      mailboxUrl,
      pilotEmail,
      "Verify your Lynx email",
    );
    const verificationToken = extractMatch(
      verificationMail,
      /token=([0-9a-f-]{36})/i,
      "email verification token",
    );

    const verification = await apiRequest(baseUrl, "/auth/signup/verify", {
      method: "POST",
      body: { token: verificationToken },
      expectedStatus: [200],
    });
    assert.equal(verification.email, pilotEmail);
    assert.equal(verification.requiresOrganization, true);

    await apiRequest(baseUrl, "/auth/signup", {
      method: "POST",
      body: {
        token: verificationToken,
        password,
        name: "PilotUser",
        organization_info: { name: `Pilot ${suffix}`.slice(0, 20) },
      },
      expectedStatus: [200, 201],
    });
    const pilotToken = await login(baseUrl, pilotEmail, password);
    const pilotOrganization = await getFirstOrganization(baseUrl, pilotToken);
    const pilotWorkspace = await createWorkspace(baseUrl, pilotToken, {
      name: `pilot-${suffix}`,
      orgId: pilotOrganization.id,
    });
    const pilotApiKey = await createApiKey(
      baseUrl,
      pilotToken,
      pilotWorkspace.id,
      `e2e-pilot-${suffix}`,
    );

    const clientId = `e2e-client-${suffix}`;
    const runId = `e2e-run-${suffix}`;
    const sessionId = `e2e-session-${suffix}`;
    const eventId = `e2e-event-${suffix}`;
    const ingestion = await apiRequest(baseUrl, "/openapi/v1/events/batch", {
      method: "POST",
      apiKey: pilotApiKey.key,
      body: [
        {
          eventId,
          clientId,
          runId,
          sessionId,
          workspaceId: pilotWorkspace.id,
          agentId: "pilot-agent",
          agentName: "pilot-agent",
          eventType: "POLICY_EVALUATION",
          label: "e2e firewall block",
          payload: {
            action: "BLOCK",
            policyName: "E2E policy",
            condition: "input.value contains blocked",
          },
          timestamp: Date.now(),
          schemaVersion: "1",
        },
      ],
      expectedStatus: [200],
    });
    assert.equal(ingestion.accepted, 1);

    const issueRecord = await apiRequest(baseUrl, "/openapi/v1/issue-records", {
      method: "POST",
      apiKey: pilotApiKey.key,
      body: {
        sdkInstanceId: clientId,
        clientRecordId: `e2e-record-${suffix}`,
        recordKind: "DETECTION",
        detectionType: "FIREWALL_BLOCK",
        runId,
        sessionId,
        eventId,
        agentId: "pilot-agent",
        detectedAt: Date.now(),
        payload: {
          policyName: "E2E policy",
          condition: "input.value contains blocked",
          eventType: "POLICY_EVALUATION",
        },
      },
      expectedStatus: [202],
    });
    assert.equal(issueRecord.isNew, true);

    await waitForIssueDecision(
      baseUrl,
      pilotToken,
      pilotWorkspace.id,
      issueRecord.recordId,
    );
    const issues = await apiRequest(
      baseUrl,
      `/workspace/${pilotWorkspace.id}/issues?limit=25`,
      {
        accessToken: pilotToken,
        expectedStatus: [200],
      },
    );
    assert.ok(issues.items.length > 0, "worker did not create an issue");

    await apiRequest(
      baseUrl,
      `/workspace/${pilotWorkspace.id}/dashboard/overview`,
      {
        accessToken: pilotToken,
        expectedStatus: [200],
      },
    );

    const crossTenantEventId = `cross-tenant-${suffix}`;
    const crossTenantIngestion = await apiRequest(
      baseUrl,
      "/openapi/v1/events/batch",
      {
        method: "POST",
        apiKey: adminApiKey.key,
        body: [
          {
            eventId: crossTenantEventId,
            clientId: `admin-client-${suffix}`,
            runId: `admin-run-${suffix}`,
            workspaceId: pilotWorkspace.id,
            agentName: "cross-tenant-agent",
            eventType: "USER_INPUT",
            label: "must be rejected",
            payload: {},
            timestamp: Date.now(),
          },
        ],
        expectedStatus: [200],
      },
    );
    assert.equal(crossTenantIngestion.accepted, 0);
    assert.deepEqual(crossTenantIngestion.rejectedEventIds, [
      crossTenantEventId,
    ]);

    await apiRequest(baseUrl, `/openapi/v1/runs/${encodeURIComponent(runId)}`, {
      apiKey: adminApiKey.key,
      expectedStatus: [404],
    });
    await apiRequest(
      baseUrl,
      `/workspace/${adminWorkspace.id}/dashboard/overview`,
      {
        accessToken: pilotToken,
        expectedStatus: [403],
      },
    );
    await apiRequest(
      baseUrl,
      `/workspace/${pilotWorkspace.id}/dashboard/overview`,
      {
        accessToken: adminToken,
        expectedStatus: [403],
      },
    );
  },
);

async function ensureBootstrapAdmin({ baseUrl, mailboxUrl, email, password }) {
  const loginResponse = await apiRequest(baseUrl, "/auth/login", {
    method: "POST",
    body: { email, password },
    expectedStatus: [200, 401],
  });
  if (loginResponse.status === 200) {
    return loginResponse.body.access_token;
  }

  await apiRequest(baseUrl, "/auth/signup/create-verify", {
    method: "POST",
    body: { email },
    expectedStatus: [200],
  });
  const verificationMail = await waitForMail(
    mailboxUrl,
    email,
    "Verify your Lynx email",
  );
  const token = extractMatch(
    verificationMail,
    /token=([0-9a-f-]{36})/i,
    "bootstrap verification token",
  );
  await apiRequest(baseUrl, "/auth/signup/verify", {
    method: "POST",
    body: { token },
    expectedStatus: [200],
  });
  await apiRequest(baseUrl, "/auth/signup", {
    method: "POST",
    body: {
      token,
      password,
      name: "PilotAdmin",
      organization_info: { name: "Lynx E2E" },
    },
    expectedStatus: [200, 201],
  });
  return login(baseUrl, email, password);
}

async function login(baseUrl, email, password) {
  const result = await apiRequest(baseUrl, "/auth/login", {
    method: "POST",
    body: { email, password },
    expectedStatus: [200],
  });
  return result.access_token;
}

async function getFirstOrganization(baseUrl, accessToken) {
  const result = await apiRequest(baseUrl, "/organization/list", {
    accessToken,
    expectedStatus: [200],
  });
  assert.ok(result.items.length > 0, "user has no organization");
  return result.items[0];
}

async function createWorkspace(baseUrl, accessToken, body) {
  return apiRequest(baseUrl, "/workspace/create", {
    method: "POST",
    accessToken,
    body,
    expectedStatus: [200, 201],
  });
}

async function createApiKey(baseUrl, accessToken, workspaceId, name) {
  return apiRequest(baseUrl, `/workspace/${workspaceId}/api-keys`, {
    method: "POST",
    accessToken,
    body: {
      name,
      environment: "staging",
      expirePeriodDays: 1,
      kind: "SDK",
      scopes: ["events:write", "usage:read", "config:read", "policies:read"],
    },
    expectedStatus: [201],
  });
}

async function waitForIssueDecision(
  baseUrl,
  accessToken,
  workspaceId,
  recordId,
) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const result = await apiRequest(
      baseUrl,
      `/workspace/${workspaceId}/issue-records?limit=25`,
      {
        accessToken,
        expectedStatus: [200],
      },
    );
    const record = result.items.find((item) => item.id === recordId);
    if (record?.processing.status === "DECIDED") return;
    if (
      record?.processing.status === "FAILED" &&
      !record.processing.nextEvaluationAt
    ) {
      throw new Error(
        `issue record failed permanently: ${record.processing.lastErrorCode ?? "unknown"}`,
      );
    }
    await delay(250);
  }
  throw new Error(`issue record was not decided: ${recordId}`);
}

async function waitForMail(mailboxUrl, email, subject) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const response = await fetch(new URL("/api/v1/messages", mailboxUrl));
    if (!response.ok) {
      throw new Error(`mailbox list failed: ${response.status}`);
    }
    const payload = await response.json();
    const messages =
      payload.messages ?? payload.Messages ?? payload.items ?? [];
    const summary = messages.find((message) => {
      const recipients = JSON.stringify(message.To ?? message.to ?? []);
      const messageSubject = message.Subject ?? message.subject;
      return recipients.includes(email) && messageSubject === subject;
    });
    if (summary) {
      const id = summary.ID ?? summary.Id ?? summary.id;
      const detailResponse = await fetch(
        new URL(`/api/v1/message/${encodeURIComponent(id)}`, mailboxUrl),
      );
      if (!detailResponse.ok) {
        throw new Error(`mailbox detail failed: ${detailResponse.status}`);
      }
      return JSON.stringify(await detailResponse.json());
    }
    await delay(250);
  }
  throw new Error(`mail was not received: ${subject} -> ${email}`);
}

async function apiRequest(
  baseUrl,
  path,
  { method = "GET", accessToken, apiKey, body, expectedStatus = [200] } = {},
) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (apiKey) headers["X-API-Key"] = apiKey;

  const response = await fetch(new URL(path, baseUrl), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!expectedStatus.includes(response.status)) {
    throw new Error(
      `${method} ${path} returned ${response.status}: ${text.slice(0, 1_000)}`,
    );
  }
  if (expectedStatus.length > 1) {
    return { status: response.status, body: payload };
  }
  return payload;
}

function extractMatch(value, pattern, label) {
  const match = value.match(pattern);
  if (!match?.[1]) throw new Error(`${label} was not found in mail`);
  return decodeURIComponent(match[1]);
}

function requireUrl(name, value) {
  try {
    return new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
