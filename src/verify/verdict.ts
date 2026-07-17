import Database from 'better-sqlite3';
import { extractKeywords, type ExtractedKeywords } from './keyword-extractor.js';
import { computeConfidence, type ConfidenceResult } from './confidence.js';
import { searchEvidence, type SearchOptions } from '../query/search.js';

export interface VerifyResult {
  confidence: number;
  evidence: Array<{
    fact_id: number;
    filepath: string;
    code_snippet: string;
    evidence_type: string;
    description: string;
    confidence: number;
  }>;
  unsupported_parts: string[];
}

export function verifyStatement(
  db: Database.Database,
  project: string,
  statement: string,
  contextScope?: string[]
): VerifyResult {
  // 1. Extract keywords from statement
  const keywords = extractKeywords(statement);

  // 2. Build search query
  const searchTerms = [...keywords.entities, ...keywords.keywords];
  const searchQuery = searchTerms.join(' ');

  // 3. Search for matching evidence
  const searchResult = searchEvidence(db, project, {
    query: searchQuery,
    limit: 20,
    context_scope: contextScope,
  });

  // 4. Compute confidence for top results
  const verifiedEvidence: VerifyResult['evidence'] = [];
  let totalConfidence = 0;
  let matchCount = 0;

  for (const result of searchResult.results.slice(0, 10)) {
    const confidenceResult = computeConfidence(db, result.fact.id, searchTerms);

    if (confidenceResult.confidence > 0.3) {
      // Get code snippet
      const node = db.prepare(
        'SELECT properties FROM nodes WHERE id = ?'
      ).get(result.fact.id) as { properties: string | null } | undefined;

      const properties = node?.properties ? JSON.parse(node.properties) : {};
      const codeSnippet = (properties.text as string ?? '').substring(0, 200);

      verifiedEvidence.push({
        fact_id: result.fact.id,
        filepath: result.fact.filepath,
        code_snippet: codeSnippet,
        evidence_type: result.evidence[0]?.type ?? 'unknown',
        description: result.fact.summary,
        confidence: confidenceResult.confidence,
      });

      totalConfidence += confidenceResult.confidence;
      matchCount++;
    }
  }

  // 5. Compute average confidence (no verdict - Agent decides)
  const avgConfidence = matchCount > 0 ? totalConfidence / matchCount : 0;

  // 6. Identify unsupported parts
  const unsupportedParts: string[] = [];
  if (keywords.entities.length > 0) {
    const matchedEntities = keywords.entities.filter(e =>
      verifiedEvidence.some(ev =>
        ev.description.toLowerCase().includes(e) ||
        ev.filepath.toLowerCase().includes(e)
      )
    );
    const unmatchedEntities = keywords.entities.filter(e => !matchedEntities.includes(e));
    if (unmatchedEntities.length > 0) {
      unsupportedParts.push(`No evidence for: ${unmatchedEntities.join(', ')}`);
    }
  }

  if (keywords.numbers.length > 0) {
    // Check if numerical claims are supported
    const allText = verifiedEvidence.map(e => e.description + ' ' + e.code_snippet).join(' ');
    const unmatchedNumbers = keywords.numbers.filter(n => !allText.includes(n));
    if (unmatchedNumbers.length > 0) {
      unsupportedParts.push(`Numerical claims not verified: ${unmatchedNumbers.join(', ')}`);
    }
  }

  return {
    confidence: avgConfidence,
    evidence: verifiedEvidence,
    unsupported_parts: unsupportedParts,
  };
}
