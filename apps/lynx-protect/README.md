# Lynx Protect

Lynx Protect is the runtime policy and risk-control application for Lynx.

## Local development

From the repository root, run:

```bash
pnpm --filter lynx-protect dev
```

The app runs at `http://localhost:3002`. Requests under `/api/*` are forwarded
to `BACKEND_URL`, which defaults to `http://localhost:8000`.

Copy `.env.example` to `.env` when a different local backend URL is needed.

## Checks

```bash
pnpm --filter lynx-protect lint
pnpm --filter lynx-protect build
```
