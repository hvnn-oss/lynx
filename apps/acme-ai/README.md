# Acme AI demo

Acme AI is a small GPT-style demo app that records a realistic support-agent run with the Lynx SDK.

It intentionally includes a failing tool button so you can see a failed session, tool error, and session outcome in Lynx.

## Run locally

```bash
cp apps/acme-ai/.env.example apps/acme-ai/.env
pnpm --filter acme-ai dev
```

Then open [http://localhost:3200](http://localhost:3200).

## Environment variables

| Name | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | OpenAI API key used by the demo chat route. |
| `OPENAI_MODEL` | OpenAI model. Defaults to `gpt-4.1-mini`. |
| `LYNX_API_KEY` | Lynx ingest API key. |
| `LYNX_WORKSPACE_ID` | Workspace where demo events should be recorded. |
| `LYNX_ENDPOINT` | Lynx API endpoint. Defaults to `https://api.lynxops.co`. |
| `LYNX_ENVIRONMENT` | Environment label shown in Lynx. |
| `LYNX_CLIENT_ID` | Client identifier sent by the SDK. |
