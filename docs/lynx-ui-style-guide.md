# Lynx UI Style Guide

Lynx dashboard, session, and debugging screens should feel like a clean B2B
SaaS debugging product: quiet, dense enough for work, and easy to scan. The
goal is not to show every log at once, but to help the user narrow down the
cause of an agent problem quickly.

## Product Tone

- Use a Vercel-like minimal dashboard tone: white or subtle gray surfaces, thin
  borders, small radius, almost no shadow.
- Avoid decorative gradients, glassmorphism, oversized cards, nested cards, and
  console-like raw log dumps as the first view.
- Keep the page calm and operational. Important states should be visible through
  concise badges, small indicators, and clear hierarchy.
- Prefer short diagnostic language over long explanatory copy.

## Page Template

Session and debugging pages should follow this structure where possible:

```text
Page header
Summary cards
Insight or diagnosis box
Filter bar
Main content
Detail drawer or side panel
```

The page should answer:

- Is there a problem now?
- Which session, agent, tool, model, or context is involved?
- Where did the failure or anomaly happen?
- How often does it happen?
- What should the user open next?

## Common Components

- Check `packages/ui` before creating app-local UI.
- Reusable dashboard primitives belong in `packages/ui`.
- App-specific orchestration can live in `apps/lynx-dashboard/components`, but
  it should be built from shared primitives where practical.
- Text shown in dashboard, session, and debugging screens should come from
  `next-intl` message files.

## Cards And Panels

- Use `rounded-lg`, thin border, white or subtle gray background, and `p-4`.
- Do not put cards inside cards.
- Avoid large colored card backgrounds. Use color mainly for small badges or
  status indicators.
- Summary cards should show only:

```text
Label
Value
Delta or helper text
```

Use 3 to 5 summary cards per page.

## Badges

Badges are the main visual language for state and issues.

- `success`: green
- `failed/error`: red
- `warning/anomaly`: amber
- `running`: blue or neutral indicator
- `normal`: gray
- `blocked/security`: purple or red

Each row should show at most 3 badges by default. Collapse extras as `+N` or
move them to a detail panel.

## Lists And Tables

Prefer state-focused list rows over wide raw tables. A row should contain:

```text
Status indicator
Primary title
Secondary description
Metadata
Issue badges
Main metric
Primary CTA
```

Keep rows around 56 to 72px when possible. Long payloads and raw JSON belong in
a collapsed section or detail panel.

## Filters

Filters should have a simple default area and a collapsed advanced area.

Default filters:

- Time range
- Status
- Agent
- Environment
- Search

Advanced filters:

- Model
- Tool
- Prompt version
- Policy version
- Latency/cost/token range
- Error type
- Firewall status
- SDK version

Search placeholders should be explicit, for example:

```text
Search by session ID, trace ID, user, tool, error...
```

## Empty, Loading, And Error States

- Empty states should not only say "No data".
- Include one or more next actions: SDK docs, send test event, open sample
  session, or check API key.
- Use skeleton rows/cards rather than standalone spinners.
- Error states should include a retry action and a path to raw logs when useful.

## Session Timeline

The default session detail view is a vertical timeline with a sticky detail
panel. Flow view is an advanced tab, not the default.

Timeline rows should show:

- Event type icon
- Event title
- One-line summary
- Status badge
- Latency
- Token/cost when available
- Timestamp
- Issue badges

Failed sessions should auto-select the failed event. Raw events and payloads
should remain collapsed by default.

## Debugging Pages

Debugging pages are cross-session analysis tools, not session lists. They should
lead with:

- Summary cards
- Root cause candidate or issue candidate
- Suggested actions
- Filter bar
- Bounded list, tree, chart, or ranking
- Detail panel for selected item

Raw JSON should never be the first thing the user sees.
