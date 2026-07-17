import { z } from 'zod';

export const EvidenceType = z.enum([
  'git_commit',
  'test_coverage',
  'benchmark',
  'dependency',
  'code_review',
]);

export const EvidenceSchema = z.object({
  id: z.string().min(1),
  fact_id: z.string(),
  type: EvidenceType,
  commit_hash: z.string().optional(),
  author: z.string().optional(),
  timestamp: z.string().optional(),
  description: z.string(),
  confidence: z.number().min(0).max(1).default(1.0),
});

export type Evidence = z.infer<typeof EvidenceSchema>;
export type EvidenceType = z.infer<typeof EvidenceType>;

export const ChangeType = z.enum([
  'introduction',
  'modification',
  'replacement',
  'removal',
]);

export const DecisionTraceSchema = z.object({
  id: z.string().min(1),
  fact_id: z.string(),
  version: z.string().optional(),
  commit_hash: z.string(),
  author: z.string(),
  timestamp: z.string(),
  ast_change: z.string(),
  change_type: ChangeType,
  related_issue: z.string().optional(),
});

export type DecisionTrace = z.infer<typeof DecisionTraceSchema>;
export type ChangeType = z.infer<typeof ChangeType>;
