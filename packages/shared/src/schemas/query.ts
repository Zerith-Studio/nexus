import { z } from "zod";

export const knowledgeBaseQuerySchema = z.object({
  query: z.string().trim().min(2).max(2_000),
  topK: z.number().int().min(1).max(20).default(8),
});

export type KnowledgeBaseQueryInput = z.infer<typeof knowledgeBaseQuerySchema>;
