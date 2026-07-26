# Orbit

Orbit is a working multi-provider AI chat service backed by OpenAI, Claude, or
Gemini. It is also a realistic reference integration for the Lynx SDK.

Normal chat traffic records runs, sessions, user input, model calls, decisions,
memory access, tool calls, managed prompt versions, firewall decisions, errors,
and final outcomes. Tool behavior is reached through ordinary prompts instead
of a dedicated test screen.

## Run locally

```bash
cp apps/acme-ai/.env.example apps/acme-ai/.env
pnpm --filter acme-ai dev
```

Then open [http://localhost:3200](http://localhost:3200).

## Environment variables

| Name                | Purpose                                                  |
| ------------------- | -------------------------------------------------------- |
| `OPENAI_API_KEY`    | OpenAI API key.                                          |
| `OPENAI_MODEL`      | OpenAI model. Defaults to `gpt-4.1-mini`.                |
| `ANTHROPIC_API_KEY` | Anthropic API key.                                       |
| `ANTHROPIC_MODEL`   | Claude model. Defaults to `claude-sonnet-4-20250514`.    |
| `GEMINI_API_KEY`    | Google AI API key.                                       |
| `GEMINI_MODEL`      | Gemini model. Defaults to `gemini-2.5-flash`.            |
| `LYNX_API_KEY`      | Lynx ingest API key.                                     |
| `LYNX_WORKSPACE_ID` | Workspace where events are recorded.                     |
| `LYNX_ENDPOINT`     | Lynx API endpoint. Defaults to `https://api.lynxops.co`. |
| `LYNX_ENVIRONMENT`  | Environment label shown in Lynx.                         |
| `LYNX_CLIENT_ID`    | Client identifier sent by the SDK.                       |
| `LYNX_PROMPT_NAME`  | Optional managed system prompt name.                     |

At least one model-provider API key is required. Provider keys remain on the
server and are never sent to the browser.

`LYNX_API_KEY` must be a Workspace API key issued by Lynx, in the
`lynx_<environment>_<uuid>_<secret>` format. Legacy development secrets are not
accepted by the OpenAPI routes.
