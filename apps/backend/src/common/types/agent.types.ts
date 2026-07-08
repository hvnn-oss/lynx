import { EventEntity, SessionEntity } from '@repo/database';

export interface AgentCursorValue {
  name: string;
  id: string;
}

export interface AgentRuntimeStats {
  sessions: SessionEntity[];
  events: EventEntity[];
}
