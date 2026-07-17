import fs from 'fs/promises';
import path from 'path';
import Database from 'better-sqlite3';
import { insertEvidence } from '../store.js';

const TEST_PATTERNS = [
  /test/i,
  /spec/i,
  /\.test\./i,
  /\.spec\./i,
  /_test\./i,
  /_spec\./i,
];

const TEST_DIRS = [
  'test', 'tests', '__tests__', 'spec', 'specs',
  'test/', '__test__/', 'testutils/', 'fixtures/',
];

const BENCHMARK_PATTERNS = [
  /benchmark/i,
  /bench/i,
  /perf/i,
  /\.bench\./i,
];

export interface TestInfo {
  filePath: string;
  isTest: boolean;
  isBenchmark: boolean;
  testFramework: string | null;
}

export function detectTestFile(filePath: string): TestInfo {
  const fileName = path.basename(filePath);
  const dirName = path.dirname(filePath);

  const isTest = TEST_PATTERNS.some(p => p.test(fileName)) ||
                 TEST_DIRS.some(d => dirName.includes(d));
  const isBenchmark = BENCHMARK_PATTERNS.some(p => p.test(fileName));

  let testFramework: string | null = null;
  if (isTest) {
    if (fileName.includes('.test.') || fileName.includes('.spec.')) {
      testFramework = 'jest/vitest';
    } else if (dirName.includes('__tests__')) {
      testFramework = 'jest';
    } else if (dirName.includes('spec')) {
      testFramework = 'jasmine';
    }
  }

  return { filePath, isTest, isBenchmark, testFramework };
}

export async function detectTestsInProject(
  projectPath: string,
  files: string[]
): Promise<TestInfo[]> {
  const results: TestInfo[] = [];

  for (const file of files) {
    const fullPath = path.join(projectPath, file);
    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      const info = detectTestFile(file);

      // Additional heuristic: check for test frameworks in imports
      if (!info.isTest && content.includes('describe(') && content.includes('it(')) {
        info.isTest = true;
        info.testFramework = 'jest/vitest';
      }

      results.push(info);
    } catch {
      // skip unreadable files
    }
  }

  return results;
}

export function bindTestEvidence(
  db: Database.Database,
  project: string,
  testFiles: TestInfo[]
): number {
  let evidenceCount = 0;

  for (const testInfo of testFiles) {
    if (!testInfo.isTest && !testInfo.isBenchmark) continue;

    // Find nodes in this test file
    const nodes = db.prepare(
      'SELECT id FROM nodes WHERE project = ? AND file_path = ?'
    ).all(project, testInfo.filePath) as Array<{ id: number }>;

    for (const node of nodes) {
      const evidenceId = `test-${testInfo.filePath}-${node.id}`;
      const type = testInfo.isBenchmark ? 'benchmark' : 'test_coverage';

      insertEvidence(db, {
        id: evidenceId,
        fact_id: node.id,
        type,
        description: testInfo.isBenchmark
          ? `Benchmark test in ${testInfo.filePath}`
          : `Test coverage in ${testInfo.filePath}`,
        confidence: 0.8,
        evidence_score: testInfo.isBenchmark ? 0.9 : 0.7,
      });
      evidenceCount++;
    }
  }

  return evidenceCount;
}
