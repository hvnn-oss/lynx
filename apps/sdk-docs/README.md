# Lynx Docs

External SDK documentation for Lynx, built with Mintlify.

## Structure

```txt
apps/docs
├── docs.json
├── index.mdx
├── sdk/
│   ├── quickstart.mdx
│   ├── configuration.mdx
│   ├── tracing.mdx
│   ├── instrumentation.mdx
│   ├── guardrails.mdx
│   ├── delivery.mdx
│   └── api-reference.mdx
└── ko/
    ├── index.mdx
    └── sdk/
        ├── quickstart.mdx
        ├── configuration.mdx
        ├── tracing.mdx
        ├── instrumentation.mdx
        ├── guardrails.mdx
        ├── delivery.mdx
        └── api-reference.mdx
```

English is the default language. Korean pages live under `ko/`.

## Development

```bash
pnpm install
pnpm --filter docs dev
```

## Scripts

```bash
pnpm --filter docs dev
pnpm --filter docs build
pnpm --filter docs lint
```
