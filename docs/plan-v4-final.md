# Project-Lens V4 最终实施方案

> **版本**: 4.0-final | **协调者**: MiMoCode | **评估方**: agy + codex
>
> 基于 `docs/erge-plus.md` 最终定位，整合 agy 架构报告与 codex 工程分析后形成。

---

## 〇、设计目的与目标关联

### 一句话定位

> **Project-Lens is a Career Intelligence Layer for AI Agents.**

不是 Resume Builder，不是 Interview Agent，而是一个**专门把代码、简历、JD 和职业信息统一转换成结构化、可验证知识的 MCP 工具层**。

### 核心判断原则

假设未来 Claude Code 5 已经非常强，它会写简历、会润色、会分析 JD、会模拟面试。那么 Lens 还剩什么价值？

- 如果答案是"啥也没剩下" → 你在和 Agent 抢工作，定位错了
- 如果答案是"没有 Lens，Agent 根本不知道代码里发生了什么" → 定位正确

### 三类模块分类

| 类别 | 职责 | 包含 |
|:---|:---|:---|
| **Intelligence** | 提取、索引、验证、查询 | analyze_project, extract_evidence, build_decision_trace, parse_jd, build_capability_graph, match_capabilities, search_evidence, verify_statement, diff_projects |
| **Artifact** | 结构化输出对象 | project.json, resume.json, jd.json, capability.json, interview.json |
| **Utility** | 基础设施 | Typst/PDF/MD/HTML 渲染, Snapshot, Cache |
| **~~Agent~~** | **不要有** | ~~Interview Agent, Resume Agent, Career Planner, Mock Interview~~ — Agent 已经有了 |

### 核心原则

```
Lens 回答: What Exists.      （代码里有什么事实）
Agent 回答: What It Means.    （这些事实意味着什么）
永远不要替 Agent 思考。
```

### Agent 需要什么信息？（逆向推导）

| Agent 阶段 | Agent 缺什么 | Lens 提供什么 |
|:---|:---|:---|
| 理解项目 | 不知道代码里做了什么 | 项目事实、Evidence、Decision Trace |
| 理解 JD | 不知道招聘要求的结构 | JD Parser、Requirement Schema |
| 判断匹配 | 不知道哪些能力对应哪些证据 | Capability Matching Matrix |
| 写简历 | 害怕编造 | Statement Verification |
| 模拟面试 | 不知道哪些地方值得深挖 | Decision Timeline、Architecture Evolution |

**共同点：Lens 提供的是"信息"，不是"结论"。**

---

## 一、架构总览

```
┌─────────────────────────────────────────────────────────────┐
│  Agent (Claude / Gemini / Codex)                             │
│  Think & Plan → Query Lens → Get Facts → Reason → Write     │
├──────────────────────────┬──────────────────────────────────┤
│      MCP Protocol        │                                  │
├──────────────────────────┼──────────────────────────────────┤
│  Lens: Career Intelligence Layer                            │
│                                                              │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐   │
│  │ Intelligence  │  │ Artifact      │  │ Utility       │   │
│  │               │  │               │  │               │   │
│  │ • analyze     │  │ • project.json│  │ • Typst/PDF   │   │
│  │ • evidence    │  │ • resume.json │  │ • Snapshot    │   │
│  │ • decision    │  │ • jd.json     │  │ • Cache       │   │
│  │ • capability  │  │ • capability  │  │               │   │
│  │ • match       │  │   .json       │  │               │   │
│  │ • search      │  │ • interview   │  │               │   │
│  │ • verify      │  │   .json       │  │               │   │
│  │ • diff        │  │               │  │               │   │
│  │ • parse_jd    │  │               │  │               │   │
│  └───────┬───────┘  └───────────────┘  └───────────────┘   │
│          │                                                   │
│          ▼                                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Layer 1: Evidence Layer                             │    │
│  │  Evidence Graph + Decision Trace + Capability Graph  │    │
│  └──────────────────────┬──────────────────────────────┘    │
│                         │                                    │
│                         ▼                                    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Layer 0: Fact Layer                                │    │
│  │  AST Facts + Git Facts + Metrics + Dependencies     │    │
│  └──────────────────────┬──────────────────────────────┘    │
│                         │                                    │
│  Codebase (tree-sitter AST + git history)                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 二、五个核心能力详细设计

### 2.1 Statement Verification（断言验证）

**场景**：Agent 准备写"优化了缓存性能"，先问 Lens 这句话有没有代码支撑。

```typescript
// MCP Tool: lens.verify_statement
// 输入
{
  statement: string,               // "优化了缓存性能"
  context_scope?: string[]         // 限定搜索范围
}

