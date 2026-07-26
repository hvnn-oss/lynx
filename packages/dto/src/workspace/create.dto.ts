import { z } from "zod";

export const CreateWorkspaceSchema = z.object({
  name: z.string().trim().min(1),
  orgId: z.uuid(),
});

export type CreateWorkspaceDto = z.infer<typeof CreateWorkspaceSchema>;

export const WorkspaceResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  orgId: z.uuid(),
});

export type WorkspaceResponseDto = z.infer<typeof WorkspaceResponseSchema>;

export const WorkspaceListResponseSchema = z.object({
  items: z.array(WorkspaceResponseSchema),
});

export type WorkspaceListResponseDto = z.infer<
  typeof WorkspaceListResponseSchema
>;
