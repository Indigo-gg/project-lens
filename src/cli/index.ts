#!/usr/bin/env node
import { Command } from 'commander';
import { startMcpServer } from '../mcp/server.js';
import { handleObserve } from '../mcp/tools/observe.js';
import { handleExplore } from '../mcp/tools/explore.js';
import { handleTrace } from '../mcp/tools/trace.js';
import { handleExportSnapshot } from '../mcp/tools/snapshot.js';

const program = new Command();

program
  .name('lens')
  .description('Project-Lens: Project Understanding Layer for AI Agents')
  .version('6.0.0');

program
  .command('serve')
  .description('Start the MCP server (stdio transport)')
  .action(async () => {
    await startMcpServer();
  });

program
  .command('observe')
  .description('Scan a project and build its knowledge index')
  .option('-p, --path <path>', 'Project path', '.')
  .option('-f, --force', 'Force full re-index', false)
  .action(async (options) => {
    console.log(`Observing project at: ${options.path}`);
    const result = await handleObserve({
      project_path: options.path,
      force_reindex: options.force,
    });
    const data = JSON.parse(result.content[0].text);
    console.log('\n=== Observation Results ===');
    console.log(`Project: ${data.project}`);
    console.log(`Files scanned: ${data.stats?.filesScanned ?? 0}`);
    console.log(`Facts extracted: ${data.stats?.factsExtracted ?? 0}`);
    console.log(`Edges created: ${data.stats?.edgesCreated ?? 0}`);
    console.log(`Evidences: ${data.stats?.evidences ?? 0}`);
    console.log(`Decision traces: ${data.stats?.decisionTraces ?? 0}`);
    if (data.stats?.errors > 0) {
      console.log(`Errors: ${data.stats.errors}`);
    }
  });

program
  .command('explore')
  .description('Explore project knowledge')
  .argument('[query]', 'Search query')
  .option('-c, --category <cat>', 'Filter by category')
  .option('-s, --sort <sort>', 'Sort by (credibility|importance|recent)', 'credibility')
  .option('-l, --limit <n>', 'Max results', '20')
  .action(async (query, options) => {
    const result = await handleExplore({
      query,
      category: options.category,
      sort_by: options.sort,
      limit: parseInt(options.limit),
    });
    const data = JSON.parse(result.content[0].text);
    console.log(`\n=== Explore Results (${data.total_count} total) ===`);
    for (const r of data.results ?? []) {
      console.log(`\n[${r.fact.type}] ${r.fact.name}`);
      console.log(`  File: ${r.fact.filepath}:${r.fact.line_range[0]}-${r.fact.line_range[1]}`);
      console.log(`  Credibility: ${r.credibility.score.toFixed(3)}`);
      console.log(`  Importance: ${r.importance.score.toFixed(3)}`);
      if (r.evidence.length > 0) {
        console.log(`  Evidence: ${r.evidence[0].type} - ${r.evidence[0].description?.substring(0, 80)}`);
      }
    }
    if (data.navigation_guide && data.navigation_guide.length > 0) {
      console.log('\n=== Navigation Guide ===');
      for (const nav of data.navigation_guide) {
        console.log(`  ${nav.from} → ${nav.to} (via ${nav.via})`);
      }
    }
  });

program
  .command('trace')
  .description('Trace decision history')
  .argument('[query]', 'Search query')
  .option('-f, --fact-id <id>', 'Limit to specific fact')
  .option('-p, --filepath <path>', 'Limit to specific file')
  .option('-a, --author <author>', 'Limit to specific author')
  .option('-l, --limit <n>', 'Max results', '50')
  .action(async (query, options) => {
    const result = await handleTrace({
      query,
      fact_id: options.factId ? parseInt(options.factId) : undefined,
      filepath: options.filepath,
      author: options.author,
      limit: parseInt(options.limit),
    });
    const data = JSON.parse(result.content[0].text);
    console.log(`\n=== Decision Trace ===`);
    console.log(`Timeline entries: ${data.timeline.length}`);
    for (const entry of data.timeline.slice(0, 10)) {
      console.log(`\n[${entry.change_type}] ${entry.commit_hash.substring(0, 7)}`);
      console.log(`  Author: ${entry.author}`);
      console.log(`  Time: ${entry.timestamp}`);
      console.log(`  Description: ${entry.description.substring(0, 100)}`);
      console.log(`  Affected facts: ${entry.affected_facts.length}`);
    }
    if (data.decision_summary) {
      console.log('\n=== Key Decisions ===');
      for (const decision of data.decision_summary.key_decisions) {
        console.log(`  ${decision.timestamp}: ${decision.description.substring(0, 80)}`);
      }
    }
  });

program
  .command('snapshot')
  .description('Export project knowledge package')
  .option('-f, --format <fmt>', 'Output format (json|compact)', 'compact')
  .option('-m, --max-tokens <n>', 'Max tokens', '50000')
  .action(async (options) => {
    const result = await handleExportSnapshot({
      format: options.format as 'json' | 'compact',
      max_tokens: parseInt(options.maxTokens),
    });
    const data = JSON.parse(result.content[0].text);
    console.log(JSON.stringify(data, null, 2));
  });

program.parse();