// 输出
{
  verdict: "SUPPORTED" | "PARTIALLY_SUPPORTED" | "NOT_SUPPORTED",
  confidence: number,              // 0-1
  evidence: Array<{
    fact_id: string,               // "src/cache.ts::RedisCache"
    filepath: string,
    code_snippet: string,
    evidence_type: "benchmark" | "commit" | "test_coverage",
    description: string            // "latency 40ms → 15ms"
  }>,
  unsupported_parts: string[]      // "没有找到性能对比数据"
}
```

**数据流**：
```
Agent 提交 statement
  → 关键词提取 ("缓存", "性能")
  → search_evidence("缓存 AND 性能")
  → 匹配 benchmark/test_coverage 类型的 Evidence
  → 计算 confidence (有 benchmark=0.9, 仅有 commit=0.5)
  → 返回 verdict + evidence
```

### 2.2 Evidence Search（证据搜索）

**场景**：Agent 搜索"所有和性能有关的 Evidence"。

```typescript
// MCP Tool: lens.search_evidence
// 输入
{
  query: string,                    // "performance", "redis", "security"
  filters?: {
    evidence_type?: "git_commit" | "test_coverage" | "benchmark" | "dependency",
    fact_type?: "function" | "class" | "dependency",
    date_from?: string,
    date_to?: string
  },
  limit?: number,                   // 默认 20
  cursor?: string
}

// 输出
{
  results: Array<{
    fact: {
      id: string,
      type: string,
      filepath: string,
      line_range: [number, number],
      name: string
    },
    evidences: Array<{
      type: string,
      commit_hash?: string,
      author?: string,
      description?: string,
      confidence: number
    }>
  }>,
  next_cursor?: string,
  total_count: number
}
```

**实现**：SQLite FTS5 全文搜索 + 结构化过滤。

### 2.3 Capability Extraction（能力提取）

**场景**：从代码中提取能力标签，不是"Redis"而是"Caching, Consistency, Performance Optimization"。

```typescript
// MCP Tool: lens.extract_capabilities
// 输入
{
  project_path?: string
}

// 输出
{
  capabilities: Array<{
    id: string,                     // "caching"
    name: string,                   // "Caching & Performance Optimization"
    category: "infrastructure" | "architecture" | "security" | "data" | "devops",
    evidence_count: number,         // 支撑这个能力的 Evidence 数量
    confidence: number,             // 0-1
    related_facts: string[]         // ["src/cache.ts::RedisCache", ...]
  }>
}
```

**实现**：不是简单的关键词匹配，而是基于 Fact 图的模式识别：
- 多个函数调用 Redis/Kafka/Memcached → "Caching & Distributed Systems"
- 类继承 CircuitBreaker/RetryPolicy → "Resilience & Fault Tolerance"
- import 了 auth/jwt/oauth → "Authentication & Security"

### 2.4 Decision Timeline（决策时间线）

**场景**：Agent 问"什么时候引入 Redis？为什么？后来为什么改？"

```typescript
// MCP Tool: lens.get_decision_trace
// 输入
{
  node_id: string,    // "src/db/connection.ts::DatabasePool"
  limit?: number      // 默认 10
}

// 输出
{
  node_id: string,
  timeline: Array<{
    version?: string,
    commit_hash: string,
    author: string,
    timestamp: string,
    change_type: "introduction" | "modification" | "replacement" | "removal",
    ast_change: string,           // "Changed pool limit from 10 to 50"
    related_issue?: string        // "#412 (Database timeout)"
  }>
}
```

**实现**：对每个 Fact 节点，检索所有关联的 commit，按时间排序，识别 introduction→modification→replacement 链。

### 2.5 Repository Memory（仓库记忆）

**场景**：Agent 一句 `load_project_context()` 就获得整个项目的知识包。

```typescript
// MCP Tool: lens.export_context
// 输入
{
  format?: "json" | "compact",     // compact = 压缩版
  include_git_history?: boolean,    // 默认 true
  max_tokens?: number              // 限制输出大小
}

