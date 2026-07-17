import type { ProjectSnapshot } from './builder.js';
import { estimateTokens } from './token-estimator.js';

export interface CompressedSnapshot extends ProjectSnapshot {
  _compressed: boolean;
  _original_token_estimate: number;
  _compressed_token_estimate: number;
}

export function compressSnapshot(
  snapshot: ProjectSnapshot,
  maxTokens: number = 50000
): CompressedSnapshot {
  const originalEstimate = estimateTokens(JSON.stringify(snapshot));

  if (originalEstimate <= maxTokens) {
    return {
      ...snapshot,
      _compressed: false,
      _original_token_estimate: originalEstimate,
      _compressed_token_estimate: originalEstimate,
    };
  }

  // Compress strategy:
  // 1. Limit key_facts to top N
  // 2. Limit recent_decisions to top N
  // 3. Limit top_evidence to top N
  // 4. Truncate long descriptions

  const budgetPerSection = Math.floor(maxTokens / 4);
  const factsBudget = Math.floor(budgetPerSection * 0.4);
  const decisionsBudget = Math.floor(budgetPerSection * 0.3);
  const evidenceBudget = Math.floor(budgetPerSection * 0.3);

  // Estimate tokens per fact
  const avgFactTokens = snapshot.key_facts.length > 0
    ? estimateTokens(JSON.stringify(snapshot.key_facts[0]))
    : 100;

  const maxFacts = Math.min(
    snapshot.key_facts.length,
    Math.floor(factsBudget / avgFactTokens)
  );

  // Estimate tokens per decision
  const avgDecisionTokens = snapshot.recent_decisions.length > 0
    ? estimateTokens(JSON.stringify(snapshot.recent_decisions[0]))
    : 80;

  const maxDecisions = Math.min(
    snapshot.recent_decisions.length,
    Math.floor(decisionsBudget / avgDecisionTokens)
  );

  // Estimate tokens per evidence
  const avgEvidenceTokens = snapshot.top_evidence.length > 0
    ? estimateTokens(JSON.stringify(snapshot.top_evidence[0]))
    : 60;

  const maxEvidence = Math.min(
    snapshot.top_evidence.length,
    Math.floor(evidenceBudget / avgEvidenceTokens)
  );

  // Compress
  const compressed: CompressedSnapshot = {
    ...snapshot,
    key_facts: snapshot.key_facts.slice(0, maxFacts),
    recent_decisions: snapshot.recent_decisions.slice(0, maxDecisions),
    top_evidence: snapshot.top_evidence.slice(0, maxEvidence),
    _compressed: true,
    _original_token_estimate: originalEstimate,
    _compressed_token_estimate: 0,
  };

  compressed._compressed_token_estimate = estimateTokens(JSON.stringify(compressed));

  return compressed;
}
