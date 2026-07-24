import { z } from "zod";

export const CreateIssueRecordSchema = z.object({
  sdkInstanceId: z.string().trim().min(1).max(120),
  clientRecordId: z.string().trim().min(1).max(160),
  recordKind: z.enum(["DETECTION", "RECOVERY"]),
  detectionType: z.string().trim().min(1).max(50),
  runId: z.string().trim().min(1).max(255).optional(),
  sessionId: z.string().trim().min(1).max(255).optional(),
  eventId: z.string().trim().min(1).max(160).optional(),
  agentId: z.string().trim().min(1).max(255),
  policyId: z.string().trim().min(1).max(255).optional(),
  promptVersionId: z.string().uuid().optional(),
  detectedAt: z.number().int().positive(),
  payload: z.record(z.string(), z.unknown()).default({}),
  evidence: z.record(z.string(), z.unknown()).optional(),
});

export const IssueRecordAcceptedResponseSchema = z.object({
  recordId: z.string().uuid(),
  status: z.enum(["RECEIVED", "EVALUATING", "DECIDED", "FAILED"]),
  isNew: z.boolean(),
});

export type CreateIssueRecordDto = z.infer<typeof CreateIssueRecordSchema>;
export type IssueRecordAcceptedResponseDto = z.infer<
  typeof IssueRecordAcceptedResponseSchema
>;
