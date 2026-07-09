# Lynx Dashboard Operations Pages Plan

## Scope

Implement only the Issue, Firewall, and Prompt Versioning areas. Do not add new
top-level sidebar buttons. Do not change Dashboard pages.

## Sidebar

Add InnerItems only under existing sections.

- Issues: overview, review queue, fingerprints, trends, blocked issues.
- Firewall: overview, blocked events, policy coverage, risk tools, simulation.
- Prompts: overview, changes, regressions, compare, deployments.

## Data Layer

Use a frontend-only mock/service layer that can be replaced by real APIs later.

- `apps/lynx-dashboard/lib/operations/types.ts`
- `apps/lynx-dashboard/lib/operations/mock-data.ts`
- `apps/lynx-dashboard/lib/operations/service.ts`

## Reusable UI

Use `@repo/ui` dashboard primitives first. Add reusable app-local UI under
`components/ui/operations` only when the pattern repeats.

- status badge
- filter bar
- detail section
- event timeline
- split diff

## Pages

Issues:

- `/issues/overview`
- `/issues/review`
- `/issues/fingerprints`
- `/issues/trends`
- `/issues/blocked`
- existing `/issues/tracker/[id]` detail extension

Firewall:

- `/firewall/overview`
- `/firewall/blocked-events`
- `/firewall/policy-coverage`
- `/firewall/risk-tools`
- `/firewall/simulation`
- `/firewall/policies/[id]`

Prompts:

- `/prompts/overview`
- `/prompts/changes`
- `/prompts/regressions`
- `/prompts/compare`
- `/prompts/deployments`
- `/prompts/[id]`

## Verification

- `pnpm --filter lynx-dashboard lint`
- `pnpm --filter lynx-dashboard build`
