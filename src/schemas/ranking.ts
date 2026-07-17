import { z } from 'zod';

export const CredibilityScoreSchema = z.object({
  has_benchmark: z.boolean(),
  has_test: z.boolean(),
  has_docs: z.boolean(),
  has_git_history: z.boolean(),
  score: z.number().min(0).max(1),
});

export const ImportanceScoreSchema = z.object({
  centrality: z.number().min(0).max(1),
  frequency: z.number().min(0).max(1),
  recency: z.number().min(0).max(1),
  score: z.number().min(0).max(1),
});

export const RankedResultSchema = z.object({
  nodeId: z.number(),
  credibility: CredibilityScoreSchema,
  importance: ImportanceScoreSchema,
});

export type CredibilityScore = z.infer<typeof CredibilityScoreSchema>;
export type ImportanceScore = z.infer<typeof ImportanceScoreSchema>;
export type RankedResult = z.infer<typeof RankedResultSchema>;
