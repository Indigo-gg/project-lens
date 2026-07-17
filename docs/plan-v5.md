# Project-Lens V5 Architecture

> **Version**: 5.0 | **Date**: 2026-07-17 | **Based on**: erge-plus2.md (二哥's guidance)
>
> **Core Principle**: Lens维护的是"项目知识"，Agent维护的是"职业知识"

---

## 〇、V4 → V5 核心变化

| 变化 | V4 | V5 | 原因 |
|:---|:---|:---|:---|
| 工具数量 | 10 个 | **5 个** | 复杂度过高，Agent 不需要 |
| Capability 模块 | extract_capabilities + match_capabilities | **删除** | Agent 能自己总结，Redis 不一定等于 Caching |
| JD Parser | NER 分类 → Requirements | **→ Search Queries** | Claude 已经能读懂 JD，不需要 Lens 做分类 |
| Capability Graph | capabilities + capability_facts 表 | **删除** | Capability 是 Interpretation，不是 Evidence |
| export_context | Repository Memory | **→ export_snapshot** | 名字改为 Project Snapshot |
| Evidence 排序 | 无 | **Evidence Ranking** | Top-N 价值巨大 |
| search_evidence | 简单 FTS | **Universal Query** | 所有查询统一到 search_evidence 的参数 |
| decision_trace | 独立工具 | **→ search_evidence(relation='decision')** | 统一到 search_evidence |

### 设计原则重申

```
Lens 回答: What Exists.      （代码里有什么事实）
Agent 回答: What It Means.    （这些事实意味着什么）
永远不要替 Agent 做判断。
```

### 二哥的原话

> "如果始终坚持一句设计原则：Lens 维护的是'项目知识'，Agent 维护的是'职业知识'。那么很多设计都会自然简化。"

---

## 一、五个核心工具

### Tool 1: analyze_project()

**职责**: 扫描项目，建立索引（Facts + Edges + Evidence）

```typescript
// Input
{
  project_path?: string,        // 默认 cwd
  depth?: number,               // 依赖分析深度，默认 2
  force_reindex?: boolean,      // 强制全量重建
}

// Output
{
  project: {
    name: string,
    languages: string[],
    dependencies: Record<string, string>,
    total_files: number,
    loc: number,
  },
  stats: {
    facts: number,
    edges: number,
    evidences: number,
    decision_traces: number,
  },
  modules: Array<{
    path: string,
    facts: number,
    entry_points: string[],
  }>,
  indexed_at: string,
}
```

**实现路径**:

| 步骤 | 实现 | 参考 |
|:---|:---|:---|
| 文件扫描 | 复用 `file-scanner.ts` (已实现) | - |
| 增量检测 | 复用 `store.ts` file_hashes (已实现) | - |
| AST 解析 | **新增** `extractor/ast-parser.ts` | codebase-memory-mcp (tree-sitter .scm) |
| Fact 构建 | **新增** `extractor/fact-builder.ts` | codebase-memory-mcp (facts + fact_edges) |
| Evidence 绑定 | **新增** `evidence/git-signal.ts` | GitIQ (activity, recency, intensity) |
| 存储 | 扩展 `store.ts` (nodes/edges/evidence) | - |

**复用 vs 新建**:
- ✅ 复用: `file-scanner.ts`, `store.ts` file_hashes
- 🆕 新建: `ast-parser.ts`, `fact-builder.ts`, `git-signal.ts`
- 🔄 扩展: `store.ts` (添加 FTS5, helpers)

---

### Tool 2: search_evidence()

**职责**: 万能搜索入口，所有查询统一到这一个工具

```typescript
// Input (所有参数可选，组合使用)
{
  // 基本搜索
  query?: string,                    // 全文搜索关键词
  
  // 按类型过滤
  category?: string,                 // "performance" | "security" | "data" | ...
  evidence_type?: string,            // "git_commit" | "test" | "benchmark" | "dependency"
  fact_type?: string,                // "function" | "class" | "interface" | "module"
  
  // 按关系搜索
  relation?: string,                 // "decision" → Decision Trace
  
  // JD 需求搜索 (Agent 传入 requirement 的 search_terms)
  requirement?: string,              // "Redis" → 自动扩展为 search_terms
  
  // 排序
  sort_by?: "score" | "recent" | "author",  // 默认 score
  
  // 分页
  limit?: number,                    // 默认 20
  cursor?: string,
}

// Output
{
  results: Array<{
    fact: {
      id: string,
      type: string,
      filepath: string,
      line_range: [number, number],
      name: string,
      summary: string,               // 一行描述
    },
    evidence: Array<{
      type: string,
      commit_hash?: string,
      author?: string,
      timestamp?: string,
      description?: string,
    }>,
    score: number,                    // Evidence Ranking 分数
    decision_trace?: Array<{          // 仅 relation='decision' 时返回
      commit_hash: string,
      author: string,
      timestamp: string,
      change_type: string,
      description: string,
    }>,
  }>,
  next_cursor?: string,
  total_count: number,
}
```

**Evidence Ranking 公式**:

```
Score = w1 × Benchmark + w2 × Tests + w3 × GitEvolution + w4 × LOC + w5 × Recency + w6 × Complexity

其中:
  Benchmark:  有 benchmark evidence = 1.0, else = 0.0
  Tests:      有 test evidence = 1.0, else = 0.0
  GitEvolution: min(commit_count / 10, 1.0)   // 最多10次提交满分
  LOC:        min(line_count / 500, 1.0)       // 最多500行满分
  Recency:    max(0, 1 - days_since_last_commit / 365)  // 一年内线性衰减
  Complexity: min(edge_count / 5, 1.0)          // 最多5条边满分

默认权重: w1=0.25, w2=0.20, w3=0.20, w4=0.10, w5=0.15, w6=0.10
```

**实现路径**:

| 步骤 | 实现 | 参考 |
|:---|:---|:---|
| FTS5 搜索 | **新增** `query/search.ts` | codebase-memory-mcp (FTS5) |
| Requirement 扩展 | **新增** `query/requirement-expander.ts` | 二哥的 Search Query 设计 |
| Evidence Ranking | **新增** `query/ranking.ts` | 二哥的评分公式 |
| Decision Trace | **新增** `query/decision-trace.ts` | GitIQ (Git signal) |
| 排序 + 分页 | `query/search.ts` | - |

**Requirement Search 扩展逻辑**:

Agent 调用 `search_evidence({ requirement: 'Redis' })` 时：

```
1. 查本地 synonym 表 (无则跳过)
2. 自动扩展 search_terms:
   requirement: "Redis" → ["redis", "ioredis", "cache", "pub/sub", "session"]
   requirement: "High Concurrency" → ["async", "queue", "mutex", "lock", "worker", "parallel"]
   requirement: "Performance" → ["benchmark", "latency", "optimization", "profiling", "memory"]
3. 对每个 term 执行 FTS5 搜索
4. 合并去重
5. 按 Evidence Score 排序
6. 返回 Top N
```

**复用 vs 新建**:
- 🆕 全部新建: `query/search.ts`, `query/requirement-expander.ts`, `query/ranking.ts`, `query/decision-trace.ts`
- 🔄 扩展: `store.ts` (FTS5 表)

---

### Tool 3: verify_statement()

**职责**: 验证一句话是否有代码证据支撑

```typescript
// Input
{
  statement: string,                // "优化了缓存性能"
  context_scope?: string[],         // 限定搜索范围
}

// Output
{
  verdict: "SUPPORTED" | "PARTIALLY_SUPPORTED" | "NOT_SUPPORTED",
  confidence: number,               // 0-1
  evidence: Array<{
    fact_id: string,
    filepath: string,
    code_snippet: string,
    evidence_type: string,
    description: string,
  }>,
  unsupported_parts: string[],      // "没有找到性能对比数据"
}
```

**实现路径**:

| 步骤 | 实现 |
|:---|:---|
| 关键词提取 | `verify/keyword-extractor.ts` |
| 搜索 Evidence | 调用 `search_evidence` 内部函数 |
| 置信度计算 | `verify/confidence.ts` |
| 判定逻辑 | `verify/verdict.ts` |

**复用 vs 新建**:
- ✅ 复用: `search_evidence` 的搜索逻辑（内部调用）
- 🆕 新建: `verify/` 目录

---

### Tool 4: export_snapshot()

**职责**: 导出项目知识包（Project Snapshot）

```typescript
// Input
{
  format?: "json" | "compact",      // compact = 压缩版
  include_git_history?: boolean,    // 默认 true
  max_tokens?: number,              // 限制输出大小，默认 50000
}

// Output (compact 模式)
{
  project: {
    name: string,
    languages: string[],
    total_files: number,
    loc: number,
  },
  key_facts: Array<{
    id: string,
    type: string,
    filepath: string,
    summary: string,                // 一行描述
    score: number,                  // Evidence Ranking 分数
  }>,
  recent_decisions: Array<{
    fact_id: string,
    commit_hash: string,
    author: string,
    timestamp: string,
    change_type: string,
    description: string,
  }>,
  evidence_stats: {
    total: number,
    by_type: Record<string, number>,
  },
  top_evidence: Array<{             // Top 20 按分数排序
    fact_id: string,
    filepath: string,
    evidence_type: string,
    description: string,
    score: number,
  }>,
}
```

**压缩策略**:
- 保留: Fact 节点摘要、Top 20 Evidence、最近 30 天 Decision Trace、Evidence 统计
- 丢弃: 完整代码片段、完整 Git 历史、中间 Edge 关系
- 目标: 整个知识包 < 50K tokens

**实现路径**:

| 步骤 | 实现 |
|:---|:---|
| 构建 Snapshot | `snapshot/builder.ts` |
| 压缩逻辑 | `snapshot/compressor.ts` |
| Token 估算 | `snapshot/token-estimator.ts` |

---

### Tool 5: render_resume()

**职责**: 将 resume JSON 渲染为 PDF

```typescript
// Input
{
  resume_json: string,              // Resume JSON string
  template?: string,                // 默认 "modern"
}

// Output
{
  pdf_path: string,                 // 生成的 PDF 文件路径
}
```

**实现路径**: 参考 rendercv (YAML→Pydantic→Jinja2→Typst→PDF)

---

## 二、JD Parser 改造

V4 的 JD Parser 做 NER 分类（Technology / Methodology / Priority），V5 改为 **Search Query Generator**。

### V4 (删除)

```json
{
  "requirements": [
    { "id": "redis", "type": "technology", "priority": "required" }
  ]
}
```

### V5 (新)

JD Parser 不再是独立工具，而是 `search_evidence` 的参数：

```typescript
// Agent 调用:
search_evidence({ requirement: 'Redis' })

// 内部自动扩展为:
search_evidence({ query: 'redis ioredis cache pub/sub session' })
```

Agent 不需要 Lens 做 NER 分类。Agent 自己读 JD，提取关键词，然后用 `search_evidence({ requirement: '关键词' })` 搜索。

**如果 Agent 需要结构化 JD**：

Agent 可以自己解析 JD，不需要 Lens 提供工具。如果实在需要，可以加一个可选的 `parse_jd` 辅助函数（不是 MCP Tool），但不在 V5 核心路径上。

---

## 三、Capability 模块删除

### V4 (删除)

```
src/capability/
├── index.ts
├── extractor.ts    # Fact → Capability 映射
└── matcher.ts      # Capability × JD → Matching Matrix
```

数据库表删除:
```sql
-- DELETE
DROP TABLE capabilities;
DROP TABLE capability_facts;
```

### 为什么删除

1. **Capability 是 Interpretation，不是 Evidence**
   - Redis 不一定代表 Caching，可能是 Pub/Sub, Session, Rate Limit
   - Lens 应该只提供事实，不提供解释

2. **Agent 能自己总结**
   - Claude 看到 Redis 相关的 Evidence，自然会说"这是关于 Caching 的"
   - 不需要 Lens 帮它做这一步

3. **违反设计原则**
   - Lens 回答 What Exists，Capability 回答 What It Means

---

## 四、数据库 Schema 变更

### 删除的表

```sql
DROP TABLE IF EXISTS capabilities;
DROP TABLE IF EXISTS capability_facts;
DROP TABLE IF EXISTS jd_requirements;     -- JD 不再存储，由 Agent 实时处理
```

### 保留的表 (修改)

```sql
-- projects: 保留，增加字段
CREATE TABLE projects (
  name TEXT PRIMARY KEY,
  root_path TEXT NOT NULL,
  languages TEXT,                  -- JSON array
  dependencies TEXT,               -- JSON object
  total_files INTEGER,
  loc INTEGER,
  indexed_at TEXT NOT NULL
);

-- file_hashes: 保留不变
CREATE TABLE file_hashes (
  project TEXT NOT NULL,
  rel_path TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  mtime_ms REAL NOT NULL,
  size INTEGER NOT NULL,
  PRIMARY KEY (project, rel_path)
);

-- nodes: 保留不变 (Facts)
CREATE TABLE nodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project TEXT NOT NULL,
  label TEXT NOT NULL,
  name TEXT NOT NULL,
  qualified_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  start_line INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  properties TEXT,                 -- JSON
  content_hash TEXT,               -- 新增: 用于增量更新
  loc INTEGER,                     -- 新增: 行数，用于 Ranking
  UNIQUE(project, qualified_name)
);

-- edges: 保留不变
CREATE TABLE edges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project TEXT NOT NULL,
  source_id INTEGER NOT NULL REFERENCES nodes(id),
  target_id INTEGER NOT NULL REFERENCES nodes(id),
  type TEXT NOT NULL,
  properties TEXT,
  UNIQUE(source_id, target_id, type)
);

-- evidence: 保留，增加字段
CREATE TABLE evidence (
  id TEXT PRIMARY KEY,
  fact_id INTEGER NOT NULL REFERENCES nodes(id),
  type TEXT NOT NULL,
  commit_hash TEXT,
  author TEXT,
  timestamp TEXT,
  description TEXT NOT NULL,
  confidence REAL DEFAULT 1.0,
  evidence_score REAL DEFAULT 0.0   -- 新增: Ranking 分数
);

-- decision_traces: 保留不变
CREATE TABLE decision_traces (
  id TEXT PRIMARY KEY,
  fact_id INTEGER NOT NULL REFERENCES nodes(id),
  version TEXT,
  commit_hash TEXT NOT NULL,
  author TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  ast_change TEXT NOT NULL,
  change_type TEXT NOT NULL,
  related_issue TEXT
);
```

### 新增的表

```sql
-- FTS5 全文搜索 (search_evidence)
CREATE VIRTUAL TABLE nodes_fts USING fts5(
  name,
  qualified_name,
  file_path,
  properties,
  content=nodes,
  content_rowid=id
);

CREATE VIRTUAL TABLE evidence_fts USING fts5(
  description,
  commit_hash,
  author,
  content=evidence,
  content_rowid=id
);

CREATE VIRTUAL TABLE decision_traces_fts USING fts5(
  ast_change,
  description,
  content=decision_traces,
  content_rowid=id
);

-- Requirement Synonyms (requirement search 扩展)
CREATE TABLE requirement_synonyms (
  requirement TEXT PRIMARY KEY,       -- "Redis"
  search_terms TEXT NOT NULL,         -- JSON array: ["redis", "ioredis", "cache", "pub/sub"]
  category TEXT                       -- "data" | "performance" | "security" | ...
);

-- 默认同义词 (预填充)
INSERT INTO requirement_synonyms VALUES
  ('Redis', '["redis", "ioredis", "cache", "pub/sub", "session", "rate limit"]', 'data'),
  ('Kafka', '["kafka", "message queue", "pub/sub", "event", "stream", "broker"]', 'data'),
  ('Performance', '["benchmark", "latency", "optimization", "profiling", "memory", "cache"]', 'performance'),
  ('Concurrency', '["async", "queue", "mutex", "lock", "worker", "parallel", "thread"]', 'performance'),
  ('Security', '["auth", "jwt", "oauth", "encrypt", "hash", "token", "permission"]', 'security'),
  ('Testing', '["test", "spec", "mock", "fixture", "coverage", "snapshot"]', 'quality'),
  ('CI/CD', '["ci", "cd", "pipeline", "deploy", "docker", "kubernetes", "helm"]', 'devops'),
  ('Database', '["sql", "postgres", "mysql", "mongo", "prisma", "drizzle", "query"]', 'data'),
  ('API', '["rest", "graphql", "grpc", "endpoint", "route", "middleware"]', 'architecture'),
  ('Frontend', '["react", "vue", "svelte", "component", "state", "render"]', 'frontend');
```

---

## 五、目录结构 (V5)

```
project-lens/
├── src/
│   ├── extractor/                  # Layer 0: Fact 提取
│   │   ├── index.ts                # extract(projectPath) → Facts + Edges
│   │   ├── file-scanner.ts         # ✅ 已实现
│   │   ├── ast-parser.ts           # 🆕 tree-sitter AST 解析
│   │   ├── fact-builder.ts         # 🆕 AST Node → Fact + Edge
│   │   └── queries/                # 🆕 tree-sitter 查询规则
│   │       ├── typescript.scm
│   │       ├── python.scm
│   │       └── go.scm
│   ├── evidence/                   # Layer 1: Evidence 绑定
│   │   ├── index.ts
│   │   ├── git-signal.ts           # 🆕 Git 历史 → Evidence + Decision Trace
│   │   └── test-detector.ts        # 🆕 测试覆盖率检测
│   ├── query/                      # 查询引擎 (所有搜索逻辑)
│   │   ├── index.ts
│   │   ├── search.ts               # 🆕 search_evidence 核心
│   │   ├── requirement-expander.ts # 🆕 Requirement → Search Terms
│   │   ├── ranking.ts              # 🆕 Evidence Ranking 评分
│   │   └── decision-trace.ts       # 🆕 Decision Trace 查询
│   ├── verify/                     # 断言验证
│   │   ├── index.ts
│   │   ├── keyword-extractor.ts    # 🆕 语句 → 关键词
│   │   ├── confidence.ts           # 🆕 置信度计算
│   │   └── verdict.ts              # 🆕 判定逻辑
│   ├── snapshot/                   # 项目快照导出
│   │   ├── index.ts
│   │   ├── builder.ts              # 🆕 构建 Knowledge Pack
│   │   ├── compressor.ts           # 🆕 压缩逻辑
│   │   └── token-estimator.ts      # 🆕 Token 估算
│   ├── render/                     # Utility: 渲染
│   │   ├── index.ts
│   │   ├── typst.ts                # 🆕 Typst 集成
│   │   └── templates/
│   ├── mcp/                        # MCP Server
│   │   ├── server.ts               # 🔄 改为 5 个工具
│   │   └── tools/
│   │       ├── analyze-project.ts
│   │       ├── search-evidence.ts
│   │       ├── verify-statement.ts
│   │       ├── export-snapshot.ts
│   │       └── render-resume.ts
│   ├── store.ts                    # 🔄 扩展: FTS5 + helpers
│   ├── schemas/                    # 🔄 改写: 删除 capability/jd, 简化
│   │   ├── fact.ts                 # ✅ 保留
│   │   ├── evidence.ts             # ✅ 保留
│   │   └── index.ts                # 🔄 简化导出
│   └── cli/
│       └── index.ts                # 🔄 简化为 5 个命令
├── tests/
├── docs/
│   ├── plan-v5.md                  # 本文件
│   ├── erge-plus2.md               # 二哥的原始指导
│   └── ...
├── package.json
├── tsconfig.json
└── README.md
```

### 删除的文件

```
❌ src/schemas/capability.ts      # Capability 模块删除
❌ src/schemas/jd.ts              # JD Parser 不再存储
❌ src/capability/                # 整个目录
❌ src/jd/                        # 整个目录 (V4 未实现，删除)
❌ src/query/decision-trace.ts    # 合并到 search_evidence
❌ src/query/context-export.ts    # 改为 export_snapshot
```

---

## 六、数据流图

### 场景 1: Agent 写简历前搜索项目亮点

```
Agent: "帮我找这个项目里和性能优化相关的亮点"
  ↓
search_evidence({ category: "performance" })
  ↓
requirement-expander: "performance" → ["benchmark", "latency", "optimization", ...]
  ↓
FTS5 搜索 nodes + evidence + decision_traces
  ↓
合并去重
  ↓
ranking.ts: 计算 Evidence Score
  ↓
返回 Top 20 (按分数排序)
```

### 场景 2: Agent 验证简历陈述

```
Agent: "我优化了 Redis 缓存性能，延迟从 40ms 降到 15ms"
  ↓
verify_statement({ statement: "优化了 Redis 缓存性能，延迟从 40ms 降到 15ms" })
  ↓
keyword-extractor: ["Redis", "缓存", "性能", "延迟", "40ms", "15ms"]
  ↓
search_evidence({ query: "Redis 缓存 性能 延迟" })
  ↓
confidence.ts: 有 benchmark 证据 → confidence = 0.9
  ↓
verdict.ts: "SUPPORTED"
  ↓
返回 verdict + evidence
```

### 场景 3: Agent 搜索 JD 相关证据

```
Agent: "OpenAI 要求熟悉 Redis，我的项目里有吗？"
  ↓
search_evidence({ requirement: "Redis" })
  ↓
requirement-expander: "Redis" → ["redis", "ioredis", "cache", "pub/sub", "session"]
  ↓
FTS5 搜索
  ↓
ranking.ts: 有 benchmark + tests + 多次 commit → 高分
  ↓
返回 Top 10
```

### 场景 4: Agent 获取项目全貌

```
Agent: "给我这个项目的整体介绍"
  ↓
export_snapshot({ format: "compact" })
  ↓
builder.ts: 查询 nodes + evidence + decision_traces
  ↓
compressor.ts: 丢弃完整代码，保留摘要
  ↓
token-estimator.ts: 确保 < 50K tokens
  ↓
返回 Knowledge Pack
```

### 场景 5: Agent 追溯决策历史

```
Agent: "Redis 是什么时候引入的？后来有没有改过？"
  ↓
search_evidence({ relation: "decision", query: "Redis" })
  ↓
requirement-expander: "Redis" → search_terms
  ↓
FTS5 搜索
  ↓
decision-trace.ts: 按时间排序 decision_traces
  ↓
返回时间线
```

---

## 七、实现时间线 (3 周)

### Week 1: 基础层 + 索引

```
Day 1-2: 清理 V4 代码
  ├─ 删除 src/schemas/capability.ts
  ├─ 删除 src/schemas/jd.ts
  ├─ 更新 src/schemas/index.ts 导出
  └─ 更新 src/mcp/server.ts 为 5 个工具签名

Day 3-5: Fact 提取
  ├─ 实现 src/extractor/ast-parser.ts (tree-sitter)
  ├─ 实现 src/extractor/fact-builder.ts
  ├─ 编写 src/extractor/queries/typescript.scm
  ├─ 编写 src/extractor/queries/python.scm
  └─ 编写 src/extractor/queries/go.scm

Day 6-7: Evidence 绑定
  ├─ 实现 src/evidence/git-signal.ts
  └─ 实现 src/evidence/test-detector.ts
```

### Week 2: 查询层 + Ranking

```
Day 8-10: search_evidence
  ├─ 实现 src/store.ts FTS5 表
  ├─ 实现 src/query/search.ts
  ├─ 实现 src/query/requirement-expander.ts
  └─ 实现 src/query/ranking.ts

Day 11-12: verify_statement
  ├─ 实现 src/verify/keyword-extractor.ts
  ├─ 实现 src/verify/confidence.ts
  └─ 实现 src/verify/verdict.ts

Day 13-14: export_snapshot
  ├─ 实现 src/snapshot/builder.ts
  ├─ 实现 src/snapshot/compressor.ts
  └─ 实现 src/snapshot/token-estimator.ts
```

### Week 3: 联调 + 发布

```
Day 15-16: MCP 联调
  ├─ 实现 src/mcp/tools/analyze-project.ts
  ├─ 实现 src/mcp/tools/search-evidence.ts
  ├─ 实现 src/mcp/tools/verify-statement.ts
  ├─ 实现 src/mcp/tools/export-snapshot.ts
  └─ Claude Code 调用测试

Day 17-18: CLI + render
  ├─ 更新 src/cli/index.ts
  └─ 实现 src/render/typst.ts

Day 19-21: 测试 + 优化
  ├─ 编写测试用例
  ├─ 优化 Evidence Ranking 算法
  └─ 文档更新
```

---

## 八、依赖清单 (V5)

```json
{
  "dependencies": {
    "zod": "^3.23",
    "web-tree-sitter": "^0.26",
    "@modelcontextprotocol/sdk": "^1.0",
    "better-sqlite3": "^12.0",
    "commander": "^15.0",
    "chalk": "^5.0"
  },
  "devDependencies": {
    "typescript": "^5.5",
    "vitest": "^4.0",
    "@types/node": "^22.0",
    "@types/better-sqlite3": "^7.6"
  }
}
```

### 变化
- ❌ 移除: `tree-sitter-typescript`, `tree-sitter-python`, `tree-sitter-go` (改用 `web-tree-sitter` + WASM)
- ✅ 保留: 所有其他依赖

---

## 九、与参考项目的映射

| V5 模块 | 主要参考 | 复用点 |
|:---|:---|:---|
| `ast-parser.ts` + `.scm` | codebase-memory-mcp | tree-sitter 查询规则 |
| `fact-builder.ts` | codebase-memory-mcp | Facts + Edges 构建 |
| `store.ts` (FTS5) | codebase-memory-mcp | FTS5 全文搜索 |
| `git-signal.ts` | GitIQ | Git 历史信号提取 |
| `ranking.ts` | 二哥的评分公式 | Evidence Ranking |
| `requirement-expander.ts` | 二哥的 Search Query | 同义词扩展 |
| `typst.ts` | rendercv | Typst 渲染 |

---

## 十、V5 vs V4 对比总结

| 维度 | V4 | V5 |
|:---|:---|:---|
| 工具数 | 10 | **5** |
| 数据库表 | 8 | **6** (删除 2) |
| 目录数 | 8 | **7** (删除 1, 新增 2) |
| 核心原则 | Career Intelligence | **Project Understanding** |
| 能力提取 | 自动分类 | **Agent 自己总结** |
| JD 解析 | NER 分类 | **Search Query 扩展** |
| 搜索入口 | 多个工具 | **统一 search_evidence** |
| Evidence 排序 | 无 | **Score = Benchmark + Tests + Git + LOC + Recency + Complexity** |

---

## 十一、关键设计决策记录

### Decision 1: 删除 Capability 模块

- **背景**: V4 有 `extract_capabilities` 和 `match_capabilities` 两个工具
- **决策**: 完全删除
- **原因**: 
  1. Capability 是 Interpretation，不是 Evidence
  2. Agent 能自己总结 "Redis = Caching"
  3. 违反 Lens 回答 What Exists 的原则

### Decision 2: JD Parser → Search Query

- **背景**: V4 有 NER 分类器
- **决策**: 改为 search_evidence 的参数
- **原因**:
  1. Agent 已经能读懂 JD
  2. 不需要 Lens 帮它做分类
  3. 真正需要的是 "Redis 在我的项目里有没有"

### Decision 3: 统一 search_evidence

- **背景**: V4 有 search_evidence, get_decision_trace, diff_versions 等多个查询工具
- **决策**: 合并为 search_evidence 的参数
- **原因**:
  1. 简化 Agent 的调用方式
  2. 所有查询底层都是 FTS5 + 排序
  3. 减少 MCP Tool 数量

### Decision 4: Evidence Ranking

- **背景**: V4 搜索返回 200 条 Evidence，Agent 自己筛
- **决策**: 增加 Score = Benchmark + Tests + Git + LOC + Recency + Complexity
- **原因**:
  1. Lens 明确知道哪些 Evidence 更重要
  2. Top N 返回价值巨大
  3. 二哥明确要求

### Decision 5: web-tree-sitter 替代原生 tree-sitter

- **背景**: 原生 tree-sitter 需要编译 C++ 扩展，安装复杂
- **决策**: 改用 web-tree-sitter (WASM)
- **原因**:
  1. 零编译，开箱即用
  2. 跨平台 (Windows/Mac/Linux)
  3. 性能足够 (亚毫秒级)
  4. codebase-memory-mcp 已验证可行
