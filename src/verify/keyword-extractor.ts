export interface ExtractedKeywords {
  keywords: string[];
  entities: string[];
  numbers: string[];
}

const ENTITY_PATTERNS = [
  // Technology names
  /\b(redis|mysql|postgres|mongodb|kafka|rabbitmq|docker|kubernetes|k8s)\b/gi,
  /\b(react|vue|angular|svelte|nextjs|nuxt|express|fastify|koa|hono)\b/gi,
  /\b(typescript|javascript|python|go|rust|java|kotlin|ruby|php|swift)\b/gi,
  /\b(prisma|drizzle|typeorm|sequelize|mongoose)\b/gi,
  /\b(jest|vitest|mocha|pytest|go test)\b/gi,
  /\b(webpack|vite|esbuild|rollup|turbopack)\b/gi,
  // Architecture patterns
  /\b(microservice|monolith|serverless|lambda|edge|cdn)\b/gi,
  /\b(rest|graphql|grpc|websocket|socket\.io)\b/gi,
  /\b(cache|caching|queue|pub\/sub|event|stream)\b/gi,
  /\b(auth|authn|authz|jwt|oauth|saml)\b/gi,
];

const NUMBER_PATTERN = /\b\d+(?:\.\d+)?(?:ms|s|m|h|%)?\b/g;

export function extractKeywords(statement: string): ExtractedKeywords {
  const keywords: string[] = [];
  const entities: string[] = [];
  const numbers: string[] = [];

  // Extract entities (technology names, patterns)
  for (const pattern of ENTITY_PATTERNS) {
    const matches = statement.match(pattern);
    if (matches) {
      entities.push(...matches.map(m => m.toLowerCase()));
    }
  }

  // Extract numbers
  const numberMatches = statement.match(NUMBER_PATTERN);
  if (numberMatches) {
    numbers.push(...numberMatches);
  }

  // Extract general keywords (non-trivial words)
  const words = statement
    .replace(/[^\w\s\u4e00-\u9fff]/g, ' ') // Keep Chinese characters
    .split(/\s+/)
    .filter(w => w.length > 2)
    .map(w => w.toLowerCase());

  // Filter out stop words
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
    'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
    'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over',
    'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when',
    'where', 'why', 'how', 'all', 'both', 'each', 'few', 'more', 'most',
    'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same',
    'so', 'than', 'too', 'very', 's', 't', 'don', 'now',
    // Chinese stop words
    '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一',
    '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着',
    '没有', '看', '好', '自己', '这', '他', '她', '它', '们', '那',
  ]);

  for (const word of words) {
    if (!stopWords.has(word) && !entities.includes(word)) {
      keywords.push(word);
    }
  }

  // Deduplicate
  return {
    keywords: [...new Set(keywords)],
    entities: [...new Set(entities)],
    numbers: [...new Set(numbers)],
  };
}
