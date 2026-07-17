import Database from 'better-sqlite3';

export interface ExpandedQuery {
  original: string;
  searchTerms: string[];
  category: string | null;
}

const BUILTIN_SYNONYMS: Record<string, string[]> = {
  redis: ['redis', 'ioredis', 'cache', 'pub/sub', 'session', 'rate limit'],
  kafka: ['kafka', 'message queue', 'pub/sub', 'event', 'stream', 'broker'],
  performance: ['benchmark', 'latency', 'optimization', 'profiling', 'memory', 'cache'],
  concurrency: ['async', 'queue', 'mutex', 'lock', 'worker', 'parallel', 'thread'],
  security: ['auth', 'jwt', 'oauth', 'encrypt', 'hash', 'token', 'permission'],
  testing: ['test', 'spec', 'mock', 'fixture', 'coverage', 'snapshot'],
  'ci/cd': ['ci', 'cd', 'pipeline', 'deploy', 'docker', 'kubernetes', 'helm'],
  database: ['sql', 'postgres', 'mysql', 'mongo', 'prisma', 'drizzle', 'query', 'orm'],
  api: ['rest', 'graphql', 'grpc', 'endpoint', 'route', 'middleware'],
  frontend: ['react', 'vue', 'svelte', 'component', 'state', 'render'],
  backend: ['server', 'endpoint', 'handler', 'middleware', 'route', 'controller'],
  devops: ['docker', 'kubernetes', 'helm', 'ci', 'cd', 'deploy', 'pipeline'],
  monitoring: ['log', 'metric', 'alert', 'trace', 'observability', 'prometheus', 'grafana'],
  caching: ['redis', 'memcached', 'cache', 'lru', 'ttl'],
  'message queue': ['kafka', 'rabbitmq', 'sqs', 'nats', 'pub/sub'],
  authentication: ['auth', 'jwt', 'oauth', 'session', 'token', 'login'],
  authorization: ['permission', 'role', 'rbac', 'acl', 'access'],
  'web framework': ['express', 'fastify', 'koa', 'hono', 'next', 'nuxt'],
  'test framework': ['jest', 'vitest', 'mocha', 'pytest', 'go test'],
  'build tool': ['webpack', 'vite', 'esbuild', 'rollup', 'turbopack'],
  'package manager': ['npm', 'yarn', 'pnpm', 'bun', 'pip', 'go mod'],
};

export function expandRequirement(
  requirement: string,
  db?: Database.Database
): ExpandedQuery {
  const normalized = requirement.toLowerCase().trim();
  let searchTerms: string[] = [];
  let category: string | null = null;

  // 1. Check database synonyms
  if (db) {
    const row = db.prepare(
      'SELECT search_terms, category FROM requirement_synonyms WHERE LOWER(requirement) = ?'
    ).get(normalized) as { search_terms: string; category: string } | undefined;

    if (row) {
      try {
        searchTerms = JSON.parse(row.search_terms);
        category = row.category;
      } catch {
        // ignore parse error
      }
    }
  }

  // 2. Check built-in synonyms
  if (searchTerms.length === 0 && BUILTIN_SYNONYMS[normalized]) {
    searchTerms = BUILTIN_SYNONYMS[normalized];
  }

  // 3. Fallback: use the requirement itself + common variations
  if (searchTerms.length === 0) {
    searchTerms = [normalized];
    // Add common variations
    if (normalized.includes(' ')) {
      // "high concurrency" → ["high concurrency", "concurrency", "parallel", "async"]
      const words = normalized.split(' ');
      searchTerms.push(...words);
    }
  }

  return {
    original: requirement,
    searchTerms: [...new Set(searchTerms)], // deduplicate
    category,
  };
}

export function expandSearchTerms(terms: string[]): string {
  return terms.join(' OR ');
}
