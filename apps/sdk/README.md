# @repo/sdk: Enterprise-Grade AI Agent Telemetry SDK

`@repo/sdk`는 TypeScript 기반의 LLM 및 AI 에이전트 서비스 실행 환경을 계측(Instrumentation)하고 텔레메트리 데이터를 수집하여 Lynx 모니터링 컨트롤 플레인으로 안전하게 스트리밍하는 고성능 경량 SDK입니다. 

상용 서비스 환경에서 AI 에이전트를 모니터링할 때 직면하는 **DDoS성 백프레셔(Backpressure) 부재, 임시 네트워킹 장애로 인한 로그 유실, 개인정보 유출, 클라이언트 기반 비용 계산 정합성 부족** 등의 엔터프라이즈 문제를 클라이언트 레이어에서 즉각 극복할 수 있도록 설계되었습니다.

---

## ✨ 핵심 기능

1. **지능형 자동 계측 (Auto-Instrumentation)**
   * ES6 Proxy 및 동적 래핑 기법을 적용하여 인스턴스의 기존 런타임 인터페이스 손상 없이 LLM 호출(`instrumentLLM`) 및 도구(`instrumentTool`) 실행 지표를 가로채 기록합니다.
   * OpenAI, Anthropic(Claude), Google Gemini, Vercel AI SDK, LangChain, Ollama, Cohere 등 현존하는 다양한 TS 기반 LLM SDK 및 모듈 인터페이스를 기본 지원합니다.

2. **백프레셔 완화 메모리 배치 큐 (Memory Batch Queue)**
   * 모든 텔레메트리 이벤트를 매번 fetch()하지 않고, 메모리 내 `eventQueue` 버퍼에 일시 적재합니다.
   * 설정된 `batchSize`(기본 50개)를 초과하거나 `flushIntervalMs`(기본 3000ms) 주기마다 자동으로 일괄 전송(`POST /api/v1/events/batch`)을 수행하여 트래픽 오버헤드를 극적으로 감쇄시킵니다.
   * 노드 프로세스 종료 감지(`beforeExit`, `exit`) 시 미전송된 잔여 버퍼를 동기적으로 플러시(Flush)하여 유실을 원천 차단합니다.

3. **장애 회복 오프라인 버퍼 & 지수 백오프 (Offline Buffer & Exponential Backoff)**
   * 수집 서버 장애(5xx 오류)나 네트워크 불안정 시 전송 실패한 이벤트를 `retryQueue`로 즉시 회수합니다.
   * 최대 1분 한도의 지수 백오프(Exponential Backoff) 지연 타이머를 적용하여 네트워크 복구 시점까지 재시도를 반복 수행합니다.
   * 오프라인 큐가 비정상적으로 누적되어 발생하는 클라이언트 OOM(Out of Memory)을 방지하고자 최대 대기열 제한(`maxBufferSize = 1000`)을 엄격히 준수합니다.

4. **W3C 및 OpenTelemetry 표준 호환 분산 추적**
   * OpenTelemetry 표준 규격에 맞추어 `traceId`(32자리 소문자 Hex, 16바이트) 및 `spanId`(16자리 소문자 Hex, 8바이트) 생성기를 탑재했습니다.
   * W3C Trace Context 표준을 지원하여 타사 모니터링 시스템(Grafana, Datadog 등)과의 간편한 지표 연동이 가능합니다.

5. **클라이언트단 PII 민감정보 마스킹 (PII Scrubbing Layer)**
   * 개인정보(주민등록번호, 이메일, 전화번호, 카드번호) 및 보안 자격증명(JWT, Bearer 토큰, OpenAI API Key)을 전송 직전 감지하여 `[MASKED_...]` 형태로 완벽하게 마스킹 처리합니다.
   * [patterns.json](file:///Users/damie/Programming/lynx/apps/sdk/src/config/patterns.json) 설정 파일을 통하여 탐지 정규식을 손쉽게 보완 및 변경할 수 있습니다.

6. **서버 측 요금 산정 위임**
   * 클라이언트 SDK 내에 하드코딩되던 단가 추정 계산기를 전면 배제하고, 순수 토큰 사용량 정보(`TokenUsage`)만을 수집 서버로 안전하게 넘겨 비용 계산 정합성을 백엔드에서 일관되게 제어합니다.

---

## 🚀 시작하기

### 설치
```bash
pnpm add @repo/sdk
```

### 기본 사용법 (TypeScript)

```typescript
import { lynx } from "@repo/sdk";
import { OpenAI } from "openai";

// 1. LLM 클라이언트 계측 등록
const openai = new OpenAI();
const instrumentedOpenAI = lynx.instrumentLLM(openai, {
  modelLabel: "gpt-4o"
});

// 2. 도구(Tool) 계측 등록
const searchWeb = lynx.instrumentTool("searchWeb", async (query: string) => {
  // 웹 검색 수행 로직
  return `Search result for ${query}`;
});

// 3. 에이전트 런타임 추적 컨텍스트 시작
async function main() {
  await lynx.run("MainAgent", async () => {
    // LLM 호출 추적
    const response = await instrumentedOpenAI.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: "Tell me about the universe." }],
    });
    
    // 도구 실행 추적
    const info = await searchWeb("latest universe discovery");
    
    console.log(response.choices[0].message.content, info);
  });
}

main();
```

## ⚙️ 설정 옵션

환경 변수(`process.env`)를 사용하여 간편하게 SDK 설정을 오버라이드할 수 있습니다:

| 환경 변수명 | 기본값 | 설명 |
| :--- | :--- | :--- |
| `LYNX_CLIENT_ID` | `local_dev_env` | 클라이언트 서비스 구별 식별자 |
| `LYNX_CLOUD_URL` | `http://localhost:4000` | Lynx 수집 서버 엔드포인트 기본 URL |
| `LYNX_SAMPLE_RATE` | `1.0` | 텔레메트리 샘플링 비율 (0.0 ~ 1.0) |
| `LYNX_CAPTURE_MODE` | `smart` | 압축 모드 (`full` 전체 전송, `metadata-only` 메타 정보만, `smart` 지능형 압축) |
| `LYNX_MAX_PAYLOAD_LENGTH` | `1000` | 단일 문자열 값 최대 허용 길이 (스마트 압축 적용 시) |
