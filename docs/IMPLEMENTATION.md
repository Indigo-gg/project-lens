# Project-Lens — 完整实施计划

> **项目定位**: Career Intelligence Layer for AI Agents
> **版本**: 1.0 MVP | **日期**: 2026-07-16
> **技术栈**: TypeScript + SQLite + tree-sitter (WASM) + MCP Protocol

---

## 〇、为什么做这个项目

### 问题

程序员的求职准备（简历、面试、职业规划）长期依赖手动操作和通用 AI 对话。现有的 AI 求职工具本质上是 ChatGPT 套皮 —— 它们不知道你的代码里到底做了什么，只能生成泛泛的内容。

### 解法

Project-Lens 不是一个求职工具。它是 **AI Agent 的认知基础设施** —— 把代码仓库变成可信、结构化、可查询、可验证的知识层，让任何 AI Agent 都能基于真实代码事实进行推理。

### 核心原则

```
Lens 只回答: What Exists.      （代码里有什么事实）
Agent 回答: What It Means.     （这些事实意味着什么）

永远不要替 Agent 思考。
```

### 为什么不会被大模型替代

| 风险 | 旧定位（求职工具） | 新定位（认知基础设施） |
|:---|:---|:---|
| Claude 自己能写简历 | Resume Builder 废了 | Lens 不写简历，提供事实 |
| Claude 自己能问面试题 | Interview Agent 废了 | Lens 不出题，提供决策链 |
| 模型越来越强 | 工具越来越没用 | 模型越强越需要可信数据 |

**结论**：不是在和 Agent 竞争，而是成为 Agent 的基础设施。

---

## 一、产品定义

### 1.1 三类模块分类

| 类别 | 职责 | 包含 |
|:---|:---|:---|
| **Intelligence** | 提取、索引、验证、查询 | analyze_project, search_evidence, verify_statement, extract_capabilities, get_decision_trace, parse_jd, match_capabilities, export_context, diff_versions |
| **Artifact** | 结构化输出对象 | project.json, resume.json, jd.json, capability.json |
| **Utility** | 基础设施 | Typst/PDF 渲染, Snapshot, Cache |
| **~~Agent~~** | **不要有** | ~~Interview Agent, Resume Agent, Career Planner~~ |

### 1.2 Agent 需要什么信息（逆向推导）

| Agent 阶段 | Agent 缺什么 | Lens 提供什么 |
|:---|:---|:---|
| 理解项目 | 不知道代码里做了什么 | 项目事实、Evidence、Decision Trace |
| 理解 JD | 不知道招聘要求的结构 | JD Parser → 结构化 requirements |
| 判断匹配 | 不知道哪些能力对应哪些证据 | Capability Matching Matrix |
| 写简历 | 害怕编造 | Statement Verification |
| 模拟面试 | 不知道哪些地方值得深挖 | Decision Timeline |

### 1.3 10 个 MCP Tool

| # | Tool | 输入 | 输出 | 优先级 |
|:---|:---|:---|:---|:---|
| 1 | `analyze_project` | project_path, depth | 项目元数据 + 模块拓扑 | P0 |
| 2 | `search_evidence` | query, filters, limit, cursor | Fact + Evidence 列表 | P0 |
| 3 | `verify_statement` | statement, context_scope | verdict + evidence | P1 |
| 4 | `extract_capabilities` | project_path | capabilities 列表 | P2 |
| 5 | `get_decision_trace` | node_id, limit | evolution timeline | P1 |
| 6 | `parse_jd` | jd_text | requirements JSON | P2 |
| 7 | `match_capabilities` | jd_requirements | matching scores | P2 |
| 8 | `export_context` | format, max_tokens | 项目知识摘要 | P3 |
| 9 | `diff_versions` | source_rev, target_rev | added/modified/removed | P3 |
| 10 | `render_pdf` | resume_json, template | PDF 文件路径 | P3 |

---

## 二、技术架构

### 2.1 系统分层

