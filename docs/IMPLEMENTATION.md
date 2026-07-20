# Project-Lens — 完整实施计划

> **项目定位**: Project Knowledge Layer for AI Agents
> **版本**: 6.0 MVP | **日期**: 2026-07-16 | **状态**: ✅ 已实现
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

### 1.1 模块分类

| 类别 | 职责 | 包含 |
|:---|:---|:---|
| **Intelligence** | 提取、索引、验证、查询 | observe, explore, verify, trace |
| **Utility** | 基础设施 | snapshot (快照导出), render (PDF 渲染) |
| **~~Agent~~** | **不要有** | ~~Interview Agent, Resume Agent, Career Planner~~ |

### 1.2 Agent 需要什么信息（逆向推导）

| Agent 阶段 | Agent 缺什么 | Lens 提供什么 |
|:---|:---|:---|
| 理解项目 | 不知道代码里做了什么 | 项目事实、Evidence、Decision Trace |
| 写简历 | 害怕编造 | Statement Verification |
| 模拟面试 | 不知道哪些地方值得深挖 | Decision Timeline |

### 1.3 6 个 MCP Tool（已实现）

| # | Tool | 输入 | 输出 | 状态 |
|:---|:---|:---|:---|:---|
| 1 | `observe` | project_path, force_reindex | 索引统计 + 模块列表 | ✅ 已实现 |
| 2 | `explore` | query, category, sort_by, limit | Fact + Evidence 列表（按可信度/重要性排序） | ✅ 已实现 |
| 3 | `verify` | statement, context_scope | verdict + confidence + evidence | ✅ 已实现 |
| 4 | `trace` | query, fact_id, author, date_range | Decision Timeline + 摘要 | ✅ 已实现 |
| 5 | `snapshot` | format, max_tokens, include_git_history | 项目知识包 | ✅ 已实现 |
| 6 | `render` | json_data, template | PDF 文件 | ✅ 已实现 |

### 1.4 未来规划（未实现）

以下功能在早期规划中设计，但尚未实现：

| # | Tool | 功能 | 优先级 |
|:---|:---|:---|:---|
| 7 | `extract_capabilities` | 从 Facts 中提取能力标签 | P2 |
| 8 | `parse_jd` | JD 文本 → 结构化 requirements | P2 |
| 9 | `match_capabilities` | Capability × JD → 分数矩阵 | P2 |
| 10 | `diff_versions` | 对比两个版本的结构差异 | P3 |

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
│  Lens: Project Knowledge Layer                          │
│                                                          │
│  Intelligence: observe / explore / verify / trace        │
│  Utility: snapshot / render                              │
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

### 2.3 SQLite 表设计（已实现）

