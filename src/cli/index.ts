#!/usr/bin/env node
import { Command } from 'commander';
import { startMcpServer } from '../mcp/server.js';
import { handleAnalyzeProject } from '../mcp/tools/analyze-project.js';
import { handleSearchEvidence } from '../mcp/tools/search-evidence.js';
import { handleExportSnapshot } from '../mcp/tools/export-snapshot.js';

const program = new Command();

program
  .name('lens')
  .description('Project-Lens: Project Understanding Layer for AI Agents')
  .version('2.0.0');

program
  .command('serve')
  .description('Start the MCP server (stdio transport)')
  .action(async () => {
    await startMcpServer();
  });

program
  .command('analyze')
  .description('Scan a project and build its knowledge index')
  .option('-p, --path <path>', 'Project path', '.')
  .option('-f, --force', 'Force full re-index', false)
  .action(async (options) => {
    console.log(`Analyzing project at: ${options.path}`);
    const result = await handleAnalyzeProject({
      project_path: options.path,
      force_reindex: options.force,
    });
    const data = JSON.parse(result.content[0].text);
    console.log('\n=== Analysis Results ===');
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
  .command('search')
  .description('Search for evidence in the project')
  .argument('[query]', 'Search query')
  .option('-r, --requirement <req>', 'Search by JD requirement')
  .option('-c, --category <cat>', 'Filter by category')
  .option('-l, --limit <n>', 'Max results', '20')
  .action(async (query, options) => {
    const result = await handleSearchEvidence({
      query,
      requirement: options.requirement,
      category: options.category,
      limit: parseInt(options.limit),
    });
    const data = JSON.parse(result.content[0].text);
    console.log(`\n=== Search Results (${data.total_count} total) ===`);
    for (const r of data.results ?? []) {
      console.log(`\n[${r.fact.type}] ${r.fact.name}`);
      console.log(`  File: ${r.fact.filepath}:${r.fact.line_range[0]}-${r.fact.line_range[1]}`);
      console.log(`  Score: ${r.score.toFixed(3)}`);
      if (r.evidence.length > 0) {
        console.log(`  Evidence: ${r.evidence[0].type} - ${r.evidence[0].description?.substring(0, 80)}`);
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