```
┌─────────────────────────────────────────────────────────┐
│  Agent (Claude / Gemini / Codex)                         │
│  Think → Query Lens → Get Facts → Reason → Write        │
├─────────────────────┬───────────────────────────────────┤
│   MCP Protocol      │                                   │
├─────────────────────┼───────────────────────────────────┤
│  Lens: Career Intelligence Layer                        │
│                                                          │
│  Intelligence: analyze / search / verify / trace / ...  │
│  Artifact: project.json / jd.json / capability.json     │
│  Utility: Typst PDF / Snapshot / Cache                  │
│                                                          │
│  ┌────────────────────────────────────────────────┐     │
│  │  Layer 1: Evidence Layer                       │     │
│  │  Evidence Graph + Decision Trace               │     │
│  └────────────────────┬───────────────────────────┘     │
│                       │                                  │
│  ┌────────────────────────────────────────────────┐     │
│  │  Layer 0: Fact Layer                           │     │
│  │  AST Facts + Git Facts + Metrics               │     │
│  └────────────────────┬───────────────────────────┘     │
│                       │                                  │
│  Codebase (tree-sitter WASM + git)                      │
└─────────────────────────────────────────────────────────┘
```

### 2.2 数据模型

```
Fact → Evidence → Capability
  ↑       ↑         ↑
 Lens   Lens      Agent
(不可解释) (可追溯)  (需要推理)
```

- **Fact**: 函数调用了 RedisClient、类继承了 Repository — 纯粹的代码结构事实
- **Evidence**: 这个用法在 commit a8f9c 中引入、作者 Alice、测试覆盖率 85% — 事实的工程凭证
- **Capability**: 说明候选人具备高并发缓存设计能力 — **Agent 的工作，不是 Lens 的**

### 2.3 SQLite 表设计

参考 codebase-memory-mcp 的架构：

```sql
-- Layer 0: Facts (代码结构事实)
CREATE TABLE nodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project TEXT NOT NULL,
  label TEXT NOT NULL,              -- "function" | "class" | "dependency"
  name TEXT NOT NULL,
  qualified_name TEXT NOT NULL,     -- "src/auth.ts::validateSession"
  file_path TEXT NOT NULL,
  start_line INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  properties TEXT,                  -- JSON: 语言特定附加信息
  UNIQUE(project, qualified_name)
);

CREATE TABLE edges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project TEXT NOT NULL,
  source_id INTEGER NOT NULL REFERENCES nodes(id),
  target_id INTEGER NOT NULL REFERENCES nodes(id),
  type TEXT NOT NULL,               -- "calls" | "imports" | "extends"
  properties TEXT,
  UNIQUE(source_id, target_id, type)
);

-- Layer 1: Evidence (工程凭证)
CREATE TABLE evidence (
  id TEXT PRIMARY KEY,
  fact_id INTEGER NOT NULL REFERENCES nodes(id),
  type TEXT NOT NULL,               -- "git_commit" | "test_coverage" | "benchmark"
  commit_hash TEXT,
  author TEXT,
  timestamp TEXT,
  description TEXT NOT NULL,
  confidence REAL DEFAULT 1.0
);

CREATE TABLE decision_traces (
  id TEXT PRIMARY KEY,
  fact_id INTEGER NOT NULL REFERENCES nodes(id),
  version TEXT,
  commit_hash TEXT NOT NULL,
  author TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  ast_change TEXT NOT NULL,
  change_type TEXT NOT NULL,        -- "introduction" | "modification" | "replacement"
  related_issue TEXT
);

-- Capability Graph
CREATE TABLE capabilities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  confidence REAL DEFAULT 0.0
);

CREATE TABLE capability_facts (
  capability_id TEXT NOT NULL REFERENCES capabilities(id),
  fact_id INTEGER NOT NULL REFERENCES nodes(id),
  weight REAL DEFAULT 1.0,
  PRIMARY KEY (capability_id, fact_id)
);

-- File hash cache (增量更新)
CREATE TABLE file_hashes (
  project TEXT NOT NULL,
  rel_path TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  mtime_ms REAL NOT NULL,
  size INTEGER NOT NULL,
  PRIMARY KEY (project, rel_path)
);

-- FTS5 全文搜索
CREATE VIRTUAL TABLE nodes_fts USING fts5(
  name, qualified_name, file_path,
  content=nodes,
  content_rowid=id
);
```

---

## 三、参考项目与技术选型

### 3.1 已克隆的参考项目

