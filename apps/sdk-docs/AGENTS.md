# Documentation project instructions

## About this project

- This is a documentation site built on [Mintlify](https://mintlify.com)
- Pages are MDX files with YAML frontmatter
- Configuration lives in `docs.json`
- Public package examples use `@lynxops/sdk`
- English pages live at the root path and Korean pages live under `/ko`

## Terminology

- Prefer "connect", "record", "track", "inspect", "debug", "session",
  "trace", "event", "LLM call", "tool call", "guardrail", and "policy".
- Avoid heavy wording such as "telemetry", "observability",
  "instrumentation", or "governance" unless the page specifically explains the
  concept.
- Korean pages should prefer "SDK 연결", "실행 추적", "세션", "실행 단계",
  "도구 호출", "가드레일", "정책", and "원인 후보".
- Do not claim Lynx always finds the exact root cause. Use "root cause
  candidate", "likely cause", "evidence", "원인 후보", or "의심되는 지점".

## Style preferences

- Use active voice and second person ("you")
- Keep sentences concise: one idea per sentence
- Use sentence case for headings
- Bold for UI elements: Click **Settings**
- Code formatting for file names, commands, paths, and code references
- Use TypeScript-first examples
- Keep examples short, copyable, and aligned with the actual SDK API
- Update English and Korean pages together whenever public docs change
- Korean pages use natural `합니다` tone and should not read like a literal
  machine translation

## Content boundaries

- Do not document internal admin features.
- Mark unfinished functionality as roadmap or planned. Do not present it as
  already available.
- When a page mentions prompts, payloads, tool arguments, model responses, or
  logs, include a short security note about sensitive data.
