import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { scanFiles, type FileHash } from './file-scanner.js';
import { parseFile, initParser, isSupportedFile, type AstNode } from './ast-parser.js';
import { buildFacts, type Fact, type Edge } from './fact-builder.js';
import { bindAllEvidence } from '../evidence/index.js';
import {
  openDatabase, getFileHashes, saveFileHashes, removeFileHashes,
  insertNode, insertEdge, upsertProject,
  syncNodesFts, syncEvidenceFts, syncDecisionTracesFts,
} from '../store.js';

export interface ExtractResult {
  project: string;
  stats: {
    filesScanned: number;
    factsExtracted: number;
    edgesCreated: number;
    filesParsed: number;
    errors: number;
    evidences: number;
    decisionTraces: number;
  };
  warnings: string[];
  modules: Array<{
    path: string;
    facts: number;
  }>;
}

interface FileData {
  relPath: string;
  fullPath: string;
  content: string;
  size: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ParseResultCache = { nodes: any[]; language: string; error?: string };

export async function extractProject(
  projectPath: string,
  options: { forceReindex?: boolean } = {}
): Promise<ExtractResult> {
  const projectName = path.basename(projectPath);
  const { db, close } = openDatabase(projectName);

  try {
    // Initialize parser
    await initParser();

    // Get existing file hashes for incremental scan
    const existingHashes = options.forceReindex
      ? new Map<string, FileHash>()
      : getFileHashes(db, projectName);

    // Scan files for changes
    const scanResult = await scanFiles(projectPath, existingHashes);

    // Process changed and added files
    const filesToProcess = [...scanResult.changed, ...scanResult.added];

    let factsExtracted = 0;
    let edgesCreated = 0;
    let errors = 0;
    const moduleStats = new Map<string, number>();

    // Phase 1: Read all files and parse ASTs asynchronously
    const fileDataMap = new Map<string, FileData>();
    const parseResults = new Map<string, ParseResultCache>();

    for (const fileHash of filesToProcess) {
      const fullPath = path.join(projectPath, fileHash.relPath);

      try {
        const content = await fsp.readFile(fullPath, 'utf-8');
        fileDataMap.set(fileHash.relPath, {
          relPath: fileHash.relPath,
          fullPath,
          content,
          size: fileHash.size,
        });

        if (isSupportedFile(fullPath)) {
          const parseResult = await parseFile(fullPath, content);
          parseResults.set(fileHash.relPath, parseResult);

          if (parseResult.error) {
            errors++;
            console.error(`Parse error in ${fileHash.relPath}: ${parseResult.error}`);
          }
        }
      } catch (err) {
        errors++;
        console.error(`Error reading ${fileHash.relPath}: ${err}`);
      }
    }

    // Phase 2: Database operations in a transaction
    const runTransaction = db.transaction(() => {
      // Remove facts for deleted files (with cascade due to ON DELETE CASCADE)
      for (const removedPath of scanResult.removed) {
        db.prepare('DELETE FROM nodes WHERE project = ? AND file_path = ?').run(projectName, removedPath);
      }

      // Process each file
      for (const fileHash of filesToProcess) {
        const fileData = fileDataMap.get(fileHash.relPath);
        if (!fileData) continue;

        if (!isSupportedFile(fileData.fullPath)) {
          // Store non-parseable files as simple nodes
          insertNode(db, {
            project: projectName,
            label: 'file',
            name: fileHash.relPath,
            qualified_name: fileHash.relPath,
            file_path: fileHash.relPath,
            start_line: 1,
            end_line: 1,
            properties: { size: fileHash.size },
          });
          factsExtracted++;
          continue;
        }

        const parseResult = parseResults.get(fileHash.relPath);
        if (!parseResult) continue;

        // Build facts and edges from AST nodes
        const { facts, edges } = buildFacts(projectName, fileHash.relPath, parseResult.nodes as AstNode[], fileData.content);

        // Insert facts as nodes
        for (const fact of facts) {
          insertNode(db, fact);
          factsExtracted++;

          // Track module stats
          const moduleDir = path.dirname(fact.file_path);
          moduleStats.set(moduleDir, (moduleStats.get(moduleDir) ?? 0) + 1);
        }

        // Insert edges
        for (const edge of edges) {
          // Resolve qualified names to node IDs
          const sourceRow = db.prepare('SELECT id FROM nodes WHERE project = ? AND qualified_name = ?')
            .get(projectName, edge.source_qualified_name) as { id: number } | undefined;
          const targetRow = db.prepare('SELECT id FROM nodes WHERE project = ? AND qualified_name = ?')
            .get(projectName, edge.target_qualified_name) as { id: number } | undefined;

          if (sourceRow && targetRow) {
            insertEdge(db, {
              project: projectName,
              source_id: sourceRow.id,
              target_id: targetRow.id,
              type: edge.type,
              properties: edge.properties,
            });
            edgesCreated++;
          }
        }
      }

      // Save updated file hashes
      const allHashes = [...scanResult.changed, ...scanResult.added, ...scanResult.unchanged.map(p => existingHashes.get(p)!)].filter(Boolean);
      saveFileHashes(db, projectName, allHashes);
      removeFileHashes(db, projectName, scanResult.removed);
    });

    // Execute transaction
    runTransaction();

    // Sync FTS indexes
    syncNodesFts(db);

    // Bind evidence from Git history and test detection (async, outside transaction)
    const allFiles = [...scanResult.changed, ...scanResult.added, ...scanResult.unchanged].map(f =>
      typeof f === 'string' ? f : f.relPath
    );
    const evidenceResult = await bindAllEvidence(db, projectName, projectPath, allFiles);
    syncEvidenceFts(db);
    syncDecisionTracesFts(db);

    // Update project metadata
    const totalFiles = scanResult.changed.length + scanResult.added.length + scanResult.unchanged.length;
    upsertProject(db, {
      name: projectName,
      root_path: projectPath,
      total_files: totalFiles,
    });

    // Build module stats
    const modules = Array.from(moduleStats.entries()).map(([path, facts]) => ({
      path,
      facts,
    }));

    return {
      project: projectName,
      stats: {
        filesScanned: totalFiles,
        factsExtracted,
        edgesCreated,
        filesParsed: filesToProcess.length,
        errors,
        evidences: evidenceResult.gitEvidence + evidenceResult.testEvidence,
        decisionTraces: evidenceResult.gitDecisionTraces,
      },
      warnings: evidenceResult.warnings,
      modules,
    };
  } finally {
    close();
  }
}