| 项目 | GitHub | 我们学什么 |
|:---|:---|:---|
| **codebase-memory-mcp** | DeusData/codebase-memory-mcp | SQLite 知识图谱存储、MCP Tool 设计、14 个工具的 Schema、增量索引策略 |
| **Kognit** | Pomilon/Kognit | Capability Extraction 的映射规则、DeveloperIdentity 输出格式、多智能体架构 |
| **cocoindex** | cocoindex-io/cocoindex-code | AST-aware 代码分块策略、按函数/类边界搜索 |
| **gitiq** | naman-kalwani/GitIQ | Git 信号提取、仓库级分析、Decision Trace 构建 |

### 3.2 技术选型

| 组件 | 选型 | 原因 |
|:---|:---|:---|
| 语言 | TypeScript (Node.js 22+) | MCP SDK 生态、Zod 类型安全 |
| AST 解析 | web-tree-sitter (WASM) | Windows 原生编译有问题，WASM 跨平台 |
| 数据库 | better-sqlite3 | 参考 codebase-memory-mcp，WAL 模式，高性能 |
| MCP 传输 | Stdio | 标准 MCP 协议，Claude Code / Gemini 原生支持 |
| Schema 校验 | Zod | 类型推导 + JSON Schema 生成 + 运行时校验 |
| PDF 渲染 | Typst CLI | 轻量、高质量、中文支持好 |
| 测试 | Vitest | 快速、TypeScript 原生 |
| CLI | Commander.js | 轻量、成熟 |

### 3.3 依赖清单

