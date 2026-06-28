# Lynx Docs

External SDK documentation for Lynx, built with Mintlify.

## Development

Install dependencies from the monorepo root, then run the docs app:

```bash
pnpm install
pnpm --filter lynx-docs dev
```

The local preview runs from the folder that contains `docs.json`.

## Scripts

```bash
pnpm --filter lynx-docs dev
pnpm --filter lynx-docs build
pnpm --filter lynx-docs lint
```

## Internationalization

English is the default language and lives at the document root.

Korean pages live under `ko/` and are configured through `navigation.languages`
in `docs.json`.