```sql
-- Layer 0: Facts (代码结构事实)
CREATE TABLE nodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project TEXT NOT NULL,
  label TEXT NOT NULL,              -- "function" | "class" | "file" | ...
  name TEXT NOT NULL,
  qualified_name TEXT NOT NULL,     -- "src/auth.ts::validateSession"
  file_path TEXT NOT NULL,
  start_line INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  properties TEXT,                  -- JSON: 语言特定附加信息
  content_hash TEXT,                -- 文件内容哈希（增量更新）
  loc INTEGER,                      -- 代码行数
  UNIQUE(project, qualified_name)
);

CREATE TABLE edges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project TEXT NOT NULL,
  source_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  target_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  type TEXT NOT NULL,               -- "calls" | "imports" | "extends"
  properties TEXT,
  UNIQUE(source_id, target_id, type)
);

-- Layer 1: Evidence (工程凭证)
CREATE TABLE evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  evidence_id TEXT NOT NULL UNIQUE,
  fact_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  type TEXT NOT NULL,               -- "git_commit" | "test_coverage" | "benchmark"
  commit_hash TEXT,
  author TEXT,
  timestamp TEXT,
  description TEXT NOT NULL,
  confidence REAL DEFAULT 1.0,
  evidence_score REAL DEFAULT 0.0   -- 综合评分
);

CREATE TABLE decision_traces (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trace_id TEXT NOT NULL UNIQUE,
  fact_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  version TEXT,
  commit_hash TEXT NOT NULL,
  author TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  ast_change TEXT NOT NULL,
  change_type TEXT NOT NULL,        -- "introduction" | "modification" | "removal"
  related_issue TEXT
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

-- Project metadata
CREATE TABLE projects (
  name TEXT PRIMARY KEY,
  root_path TEXT NOT NULL,
  languages TEXT,                   -- JSON array
  dependencies TEXT,                -- JSON object
  total_files INTEGER,
  loc INTEGER,
  indexed_at TEXT NOT NULL
);

-- Requirement synonyms (用于搜索扩展)
CREATE TABLE requirement_synonyms (
  requirement TEXT PRIMARY KEY,
  search_terms TEXT NOT NULL,       -- JSON array
  category TEXT
);

-- FTS5 全文搜索
CREATE VIRTUAL TABLE nodes_fts USING fts5(
  name, qualified_name, file_path, properties,
  content=nodes, content_rowid=id
);

CREATE VIRTUAL TABLE evidence_fts USING fts5(
  description, commit_hash, author
);

CREATE VIRTUAL TABLE decision_traces_fts USING fts5(
  ast_change
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

### 3.3 依赖清单（实际使用）

```json
{
  "dependencies": {
    "zod": "^4.4.3",
    "web-tree-sitter": "^0.26.11",
    "tree-sitter-wasms": "^0.1.13",
    "better-sqlite3": "^12.11.1",
    "@modelcontextprotocol/sdk": "^1.29.0",
    "commander": "^15.0.0",
    "chalk": "^5.6.2"
  },
  "devDependencies": {
    "typescript": "^7.0.2",
    "vitest": "^4.1.10",
    "@types/node": "^26.1.1",
    "@types/better-sqlite3": "^7.6.13",
    "tree-sitter-cli": "^0.26.11",
    "tree-sitter-typescript": "^0.23.2",
    "tree-sitter-python": "^0.25.0",
    "tree-sitter-go": "^0.25.0"
  }
}
```

---

## 四、项目目录结构（已实现）

```
project-lens/
├── src/
│   ├── schemas/                 # Zod Schema 定义
│   │   ├── fact.ts              # Fact + FactEdge + ProjectMetadata
│   │   ├── evidence.ts          # Evidence + DecisionTrace
│   │   ├── ranking.ts           # Credibility + Importance 评分
│   │   └── index.ts             # 统一导出
│   │
│   ├── extractor/               # Layer 0: Fact 提取
│   │   ├── index.ts             # 入口: scan → parse → store
│   │   ├── file-scanner.ts      # 文件发现 + 增量哈希
│   │   ├── ast-parser.ts        # tree-sitter WASM 解析
│   │   └── fact-builder.ts      # AST → Fact 节点 + Edge 边
│   │
│   ├── evidence/                # Layer 1: Evidence 绑定
│   │   ├── index.ts             # 入口: bind → store
│   │   ├── git-signal.ts        # git blame/history → Evidence + DecisionTrace
│   │   └── test-detector.ts     # 测试文件检测 → Evidence
│   │
│   ├── query/                   # 查询引擎
│   │   ├── index.ts             # 统一导出
│   │   ├── explore.ts           # explore (FTS5 搜索 + 排序)
│   │   ├── ranking.ts           # Credibility + Importance 评分
│   │   └── trace.ts             # trace (决策追踪)
│   │
│   ├── verify/                  # 声明验证
│   │   ├── index.ts             # 统一导出
│   │   ├── verdict.ts           # verifyStatement 入口
│   │   ├── keyword-extractor.ts # 关键词提取
│   │   └── confidence.ts        # 置信度计算
│   │
│   ├── snapshot/                # 快照导出
│   │   ├── index.ts             # 统一导出
│   │   ├── builder.ts           # 快照构建
│   │   ├── compressor.ts        # Token 压缩
│   │   └── token-estimator.ts   # Token 估算
│   │
│   ├── store.ts                 # SQLite 数据库管理
│   │
│   ├── mcp/                     # MCP Server
│   │   ├── server.ts            # Server 入口 + 6 个 Tool 注册
│   │   └── tools/               # 每个 Tool 的实现
│   │       ├── observe.ts       # 构建索引
│   │       ├── explore.ts       # 探索知识
│   │       ├── verify.ts        # 声明验证
│   │       ├── trace.ts         # 决策追踪
│   │       ├── snapshot.ts      # 快照导出
│   │       └── render.ts        # PDF 渲染
│   │
│   └── cli/                     # CLI 入口
│       └── index.ts
│
├── tests/
│   ├── ast-parser.test.ts
│   ├── ranking.test.ts
│   ├── token-estimator.test.ts
│   ├── store.test.ts
│   ├── compressor.test.ts
│   └── keyword-extractor.test.ts
│
├── docs/
│   ├── erge.md                  # 原始评估指导意见
│   ├── erge-plus.md             # 最终定位文档
│   ├── advise.md                # 参考项目列表
│   ├── references-analysis.md   # 参考项目分析
│   ├── plan-v1.md ~ plan-v6.md  # 历史计划文档
│   └── IMPLEMENTATION.md        # 本文档
│
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