```json
{
  "dependencies": {
    "zod": "^3.23",
    "web-tree-sitter": "^0.24",
    "better-sqlite3": "^11.0",
    "@modelcontextprotocol/sdk": "^1.0",
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

---

## 四、项目目录结构

```
project-lens/
├── src/
│   ├── schemas/                 # Zod Schema 定义
│   │   ├── fact.ts              # Fact + FactEdge + ProjectMetadata
│   │   ├── evidence.ts          # Evidence + DecisionTrace
│   │   ├── capability.ts        # Capability + MatchingMatrix
│   │   ├── jd.ts                # JdRequirement + JdParseResult
│   │   └── index.ts             # 统一导出
│   │
│   ├── extractor/               # Layer 0: Fact 提取
│   │   ├── index.ts             # 入口: scan → parse → store
│   │   ├── file-scanner.ts      # 文件发现 + 增量哈希
│   │   ├── ast-parser.ts        # tree-sitter WASM 解析
│   │   ├── fact-builder.ts      # AST → Fact 节点 + Edge 边
│   │   └── queries/             # tree-sitter 查询规则
│   │       ├── typescript.scm
│   │       ├── python.scm
│   │       └── go.scm
│   │
│   ├── evidence/                # Layer 1: Evidence 绑定
│   │   ├── index.ts             # 入口: bind → store
│   │   ├── git-blame.ts         # git blame → Evidence
│   │   ├── git-diff.ts          # AST diff → Decision Trace
│   │   ├── test-coverage.ts     # 覆盖率 → Evidence
│   │   └── benchmark-tracker.ts # benchmark → Evidence
│   │
│   ├── capability/              # Capability 提取
│   │   ├── index.ts
│   │   ├── extractor.ts         # Fact → Capability 映射
│   │   └── matcher.ts           # Capability × JD → Matrix
│   │
│   ├── jd/                      # JD Parser
│   │   ├── index.ts
│   │   ├── parser.ts            # 文本 → 结构化 requirements
│   │   └── ner.ts               # 命名实体识别规则
│   │
│   ├── query/                   # 查询引擎
│   │   ├── index.ts
│   │   ├── search.ts            # search_evidence (FTS5)
│   │   ├── verification.ts      # verify_statement
│   │   ├── decision-trace.ts    # get_decision_trace
│   │   ├── context-export.ts    # export_context
│   │   └── version-diff.ts      # diff_versions
│   │
│   ├── render/                  # Utility: 渲染
│   │   ├── index.ts
│   │   ├── typst.ts
│   │   └── templates/
│   │
│   ├── store.ts                 # SQLite 数据库管理
│   │
│   ├── mcp/                     # MCP Server
│   │   ├── server.ts            # Server 入口 + Tool 注册
│   │   └── tools/               # 每个 Tool 的实现
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
│   │
│   └── cli/                     # CLI 入口
│       └── index.ts
│
├── tests/
│   ├── extractor/
│   ├── evidence/
│   ├── query/
│   └── mcp/
│
├── docs/
│   ├── erge.md                  # 原始评估指导意见
│   ├── erge-plus.md             # 最终定位文档
│   ├── advise.md                # 参考项目列表
│   ├── references-analysis.md   # 参考项目分析
│   ├── plan-v2.md               # V2 计划（历史）
│   ├── plan-v3.md               # V3 计划（历史）
│   ├── plan-v4.md               # V4 计划（历史）
│   ├── plan-v4-final.md         # V4 最终方案（历史）
│   └── IMPLEMENTATION.md        # 本文档
│
├── references/                  # 参考项目源码
│   ├── codebase-memory-mcp/
│   ├── kognit/
│   ├── cocoindex/
│   └── gitiq/
│
├── package.json
├── tsconfig.json
└── README.md
```

---

## 五、4 周 MVP 实施路径

### Week 1: 基础层

**目标**：项目骨架可运行，MCP Server 能被 Claude Code 识别。

| 任务 | 文件 | 验收标准 |
|:---|:---|:---|
| 初始化项目 | package.json, tsconfig.json | `npm run build` 成功 |
| 安装依赖 | node_modules/ | 所有依赖安装成功 |
| Schema 定义 | src/schemas/*.ts | Zod 校验测试通过 |
| SQLite Store | src/store.ts | 建表成功，CRUD 操作正常 |
| 增量文件扫描 | src/extractor/file-scanner.ts | 对真实项目扫描，输出 changed/added/removed |
| MCP Server 骨架 | src/mcp/server.ts | 10 个 tool 注册，`lens serve` 启动成功 |
| CLI 入口 | src/cli/index.ts | `lens serve` / `lens --version` 可运行 |

### Week 2: 提取层

**目标**：能从真实代码仓库中提取 Fact 和 Evidence。

| 任务 | 文件 | 验收标准 |
|:---|:---|:---|
| tree-sitter WASM 集成 | src/extractor/ast-parser.ts | 加载 WASM，解析 TS/Python/Go 文件 |
| 查询规则 | src/extractor/queries/*.scm | 捕获函数、类、import、调用关系 |
| Fact Builder | src/extractor/fact-builder.ts | AST → nodes + edges 写入 SQLite |
| Git Blame | src/evidence/git-blame.ts | 对每个 Fact 节点获取 blame 信息 |
| Git Diff | src/evidence/git-diff.ts | 识别 introduction/modification/removal |
| Evidence 绑定 | src/evidence/index.ts | Evidence + DecisionTrace 写入 SQLite |

### Week 3: 查询层

**目标**：10 个 MCP Tool 全部可用。

| 任务 | 文件 | 验收标准 |
|:---|:---|:---|
| search_evidence | src/query/search.ts | FTS5 搜索返回结果 |
| verify_statement | src/query/verification.ts | 有证据返回 SUPPORTED，无证据返回 NOT_SUPPORTED |
| extract_capabilities | src/capability/extractor.ts | 从 Facts 中提取能力标签 |
| match_capabilities | src/capability/matcher.ts | Capability × JD → 分数矩阵 |
| parse_jd | src/jd/parser.ts | JD 文本 → 结构化 requirements |
| get_decision_trace | src/query/decision-trace.ts | 返回某节点的演变时间线 |
| export_context | src/query/context-export.ts | 导出 < 50K tokens 的知识包 |
| diff_versions | src/query/version-diff.ts | 对比两个版本的结构差异 |

### Week 4: 联调与发布

**目标**：端到端可用，Claude Code 能通过 MCP 调用所有 Tool。

| 任务 | 文件 | 验收标准 |
|:---|:---|:---|
| MCP 联调 | src/mcp/server.ts | Claude Code 识别所有 10 个 tool |
| CLI 调试工具 | src/cli/index.ts | `lens search "redis"` 等命令可用 |
| render_pdf | src/render/typst.ts | resume.json → PDF 渲染成功 |
| 端到端测试 | tests/ | 对真实项目运行全流程 |
| README | README.md | 安装 + 使用说明 |
| npm 发布准备 | package.json | `npm pack` 成功 |

---

## 六、MCP Tool 详细 Schema

### 6.1 analyze_project

```typescript
// 输入
{ project_path?: string, depth?: number }
// 输出
{
  project_metadata: {
    languages: string[],
    dependencies: Record<string, string>,
    total_files: number,
    loc: number
  },
  entry_points: Array<{ path: string, type: string }>,
  module_topology: Array<{ module: string, dependencies: string[] }>
}
```

### 6.2 search_evidence

```typescript
// 输入
{
  query: string,
  filters?: { evidence_type?, fact_type?, date_from?, date_to? },
  limit?: number,
  cursor?: string
}
// 输出
{
  results: Array<{
    fact: { id, type, filepath, line_range, name },
    evidences: Array<{ type, commit_hash?, author?, description?, confidence }>
  }>,
  next_cursor?: string,
  total_count: number
}
```

### 6.3 verify_statement

```typescript
// 输入
{ statement: string, context_scope?: string[] }
// 输出
{
  verdict: "SUPPORTED" | "PARTIALLY_SUPPORTED" | "NOT_SUPPORTED",
  confidence: number,
  evidence: Array<{
    fact_id: string, filepath: string, code_snippet: string,
    evidence_type: string, description: string
  }>,
  unsupported_parts: string[]
}
```

### 6.4 extract_capabilities

```typescript
// 输入
{ project_path?: string }
// 输出
{
  capabilities: Array<{
    id: string, name: string, category: string,
    confidence: number, evidence_count: number, related_facts: string[]
  }>
}
```

### 6.5 get_decision_trace

```typescript
// 输入
{ node_id: string, limit?: number }
// 输出
{
  node_id: string,
  timeline: Array<{
    version?, commit_hash, author, timestamp,
    change_type: "introduction"|"modification"|"replacement"|"removal",
    ast_change: string, related_issue?
  }>
}
```

### 6.6 parse_jd

```typescript
// 输入
{ jd_text: string }
// 输出
{
  requirements: Array<{
    id: string, text: string,
    type: "technology"|"architecture"|"methodology"|"soft_skill",
    priority: "required"|"preferred"|"nice_to_have"
  }>,
  metadata: { company?, position?, location? }
}
```

### 6.7 match_capabilities

```typescript
// 输入
{ jd_requirements: Array<{ id: string, type: string }> }
// 输出
{
  matching_matrix: Record<string, number>,
  details: Array<{
    requirement_id: string,
    matched_capabilities: Array<{ capability_id, score, evidence_count }>,
    unmatched: boolean
  }>
}
```

### 6.8 export_context

```typescript
// 输入
{ format?: "json"|"compact", include_git_history?: boolean, max_tokens?: number }
// 输出
{
  project: { name, languages, total_files, loc },
  capabilities: Array<{ id, name, confidence }>,
  key_facts: Array<{ id, type, filepath, summary }>,
  recent_decisions: Array<{ node_id, latest_change, timestamp }>,
  evidence_stats: { total, by_type: Record<string, number> }
}
```

### 6.9 diff_versions

```typescript
// 输入
{ source_rev: string, target_rev: string }
// 输出
{
  structural_diff: {
    added_facts: Array<{ id, type }>,
    modified_facts: Array<{ id, type, change_type, ast_diff }>,
    removed_facts: Array<{ id, type }>
  }
}
```

### 6.10 render_pdf

```typescript
// 输入
{ resume_json: string, template?: string }
// 输出
{ pdf_path: string, pages: number }
```

---

## 七、关键实现细节

### 7.1 tree-sitter WASM 加载

```typescript
import Parser from 'web-tree-sitter';