// 输出 (compact 模式)
{
  project: {
    name: string,
    languages: string[],
    total_files: number,
    loc: number
  },
  capabilities: Array<{ id: string, name: string, confidence: number }>,
  key_facts: Array<{
    id: string,
    type: string,
    filepath: string,
    summary: string               // 一行描述
  }>,
  recent_decisions: Array<{
    node_id: string,
    latest_change: string,
    timestamp: string
  }>,
  evidence_stats: {
    total: number,
    by_type: Record<string, number>
  }
}
```

**压缩策略**：
- 保留：Fact 节点摘要、Capability 标签、最近 30 天的 Decision Trace、Evidence 统计
- 丢弃：完整代码片段、完整 Git 历史、中间 Edge 关系
- 目标：整个知识包 < 50K tokens

---

## 三、JD Parser 与 Gap Analysis

### 3.1 JD Parser（不是 JD Analyzer）

**原则**：结构化，不分析，不建议。

```typescript
// MCP Tool: lens.parse_jd
// 输入
{
  jd_text: string                   // 原始 JD 文本
}

// 输出
{
  requirements: Array<{
    id: string,                     // "redis"
    text: string,                   // "熟悉Redis"
    type: "technology" | "architecture" | "methodology" | "soft_skill",
    priority: "required" | "preferred" | "nice_to_have"
  }>,
  metadata: {
    company?: string,
    position?: string,
    location?: string
  }
}
```

**实现**：基于规则的 NER（命名实体识别）+ 关键词分类，不需要 LLM。

### 3.2 Gap Analysis（作为数据）

**原则**：给分数，不给建议。

```typescript
// MCP Tool: lens.match_capabilities
// 输入
{
  jd_requirements: Array<{ id: string, type: string }>,
  capabilities?: Array<{ id: string }>  // 默认用 extract_capabilities 的结果
}

// 输出
{
  matching_matrix: Record<string, number>,  // { redis: 0.92, k8s: 0.18 }
  details: Array<{
    requirement_id: string,
    matched_capabilities: Array<{
      capability_id: string,
      score: number,
      evidence_count: number
    }>,
    unmatched: boolean
  }>
}
```

**Agent 看到后**：`{ redis: 0.92, k8s: 0.18 }` → "建议补 K8s"（这是 Agent 的工作）。

### 3.3 Resume Schema

**原则**：Lens 提供 Schema，Agent 负责编辑。

```typescript
// Lens 提供的 Schema 定义（不是生成简历）
const ResumeSchema = z.object({
  basics: z.object({ name, email, summary, ... }),
  experience: z.array(z.object({ company, role, highlights, ... })),
  projects: z.array(z.object({ name, description, tech_stack, highlights, ... })),
  skills: z.array(z.object({ category, items, ... })),
  education: z.array(z.object({ institution, degree, ... }))
});

// Agent 的使用方式：
// 1. 调用 lens.export_context() 获取项目知识
// 2. 调用 lens.parse_jd() 获取 JD 要求
// 3. 调用 lens.match_capabilities() 获取匹配矩阵
// 4. 自己按 ResumeSchema 生成 resume.json
// 5. 调用 lens.verify_statement() 验证每一句亮点
// 6. 调用 lens.render_pdf() 渲染最终 PDF
```

---

## 四、MCP API 完整清单

| # | Tool | 职责 | 输入 | 输出 |
|:---|:---|:---|:---|:---|
| 1 | `lens.analyze_project` | 扫描项目索引 | project_path, depth | 项目元数据 + 模块拓扑 |
| 2 | `lens.search_evidence` | 搜索证据 | query, filters, limit, cursor | Fact + Evidence 列表 |
| 3 | `lens.verify_statement` | 验证断言 | statement, context_scope | verdict + evidence |
| 4 | `lens.extract_capabilities` | 提取能力标签 | project_path | capabilities 列表 |
| 5 | `lens.get_decision_trace` | 决策时间线 | node_id, limit | evolution timeline |
| 6 | `lens.parse_jd` | JD 结构化 | jd_text | requirements JSON |
| 7 | `lens.match_capabilities` | 能力匹配矩阵 | jd_requirements | matching scores |
| 8 | `lens.export_context` | 导出知识包 | format, max_tokens | 项目知识摘要 |
| 9 | `lens.diff_versions` | 版本结构差异 | source_rev, target_rev | added/modified/removed |
| 10 | `lens.render_pdf` | 渲染 PDF | resume.json, template | PDF 文件路径 |

---

## 五、数据存储设计

### 5.1 `~/.lens/` 目录

```
~/.lens/
├── config.json
├── cache/
│   ├── facts.db                   # Layer 0: Facts + Edges
│   ├── evidence.db                # Layer 1: Evidence + DecisionTraces
│   ├── capabilities.db            # Capability Graph
│   └── file_hashes.json           # 增量更新
├── exports/
│   └── <project-uuid>.json        # Knowledge Package 缓存
└── templates/
    ├── resume.typ                 # Typst 简历模板
    └── context-export.json        # 导出模板