---

## 五、实施路径与进度

### Week 1: 基础层 ✅ 已完成

**目标**：项目骨架可运行，MCP Server 能被 Claude Code 识别。

| 任务 | 文件 | 验收标准 | 状态 |
|:---|:---|:---|:---|
| 初始化项目 | package.json, tsconfig.json | `npm run build` 成功 | ✅ |
| 安装依赖 | node_modules/ | 所有依赖安装成功 | ✅ |
| Schema 定义 | src/schemas/*.ts | Zod 校验测试通过 | ✅ |
| SQLite Store | src/store.ts | 建表成功，CRUD 操作正常 | ✅ |
| 增量文件扫描 | src/extractor/file-scanner.ts | 对真实项目扫描，输出 changed/added/removed | ✅ |
| MCP Server 骨架 | src/mcp/server.ts | 6 个 tool 注册，`lens serve` 启动成功 | ✅ |
| CLI 入口 | src/cli/index.ts | `lens serve` / `lens --version` 可运行 | ✅ |

### Week 2: 提取层 ✅ 已完成

**目标**：能从真实代码仓库中提取 Fact 和 Evidence。

| 任务 | 文件 | 验收标准 | 状态 |
|:---|:---|:---|:---|
| tree-sitter WASM 集成 | src/extractor/ast-parser.ts | 加载 WASM，解析 TS/Python/Go 文件 | ✅ |
| Fact Builder | src/extractor/fact-builder.ts | AST → nodes + edges 写入 SQLite | ✅ |
| Git 信号提取 | src/evidence/git-signal.ts | git blame/history → Evidence + DecisionTrace | ✅ |
| 测试检测 | src/evidence/test-detector.ts | 检测测试文件 → Evidence | ✅ |
| Evidence 绑定 | src/evidence/index.ts | Evidence + DecisionTrace 写入 SQLite | ✅ |

### Week 3: 查询层 ✅ 已完成

**目标**：6 个 MCP Tool 全部可用。

| 任务 | 文件 | 验收标准 | 状态 |
|:---|:---|:---|:---|
| explore | src/query/explore.ts | FTS5 搜索返回结果，支持分类/排序 | ✅ |
| verify | src/verify/verdict.ts | 有证据返回 SUPPORTED，无证据返回 NOT_SUPPORTED | ✅ |
| trace | src/query/trace.ts | 返回决策时间线 + 摘要 | ✅ |
| snapshot | src/snapshot/builder.ts | 导出 < 50K tokens 的知识包 | ✅ |
| ranking | src/query/ranking.ts | Credibility + Importance 双维度评分 | ✅ |

### Week 4: 联调与发布 ✅ 已完成

**目标**：端到端可用，Claude Code 能通过 MCP 调用所有 Tool。

| 任务 | 文件 | 验收标准 | 状态 |
|:---|:---|:---|:---|
| MCP 联调 | src/mcp/server.ts | Claude Code 识别 6 个 tool | ✅ |
| CLI 命令 | src/cli/index.ts | observe/explore/trace/snapshot 命令可用 | ✅ |
| 测试覆盖 | tests/ | 6 个测试文件覆盖核心模块 | ✅ |
| README | README.md | 安装 + 使用说明完整 | ✅ |

---

## 六、MCP Tool 详细 Schema（已实现）

### 6.1 observe — 构建索引

```typescript
// 输入
{
  project_path?: string,      // 项目路径（默认 cwd）
  force_reindex?: boolean     // 强制全量重索引（默认 false）
}
// 输出
{
  project: string,
  stats: {
    filesScanned: number,
    factsExtracted: number,
    edgesCreated: number,
    filesParsed: number,
    errors: number,
    evidences: number,
    decisionTraces: number
  },
  warnings: string[],
  modules: Array<{ path: string, facts: number }>
}
```

### 6.2 explore — 探索项目知识

```typescript
// 输入
{
  query?: string,                    // 全文搜索关键词
  category?: string,                 // 按分类过滤 (performance, security, data, ...)
  evidence_type?: string,            // 按证据类型过滤
  fact_type?: string,                // 按事实类型过滤 (function, class, interface, module)
  sort_by?: 'credibility'|'importance'|'recent',  // 排序方式
  limit?: number,                    // 最大返回数量（默认 20）
  cursor?: string,                   // 分页游标
  context_scope?: string[]           // 限制搜索范围
}
// 输出
{
  results: Array<{
    fact: { id, type, name, filepath, line_range },
    credibility: { score: number, breakdown: {...} },
    importance: { score: number, breakdown: {...} },
    evidence: Array<{ type, description, confidence }>
  }>,
  navigation_guide: Array<{ from, to, via }>,
  total_count: number,
  next_cursor?: string
}
```

### 6.3 verify — 声明验证

```typescript
// 输入
{
  statement: string,           // 待验证的声明
  context_scope?: string[]     // 限制搜索范围
}
// 输出
{
  verdict: 'SUPPORTED' | 'PARTIALLY_SUPPORTED' | 'NOT_SUPPORTED',
  confidence: number,
  evidence: Array<{
    fact_id: number,
    filepath: string,
    code_snippet: string,
    evidence_type: string,
    description: string
  }>,
  unsupported_parts: string[]
}
```

### 6.4 trace — 决策追踪

```typescript
// 输入
{
  query?: string,              // 搜索关键词
  fact_id?: number,            // 限制到特定事实
  filepath?: string,           // 限制到特定文件
  author?: string,             // 限制到特定作者
  date_from?: string,          // 起始日期 (ISO)
  date_to?: string,            // 结束日期 (ISO)
  limit?: number               // 最大返回数量（默认 50）
}
// 输出
{
  timeline: Array<{
    trace_id: string,
    commit_hash: string,
    author: string,
    timestamp: string,
    change_type: 'introduction'|'modification'|'removal',
    ast_change: string,
    affected_facts: Array<{ id, name, type }>
  }>,
  decision_summary: {
    key_decisions: Array<{ timestamp, description }>,
    contributors: Array<{ author, commits }>
  }
}
```

### 6.5 snapshot — 项目快照

```typescript
// 输入
{
  format?: 'json' | 'compact',           // 输出格式（默认 compact）
  include_git_history?: boolean,          // 包含 Git 历史（默认 true）
  max_tokens?: number                     // Token 预算（默认 50000）
}
// 输出
{
  project: { name, languages, total_files, loc },
  key_facts: Array<{ id, type, name, filepath, summary }>,
  recent_decisions: Array<{ trace_id, latest_change, timestamp }>,
  evidence_stats: { total, by_type: Record<string, number> },
  token_count: number
}
```

### 6.6 render — PDF 渲染

```typescript
// 输入
{
  json_data: string,           // JSON 数据字符串
  template?: string            // 模板名称（默认 modern）
}
// 输出
{
  pdf_path: string,
  pages: number
}
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
4. 对 removed 文件删除关联的 nodes/edges（CASCADE）
5. 更新 file_hashes 表
```

### 7.3 Credibility + Importance 评分

```typescript
// Credibility = 可信度（代码质量证据）
Credibility = 0.3*benchmark + 0.3*test_coverage + 0.2*documentation + 0.2*git_history

// Importance = 重要性（架构影响力）
Importance = 0.4*connectivity + 0.3*modification_frequency + 0.3*recency
```

### 7.4 Statement Verification 逻辑

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
| MCP Tool 输出过大 | 低 | 中 | snapshot 的 max_tokens 参数限制 |
| 增量索引数据一致性 | 低 | 高 | WAL 模式 + 事务 + integrity check |

---

## 十、验收标准

### Week 1 验收 ✅
- [x] `npm run build` 成功
- [x] `lens serve` 启动 MCP Server
- [x] Claude Code 能识别 6 个 tool
- [x] `lens observe --path .` 能扫描文件

### Week 2 验收 ✅
- [x] 对真实项目运行 observe
- [x] SQLite 中有 nodes 和 edges 数据
- [x] Evidence 表有 git 信息
- [x] Decision Traces 表有 commit 演变链

### Week 3 验收 ✅
- [x] `explore("redis")` 返回结果
- [x] `verify("使用了 Redis 缓存")` 返回 SUPPORTED
- [x] `trace("Redis")` 返回决策时间线
- [x] `snapshot` 导出知识包

### Week 4 验收 ✅
- [x] 端到端测试通过（6 个测试文件）
- [x] README 文档完整
- [x] CLI 命令可用：observe/explore/trace/snapshot