await Parser.init();
const parser = new Parser();
const TypeScript = await Parser.Language.load('path/to/tree-sitter-typescript.wasm');
parser.setLanguage(TypeScript);
```

### 7.2 增量索引策略

```
1. 计算所有源文件的 SHA-256
2. 与 file_hashes 表比对
3. 仅对 changed/added 文件重新解析
4. 对 removed 文件删除关联的 nodes/edges
5. 更新 file_hashes 表
```

### 7.3 Capability 提取规则（参考 Kognit）

```typescript
const CAPABILITY_RULES = [
  {
    pattern: /Redis|Memcached|cache/i,
    capability: { id: 'caching', name: 'Caching & Performance', category: 'performance' }
  },
  {
    pattern: /Kafka|RabbitMQ|message.queue/i,
    capability: { id: 'messaging', name: 'Message Queue & Async', category: 'infrastructure' }
  },
  {
    pattern: /CircuitBreaker|RetryPolicy|fallback/i,
    capability: { id: 'resilience', name: 'Resilience & Fault Tolerance', category: 'architecture' }
  },
  // ... 更多规则
];
```

### 7.4 JD Parser 规则（不依赖 LLM）

```typescript
const TECH_KEYWORDS = [
  'Redis', 'Kafka', 'PostgreSQL', 'MongoDB', 'Docker', 'Kubernetes',
  'TypeScript', 'Python', 'Go', 'Java', 'React', 'Vue', 'Node.js',
  // ... 完整技术词表
];

