import type { IngestEvent } from "./event.schema.js";
import {
  OpenAPIEventRepository,
  openAPIEventRepository,
} from "./event.repository.js";

/** SDK 이벤트 수집과 Run 조회 유스케이스를 처리합니다. */
export class OpenAPIEventService {
  /** 테스트에서 저장소를 교체할 수 있도록 의존성을 주입받습니다. */
  constructor(
    private readonly repository: OpenAPIEventRepository = openAPIEventRepository,
  ) {}

  /**
   * SDK 이벤트를 개별적으로 검증하고 저장합니다.
   *
   * 일부 이벤트 저장에 실패해도 나머지 이벤트는 계속 처리하며, 재시도할
   * 항목과 영구 거절할 항목을 eventId 단위로 구분합니다.
   */
  async ingestBatch(
    workspaceId: string,
    environment: string,
    events: IngestEvent[],
  ) {
    const retryableEventIds = new Set<string>();
    const rejectedEventIds = new Set<string>();
    let accepted = 0;
    for (const event of events) {
      try {
        // payload의 워크스페이스 값은 API 키로 확인한 경계를 넘을 수 없습니다.
        if (event.workspaceId && event.workspaceId !== workspaceId) {
          if (event.eventId) rejectedEventIds.add(event.eventId);
          continue;
        }
        if (
          event.eventId &&
          (await this.repository.findEvent(
            workspaceId,
            event.clientId,
            event.eventId,
          ))
        ) {
          // 같은 eventId 재전송은 성공으로 처리해 SDK 재시도를 멱등하게 만듭니다.
          accepted += 1;
          continue;
        }
        const trustedEvent = {
          ...event,
          payload: { ...event.payload, workspaceId, environment },
        };
        const agent = await this.repository.findOrCreateAgent(
          workspaceId,
          trustedEvent,
        );
        const session = await this.repository.findOrCreateSession(
          workspaceId,
          trustedEvent,
          agent,
        );
        await this.repository.saveEvent(session, trustedEvent);
        accepted += 1;
      } catch (error) {
        if (event.eventId) {
          if (this.isPermanentDatabaseError(error))
            rejectedEventIds.add(event.eventId);
          else retryableEventIds.add(event.eventId);
        }
      }
    }
    const success = retryableEventIds.size === 0 && rejectedEventIds.size === 0;
    return {
      success,
      accepted,
      retryableEventIds: [...retryableEventIds],
      rejectedEventIds: [...rejectedEventIds],
    };
  }

  /** 워크스페이스의 Run을 안정적인 복합 커서로 페이지 조회합니다. */
  async listRuns(
    workspaceId: string,
    input: {
      cursor?: string;
      limit: number;
      agentId?: string;
      status?: string;
    },
  ) {
    const rows = await this.repository.listRuns(workspaceId, input);
    const hasMore = rows.length > input.limit;
    const items = rows.slice(0, input.limit).map((run) => this.toRun(run));
    const last = items.at(-1);
    return {
      items,
      nextCursor: hasMore && last ? `${last.startedAt}|${last.id}` : null,
    };
  }

  /** 워크스페이스 경계 안에서 Run과 전체 이벤트 타임라인을 조회합니다. */
  async getRun(workspaceId: string, runId: string) {
    const run = await this.repository.findRun(workspaceId, runId);
    if (!run) return null;
    return {
      ...this.toRun(run),
      events: run.events.map((event) => ({
        id: event.id,
        eventId: event.clientEventId ?? null,
        eventType: event.eventType,
        label: event.label,
        timestamp: event.timestamp.toISOString(),
        payload: event.payload,
      })),
    };
  }

  /** Session 저장 모델을 외부 Run 응답 형태로 변환합니다. */
  private toRun(
    run: Awaited<ReturnType<OpenAPIEventRepository["listRuns"]>>[number],
  ) {
    return {
      id: run.id,
      runId: run.name,
      status: run.status,
      startedAt: run.startedAt.toISOString(),
      endedAt: run.endedAt?.toISOString() ?? null,
      agent: { id: run.agent.id, name: run.agent.name },
      usage: {
        promptTokens: run.totalPromptTokens,
        completionTokens: run.totalCompletionTokens,
        totalTokens: run.totalTokens,
        cost: Number(run.totalCost),
      },
    };
  }

  /** 재시도로 해결되지 않는 PostgreSQL 입력 오류인지 판별합니다. */
  private isPermanentDatabaseError(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "22P02"
    );
  }
}

/** OpenAPI 이벤트 요청을 처리하는 기본 서비스 인스턴스입니다. */
export const openAPIEventService = new OpenAPIEventService();
