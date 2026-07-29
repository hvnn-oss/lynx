import assert from "node:assert/strict";
import test from "node:test";

import { importTypeScriptModule } from "./import-typescript.mjs";

test("condition builder round-trips nested policy groups", async () => {
  const firewall = await importTypeScriptModule("../lib/firewall-condition.ts");
  const condition =
    "tool.riskLevel == 'CRITICAL' AND (input.amount > 1000 OR input.value contains '안녕')";
  const parsed = firewall.parseFirewallCondition(condition);

  assert.ok(parsed);
  assert.equal(firewall.serializeFirewallCondition(parsed), condition);
});

test("field types expose only compatible operators", async () => {
  const firewall = await importTypeScriptModule("../lib/firewall-condition.ts");

  assert.deepEqual(firewall.getFirewallConditionOperators("boolean"), [
    "==",
    "!=",
  ]);
  assert.deepEqual(firewall.getFirewallConditionOperators("number"), [
    "==",
    "!=",
    ">",
    ">=",
    "<",
    "<=",
  ]);
});

test("unsupported policy text is rejected by the builder parser", async () => {
  const firewall = await importTypeScriptModule("../lib/firewall-condition.ts");

  assert.equal(firewall.parseFirewallCondition("process.exit()"), null);
});
