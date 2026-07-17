import { z } from 'zod';

export const FactType = z.enum([
  'function',
  'class',
  'interface',
  'variable',
  'dependency',
  'module',
  'type',
  'enum',
]);

export const FactSchema = z.object({
  id: z.string().min(1),
  type: FactType,
  filepath: z.string(),
  line_start: z.number().int().positive(),
  line_end: z.number().int().positive(),
  name: z.string(),
  qualified_name: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  content_hash: z.string(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Fact = z.infer<typeof FactSchema>;
export type FactType = z.infer<typeof FactType>;

export const FactEdgeSchema = z.object({
  source_id: z.string(),
  target_id: z.string(),
  relation: z.enum([
    'calls',
    'imports',
    'extends',
    'implements',
    'uses_type',
    'contains',
    'decorates',
  ]),
});

export type FactEdge = z.infer<typeof FactEdgeSchema>;

export const ProjectMetadataSchema = z.object({
  name: z.string(),
  languages: z.array(z.string()),
  dependencies: z.record(z.string(), z.string()),
  total_files: z.number().int(),
  loc: z.number().int(),
  entry_points: z.array(z.object({
    path: z.string(),
    type: z.enum(['library_entry', 'cli_entry', 'api_entry']),
  })),
  module_topology: z.array(z.object({
    module: z.string(),
    dependencies: z.array(z.string()),
  })),
});

export type ProjectMetadata = z.infer<typeof ProjectMetadataSchema>;