const ARCH_KEYWORDS = [
  'microservice', 'serverless', 'event-driven', 'CQRS', 'DDD',
  // ... 架构模式词表
];
```

### 7.5 Statement Verification 逻辑

```typescript
function verifyStatement(statement: string, facts: Fact[], evidence: Evidence[]): VerificationResult {
  // 1. 从 statement 中提取关键词
  const keywords = extractKeywords(statement);

  // 2. 在 FTS5 中搜索匹配的 Facts
  const matchedFacts = searchFacts(keywords);

  // 3. 查找每个 Fact 关联的 Evidence
  const supportingEvidence = matchedFacts.flatMap(f =>
    evidence.filter(e => e.fact_id === f.id)
  );

  // 4. 计算置信度
  const confidence = calculateConfidence(supportingEvidence);

  // 5. 判定 verdict
  const verdict = confidence > 0.7 ? 'SUPPORTED'
    : confidence > 0.3 ? 'PARTIALLY_SUPPORTED'
    : 'NOT_SUPPORTED';

  return { verdict, confidence, evidence: supportingEvidence, unsupported_parts: [] };
}
```

---

## 八、~/.lens/ 目录结构

```
~/.lens/
├── config.json                    # 全局配置
├── cache/
│   ├── <project-name>.db          # 每个项目一个 SQLite 数据库
│   └── file_hashes.json           # 全局文件哈希缓存（备用）
├── exports/
│   └── <project-uuid>.json        # Knowledge Package 缓存
└── templates/
    ├── modern.typ                 # Typst 简历模板
    └── minimal.typ
```

---

## 九、风险与缓解

| 风险 | 概率 | 影响 | 缓解 |
|:---|:---|:---|:---|
| tree-sitter WASM 性能不足 | 中 | 中 | 增量解析 + 缓存，避免全量重解析 |
| SQLite FTS5 中文搜索不准确 | 中 | 低 | 先支持英文关键词，中文作为后续增强 |
| MCP Tool 输出过大 | 低 | 中 | export_context 的 max_tokens 参数限制 |
| Typst 跨平台字体问题 | 中 | 低 | 内嵌 Noto Sans CJK 字体 |
| Capability 映射规则覆盖率不足 | 高 | 中 | 先支持 20+ 常见技术/架构，后续迭代扩充 |

---

## 十、验收标准

### Week 1 验收
- [ ] `npm run build` 成功
- [ ] `lens serve` 启动 MCP Server
- [ ] Claude Code 能识别 10 个 tool
- [ ] `lens analyze --path .` 能扫描文件

### Week 2 验收
- [ ] 对真实项目（如 references/codebase-memory-mcp）运行 analyze
- [ ] SQLite 中有 nodes 和 edges 数据
- [ ] Evidence 表有 git blame 信息
- [ ] Decision Traces 表有 commit 演变链

### Week 3 验收
- [ ] `search_evidence("redis")` 返回结果
- [ ] `verify_statement("使用了 Redis 缓存")` 返回 SUPPORTED
- [ ] `extract_capabilities()` 返回能力标签列表
- [ ] `parse_jd(jd_text)` 返回结构化 requirements
- [ ] `match_capabilities(requirements)` 返回分数矩阵

### Week 4 验收
- [ ] 端到端测试通过
- [ ] README 文档完整
- [ ] `npm pack` 成功
- [ ] Claude Code 完整调用流程：analyze → search → verify → export