```

### 5.2 SQLite 表设计

```sql
-- Layer 0: Facts
CREATE TABLE facts (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  filepath TEXT NOT NULL,
  line_start INTEGER NOT NULL,
  line_end INTEGER NOT NULL,
  name TEXT NOT NULL,
  metadata JSON,
  content_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE fact_edges (
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  relation TEXT NOT NULL,
  PRIMARY KEY (source_id, target_id, relation)
);

-- Layer 1: Evidence
CREATE TABLE evidence (
  id TEXT PRIMARY KEY,
  fact_id TEXT NOT NULL,
  type TEXT NOT NULL,
  commit_hash TEXT,
  author TEXT,
  timestamp TEXT,
  description TEXT,
  confidence REAL DEFAULT 1.0,
  FOREIGN KEY (fact_id) REFERENCES facts(id)
);

CREATE TABLE decision_traces (
  id TEXT PRIMARY KEY,
  fact_id TEXT NOT NULL,
  version TEXT,
  commit_hash TEXT NOT NULL,
  author TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  ast_change TEXT NOT NULL,
  change_type TEXT NOT NULL,
  related_issue TEXT,
  FOREIGN KEY (fact_id) REFERENCES facts(id)
);

-- Capability Graph
CREATE TABLE capabilities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  confidence REAL DEFAULT 0.0
);

CREATE TABLE capability_facts (
  capability_id TEXT NOT NULL,
  fact_id TEXT NOT NULL,
  weight REAL DEFAULT 1.0,
  PRIMARY KEY (capability_id, fact_id)
);

-- FTS5 全文搜索
CREATE VIRTUAL TABLE evidence_fts USING fts5(
  description, commit_hash, author,
  content=evidence,
  content_rowid=rowid
);
```

---

## 六、项目目录结构

```
project-lens/
├── src/
│   ├── extractor/               # Layer 0: Fact 提取
│   │   ├── index.ts
│   │   ├── file-scanner.ts
│   │   ├── ast-parser.ts
│   │   ├── fact-builder.ts
│   │   └── queries/
│   │       ├── typescript.scm
│   │       ├── python.scm
│   │       └── go.scm
│   ├── evidence/                # Layer 1: Evidence 绑定
│   │   ├── index.ts
│   │   ├── git-blame.ts
│   │   ├── git-diff.ts
│   │   ├── test-coverage.ts
│   │   └── benchmark-tracker.ts
│   ├── capability/              # Capability 提取
│   │   ├── index.ts
│   │   ├── extractor.ts         # Fact → Capability 映射
│   │   └── matcher.ts           # Capability × JD → Matching Matrix
│   ├── jd/                      # JD Parser
│   │   ├── index.ts
│   │   ├── parser.ts            # 文本 → 结构化 requirements
│   │   └── ner.ts               # 命名实体识别
│   ├── query/                   # 查询引擎
│   │   ├── index.ts
│   │   ├── search.ts            # search_evidence
│   │   ├── verification.ts      # verify_statement
│   │   ├── decision-trace.ts    # get_decision_trace
│   │   ├── context-export.ts    # export_context
│   │   └── version-diff.ts      # diff_versions
│   ├── render/                  # Utility: 渲染
│   │   ├── index.ts
│   │   ├── typst.ts
│   │   └── templates/
│   ├── mcp/                     # MCP Server
│   │   ├── server.ts
│   │   └── tools/
│   │       ├── analyze-project.ts
│   │       ├── search-evidence.ts
│   │       ├── verify-statement.ts
│   │       ├── extract-capabilities.ts
│   │       ├── decision-trace.ts
│   │       ├── parse-jd.ts
│   │       ├── match-capabilities.ts
│   │       ├── export-context.ts
│   │       ├── diff-versions.ts
│   │       └── render-pdf.ts
│   ├── cli/                     # CLI (调试用)
│   │   ├── index.ts
│   │   └── output-formatter.ts
│   └── schemas/                 # Zod Schema
│       ├── fact.ts
│       ├── evidence.ts
│       ├── capability.ts
│       ├── jd.ts
│       └── resume.ts
├── tests/
├── docs/
├── package.json
├── tsconfig.json
└── README.md
```

---

## 七、实施路径

### 4 周 MVP

```
Week 1: 基础层
  ├─ 删除旧模块 (builder/, interview/, critic/, bridge/)
  ├─ 重写 Schemas (fact.ts, evidence.ts, capability.ts, jd.ts)
  ├─ 实现 MCP Server 骨架 (10 个 tool 注册)
  └─ 实现 file-scanner.ts (增量哈希)

