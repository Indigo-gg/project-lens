import Database from 'better-sqlite3';
import path from 'path';
import { bindEvidenceFromGit } from './git-signal.js';
import { detectTestsInProject, bindTestEvidence } from './test-detector.js';

export interface BindResult {
  gitEvidence: number;
  gitDecisionTraces: number;
  testEvidence: number;
  warnings: string[];
}

export async function bindAllEvidence(
  db: Database.Database,
  project: string,
  projectPath: string,
  files: string[]
): Promise<BindResult> {
  // Bind Git evidence
  const { evidenceCount: gitEvidence, decisionTraceCount: gitDecisionTraces, warnings } =
    bindEvidenceFromGit(db, project, projectPath);

  // Detect and bind test evidence
  const testFiles = await detectTestsInProject(projectPath, files);
  const testEvidence = bindTestEvidence(db, project, testFiles);

  return {
    gitEvidence,
    gitDecisionTraces,
    testEvidence,
    warnings,
  };
}
