```
npm install
npm run dev
```

```
open http://localhost:3000
```
# Event ingestion and Run queries

- `POST /openapi/v1/events/batch` accepts up to 100 SDK events and requires a Workspace API Key with `events:write`.
- `GET /openapi/v1/runs` and `GET /openapi/v1/runs/:runId` require a Workspace API Key with `usage:read`.
- Dashboard clients use `GET /workspace/:workspaceId/runs` and `GET /workspace/:workspaceId/runs/:runId` with an access token and workspace read access.
- The authenticated API Key determines `workspaceId` and `environment`; payload hints cannot change the tenant boundary.