Week 2: 提取层
  ├─ 实现 ast-parser.ts + tree-sitter 查询规则
  ├─ 实现 fact-builder.ts (AST → Fact + Edge)
  ├─ 实现 git-blame.ts + git-diff.ts
  └─ 实现 evidence 绑定

Week 3: 查询层
  ├─ 实现 search_evidence (FTS5)
  ├─ 实现 verify_statement
  ├─ 实现 extract_capabilities + match_capabilities
  ├─ 实现 parse_jd (规则 NER)
  └─ 实现 get_decision_trace + export_context

Week 4: 联调与发布
  ├─ MCP 联调 (Claude Code 调用测试)
  ├─ CLI 调试工具
  ├─ render_pdf (Typst 集成)
  └─ 发布 Career Intelligence Layer 1.0
```

### 优先级排序

| 优先级 | 能力 | 原因 |
|:---|:---|:---|
| P0 | analyze_project + search_evidence | 基础，所有其他能力依赖它 |
| P0 | Fact Extractor + Evidence Binder | 数据源头 |
| P1 | verify_statement | 最高价值 — 让 Agent 不再编造 |
| P1 | get_decision_trace | 面试场景核心 |
| P2 | extract_capabilities + match_capabilities | JD 匹配场景 |
| P2 | parse_jd | 需要 NER 规则库 |
| P3 | export_context | 便利性能力 |
| P3 | render_pdf | Agent 可以自己生成 |

---

## 八、迁移：哪些复用、哪些重写、哪些删除

| V3 模块 | V4 状态 | 动作 |
|:---|:---|:---|
| `src/analyzer/ast-parser.ts` | 复用 | 提取核心逻辑，删除 LLM 代码 |
| `src/analyzer/git-analyzer.ts` | 复用 | 保留 blame/diff，重新绑定 Evidence |
| `src/analyzer/file-discovery.ts` | 复用 | 直接迁移 |
| `src/analyzer/evidence-mapper.ts` | 重写 | "生成 Resume 亮点" → "生成 Fact 节点" |
| `src/builder/` | **删除** | 整个目录 |
| `src/interview/` | **删除** | 整个目录 |
| `src/critic/` | **删除** | 整个目录 |
| `src/bridge/` | **删除** | 整个目录 |
| `src/schemas/` | 重写 | Resume Schema → Fact/Evidence/Capability Schema |
| `src/mcp/` | 重写 | 5 工具 → 10 工具 |
| `src/capability/` | **新增** | Capability 提取 + 匹配 |
| `src/jd/` | **新增** | JD Parser |
| `src/render/` | **新增** | Typst 渲染 |

---

## 九、依赖清单

```json
{
  "dependencies": {
    "zod": "^3.23",
    "tree-sitter": "^0.22",
    "tree-sitter-typescript": "^0.23",
    "tree-sitter-python": "^0.23",
    "tree-sitter-go": "^0.23",
    "@modelcontextprotocol/sdk": "^1.0",
    "better-sqlite3": "^11.0",
    "commander": "^12.0",
    "chalk": "^5.3"
  },
  "devDependencies": {
    "typescript": "^5.5",
    "vitest": "^2.0",
    "@types/node": "^22.0",
    "@types/better-sqlite3": "^7.6"
  }
}
```
