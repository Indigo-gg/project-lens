import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { handleObserve } from './tools/observe.js';
import { handleExplore } from './tools/explore.js';
import { handleTrace } from './tools/trace.js';
import { handleVerifyStatement } from './tools/verify.js';
import { handleExportSnapshot } from './tools/snapshot.js';
import { handleRender } from './tools/render.js';

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'project-lens',
    version: '6.0.0',
  });

  // Tool 1: observe
  server.registerTool('observe', {
    description: 'Scan a project and build its knowledge index (facts, edges, evidence)',
    inputSchema: {
      project_path: z.string().optional().describe('Project root path (default: cwd)'),
      depth: z.number().optional().default(2).describe('Dependency analysis depth'),
      force_reindex: z.boolean().optional().default(false).describe('Force full re-index'),
    },
  }, async (args) => {
    const result = await handleObserve(args);
    return result;
  });

  // Tool 2: explore
  server.registerTool('explore', {
    description: 'Explore project knowledge, provide navigation paths. Answers "how does this feature work?"',
    inputSchema: {
      query: z.string().optional().describe('Full-text search keyword'),
      category: z.string().optional().describe('Filter by category (performance, security, data, ...)'),
      evidence_type: z.string().optional().describe('Filter by evidence type (git_commit, test, benchmark, dependency)'),
      fact_type: z.string().optional().describe('Filter by fact type (function, class, interface, module)'),
      sort_by: z.enum(['credibility', 'importance', 'recent']).optional().default('credibility').describe('Sort results by'),
      limit: z.number().optional().default(20).describe('Max results to return'),
      cursor: z.string().optional().describe('Pagination cursor'),
      context_scope: z.array(z.string()).optional().describe('Limit search scope to specific paths'),
    },
  }, async (args) => {
    const result = await handleExplore(args);
    return result;
  });

  // Tool 3: verify
  server.registerTool('verify', {
    description: 'Verify whether a statement has supporting code evidence',
    inputSchema: {
      statement: z.string().describe('Statement to verify (e.g., "优化了缓存性能")'),
      context_scope: z.array(z.string()).optional().describe('Limit search scope to specific paths'),
    },
  }, async (args) => {
    const result = await handleVerifyStatement(args);
    return result;
  });

  // Tool 4: trace
  server.registerTool('trace', {
    description: 'Trace decision history, understand why something was implemented',
    inputSchema: {
      query: z.string().optional().describe('Search keyword'),
      fact_id: z.number().optional().describe('Limit to specific fact'),
      filepath: z.string().optional().describe('Limit to specific file'),
      author: z.string().optional().describe('Limit to specific author'),
      date_from: z.string().optional().describe('Start date (ISO format)'),
      date_to: z.string().optional().describe('End date (ISO format)'),
      limit: z.number().optional().default(50).describe('Max results to return'),
    },
  }, async (args) => {
    const result = await handleTrace(args);
    return result;
  });

  // Tool 5: snapshot
  server.registerTool('snapshot', {
    description: 'Export the project knowledge package (Project Snapshot) for an AI agent',
    inputSchema: {
      format: z.enum(['json', 'compact']).optional().default('compact').describe('Output format'),
      include_git_history: z.boolean().optional().default(true).describe('Include recent git decisions'),
      max_tokens: z.number().optional().default(50000).describe('Max token budget for output'),
    },
  }, async (args) => {
    const result = await handleExportSnapshot(args);
    return result;
  });

  // Tool 6: render
  server.registerTool('render', {
    description: 'Render JSON data to PDF using Typst',
    inputSchema: {
      json_data: z.string().describe('JSON data string'),
      template: z.string().optional().default('modern').describe('Template name'),
    },
  }, async (args) => {
    const result = await handleRender(args);
    return result;
  });

  return server;
}

export async function startMcpServer() {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Project-Lens MCP Server running on stdio');
}
