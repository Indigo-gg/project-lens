# Project-Lens V4：从求职工具到 AI 认知基础设施

> **版本**: 4.0 (Cognitive Infrastructure) | **协调者**: MiMoCode | **评估方**: agy + codex
>
> 基于 `docs/erge.md` 评估指导意见的根本性定位转变，经三方讨论后形成。

---

## 〇、设计目的与目标关联

### 我们要做什么？

Project-Lens 不再是一个求职工具。它变成 **AI Agent 的认知基础设施** — 把代码仓库变成可信、结构化、可查询、可验证的知识层，让任何 AI Agent 都能基于真实代码事实进行推理。

### 为什么要做这个转变？

原来的定位是"求职工具"（Resume Builder + Interview Agent）。但问题是：

| 问题 | 解释 |
|:---|:---|
| **会被大模型替代** | Claude/Gemini 自己就能写简历、问面试题，不需要你的工具 |
| **生命周期极低** | 求职是一次性需求，用完即弃 |
| **替 Agent 思考了** | Resume Builder 在"写"，Interview Agent 在"问"，Critic 在"建议" — 这些都是 Agent 的工作 |

新定位的核心逻辑：

```
旧定位: Lens 帮你写简历 → Claude 更擅长写 → Lens 没价值了
新定位: Lens 告诉 Agent 代码里有什么 → Agent 自己决定怎么用 → Lens 永远有价值
```

### 核心原则

```
Lens 只回答: What Exists.     （代码里有什么事实）
Agent 回答: What It Means.    （这些事实意味着什么）

永远不要替 Agent 思考。
```

### 数据模型的边界

```
Fact → Evidence → Capability
  ↑       ↑         ↑
 Lens   Lens      Agent
(不可解释) (可追溯)  (需要推理)
```

- **Fact**: 函数调用了 RedisClient、类继承了 Repository — 纯粹的代码结构事实
- **Evidence**: 这个 Redis 用法是在 commit a8f9c 中引入的、作者是 Alice、测试覆盖率 85% — 事实的工程凭证
- **Capability**: 说明候选人具备高并发缓存设计能力 — **这不是 Lens 的事，是 Agent 的事**

### 与旧方案的对比

| 模块 | 旧方案 (V3) | 新方案 (V4) | 为什么改 |
|:---|:---|:---|:---|
| Resume Builder | 生成 PDF | **删除** → 改为 `export_context()` | PDF 是 Agent 的输出，不是 Lens 的 |
| Question Generator | 生成面试题 | **删除** → 改为 `get_decision_trace()` | 追问是 Agent 的工作 |
| Critic | 给修改建议 | **删除** → 改为 `coverage_checker()` | Lens 不给建议，只报事实 |
| Planner | 规划任务 | **删除** | Agent 天然有规划能力 |
| Interview Agent | 扮演面试官 | **删除** | Claude 就是面试官 |
| **analyze_project()** | 无 | **新增** | 项目索引 |
| **search_evidence()** | 无 | **新增** | 按关键词搜索证据 |
| **get_decision_trace()** | 无 | **新增** | 架构决策演变链 |
| **find_supporting_evidence()** | 无 | **新增** | 验证断言是否有代码支撑 |
| **export_context()** | 无 | **新增** | 导出项目知识包 |
| **diff_versions()** | 无 | **新增** | 版本间结构化差异 |

### 一句话总结

**V4 的设计目的是：把 Lens 从一个会被大模型替代的求职工具，变成一个大模型越强就越需要的认知基础设施 — 因为无论 Agent 多聪明，它都需要有人告诉它"代码里到底有什么"。**

---

## 一、架构总览

### 1.1 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│  Agent (Claude / Gemini / Codex)                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Think & Plan → Query Lens → Get Facts → Reason →  │    │
│  │  Write Output (Resume / PR / Review / Interview)    │    │
│  └─────────────────────────────────────────────────────┘    │
│                        │ MCP Protocol                       │
├────────────────────────┼────────────────────────────────────┤
│                        ▼                                    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Lens: Cognitive Infrastructure                      │    │
│  │                                                      │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │    │
│  │  │ Query    │  │ Search   │  │ Verification     │  │    │
│  │  │ Engine   │  │ Engine   │  │ Engine           │  │    │
│  │  └────┬─────┘  └────┬─────┘  └────────┬─────────┘  │    │
│  │       │              │                  │            │    │
│  │       ▼              ▼                  ▼            │    │
│  │  ┌─────────────────────────────────────────────┐    │    │
│  │  │  Layer 1: Evidence Layer                     │    │    │
│  │  │  Evidence Graph + Decision Trace             │    │    │
│  │  └────────────────────┬────────────────────────┘    │    │
│  │                       │                             │    │
│  │                       ▼                             │    │
│  │  ┌─────────────────────────────────────────────┐    │    │
│  │  │  Layer 0: Fact Layer                        │    │    │
│  │  │  AST Facts + Git Facts + Metrics             │    │    │
│  │  └────────────────────┬────────────────────────┘    │    │
│  │                       │                             │    │
│  └───────────────────────┼─────────────────────────────┘    │
│                          │                                  │
│                          ▼                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Codebase (tree-sitter AST + git history)           │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 两层数据模型

```
Layer 0 — Fact Layer (事实层)
  │
  │  从代码中提取的不可解释的物理事实
  │  ├─ 函数调用了 RedisClient
  │  ├─ 类继承了 Repository
  │  ├─ import 了 fastapi
  │  └─ 40ms → 15ms (benchmark)
  │
  ▼
Layer 1 — Evidence Layer (证据层)
  │
  │  将事实与工程凭证绑定
  │  ├─ 这个 Redis 用法在 commit a8f9c 中引入
  │  ├─ 作者是 Alice
  │  ├─ 测试覆盖率 85%
  │  └─ 从 v1.0 到 v2.0 的演变链
  │
  ▼
  → 交给 Agent
     Agent 自己组合成 Capability / Resume / Interview 问题
```

---

## 二、MCP API 设计

### 2.1 工具清单

| 工具 | 职责 | 输入 | 输出 |
|:---|:---|:---|:---|
| `analyze_project` | 扫描项目，返回索引 | project_path, depth | 项目元数据 + 模块拓扑 |
| `search_evidence` | 按关键词搜索 Evidence | query, evidence_type, limit, cursor | 匹配的 Fact + Evidence 列表 |
| `get_decision_trace` | 返回架构决策演变链 | node_id, limit | 按时间排序的演变节点 |
| `find_supporting_evidence` | 验证断言是否有代码支撑 | statement, context_scope | verdict + supporting_evidence |
| `export_context` | 导出项目知识包 | format, include_git_history | 序列化的完整知识图谱 |
| `diff_versions` | 比较两个版本的结构差异 | source_rev, target_rev | added/modified/removed Facts |

### 2.2 详细 Schema

#### `lens.analyze_project`

```typescript
// 输入
{
  project_path?: string,  // 默认 cwd
  depth?: number          // 依赖分析深度，默认 2
}

// 输出
{
  project_metadata: {
    languages: string[],
    dependencies: Record<string, string>,
    total_files: number,
    loc: number
  },
  entry_points: Array<{
    path: string,
    type: "library_entry" | "cli_entry" | "api_entry"
  }>,
  module_topology: Array<{
    module: string,
    dependencies: string[]
  }>
}
```

#### `lens.search_evidence`

```typescript
// 输入
{
  query: string,                    // 关键词: "redis", "performance", "authentication"
  evidence_type?: "git_commit" | "test_coverage" | "api_contract",
  limit?: number,                   // 默认 20
  cursor?: string                   // 分页游标
}

// 输出
{
  results: Array<{
    fact: {
      id: string,                   // "src/auth.ts::validateSession"
      type: "function" | "class" | "variable" | "dependency",
      filepath: string,
      line_range: [number, number]
    },
    evidences: Array<{
      type: string,
      commit_hash?: string,
      author?: string,
      message?: string,
      timestamp?: string
    }>
  }>,
  next_cursor?: string
}
```

#### `lens.get_decision_trace`

```typescript
// 输入
{
  node_id: string,    // "src/db/connection.ts::DatabasePool"
  limit?: number      // 默认 10
}

// 输出
{
  node_id: string,
  evolution_trace: Array<{
    version?: string,
    commit_hash: string,
    author: string,
    timestamp: string,
    ast_change: string,           // "Changed pool limit from 10 to 50"
    related_issue?: string        // "#412 (Database timeout)"
  }>
}
```

#### `lens.find_supporting_evidence`

```typescript
// 输入
{
  statement: string,               // "系统支持 Redis 故障转移自动重连"
  context_scope?: string[]         // 限定搜索范围
}

// 输出
{
  verdict: "SUPPORTED" | "PARTIALLY_SUPPORTED" | "NOT_SUPPORTED",
  confidence_score: number,        // 0-1
  supporting_evidence: Array<{
    fact: {
      id: string,
      filepath: string,
      code_snippet: string
    },
    reason: string                 // "Found Sentinel retry strategy config"
  }>,
  unsupported_parts: string[]
}
```

#### `lens.export_context`

```typescript
// 输入
{
  format?: "json" | "protobuf",   // 默认 json
  include_git_history?: boolean    // 默认 true
}

// 输出
{
  export_timestamp: string,
  facts_count: number,
  evidence_count: number,
  data: object                     // 完整知识图谱
}
```

#### `lens.diff_versions`

```typescript
// 输入
{
  source_rev: string,    // "v1.0.0" 或 commit hash
  target_rev: string     // "v2.0.0" 或 commit hash
}

// 输出
{
  structural_diff: {
    added_facts: Array<{ id: string, type: string }>,
    modified_facts: Array<{
      id: string,
      type: string,
      change_type: "LOGIC_CHANGE" | "SIGNATURE_CHANGE" | "REFACTOR",
      ast_diff: string
    }>,
    removed_facts: Array<{ id: string, type: string }>
  }
}
```

---

## 三、数据存储设计

### 3.1 `~/.lens/` 目录结构

```
~/.lens/
├── config.json                    # 全局配置
├── cache/
│   ├── facts.db                   # Layer 0: SQLite (Facts 表 + Edges 表)
│   ├── evidence.db                # Layer 1: SQLite (Evidence 表 + DecisionTrace 表)
│   └── file_hashes.json           # 增量更新用的文件哈希缓存
├── exports/
│   └── <project-uuid>.json        # export_context 输出的知识包缓存
└── templates/
    └── context-export.json        # 导出模板
```

### 3.2 SQLite 表设计

#### Facts 表 (Layer 0)

```sql
CREATE TABLE facts (
  id TEXT PRIMARY KEY,              -- "src/auth.ts::validateSession"
  type TEXT NOT NULL,               -- "function" | "class" | "variable" | "dependency"
  filepath TEXT NOT NULL,
  line_start INTEGER NOT NULL,
  line_end INTEGER NOT NULL,
  name TEXT NOT NULL,
  metadata JSON,                   -- 语言特定的附加信息
  content_hash TEXT NOT NULL,       -- 用于增量更新
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE fact_edges (
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  relation TEXT NOT NULL,           -- "calls" | "imports" | "extends" | "implements"
  PRIMARY KEY (source_id, target_id, relation)
);
```

#### Evidence 表 (Layer 1)

```sql
CREATE TABLE evidence (
  id TEXT PRIMARY KEY,
  fact_id TEXT NOT NULL,            -- 关联到 facts.id
  type TEXT NOT NULL,               -- "git_commit" | "test_coverage" | "benchmark"
  commit_hash TEXT,
  author TEXT,
  timestamp TEXT,
  description TEXT,                 -- AST-level diff 描述
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
  related_issue TEXT,
  FOREIGN KEY (fact_id) REFERENCES facts(id)
);
```

---

## 四、核心引擎实现

### 4.1 Fact Extractor (Layer 0)

```
src/
├── extractor/
│   ├── index.ts                 # 入口: scan → parse → store
│   ├── file-scanner.ts          # 文件发现 + 哈希比对 (增量)
│   ├── ast-parser.ts            # tree-sitter AST 解析
│   ├── fact-builder.ts          # AST → Fact 节点 + Edge 边
│   └── queries/                 # tree-sitter 查询规则
│       ├── typescript.scm
│       ├── python.scm
│       └── go.scm
```

### 4.2 Evidence Binder (Layer 1)

```
src/
├── evidence/
│   ├── index.ts                 # 入口: bind → store
│   ├── git-blame.ts             # git blame → Evidence 绑定
│   ├── git-diff.ts              # AST-level diff → Decision Trace
│   ├── test-coverage.ts         # 覆盖率报告 → Evidence 绑定
│   └── benchmark-tracker.ts     # benchmark 结果 → Evidence 绑定
```

### 4.3 Query Engine

```
src/
├── query/
│   ├── index.ts                 # 入口: dispatch to sub-engines
│   ├── search.ts                # search_evidence 实现
│   ├── decision-trace.ts        # get_decision_trace 实现
│   ├── verification.ts          # find_supporting_evidence 实现
│   ├── context-export.ts        # export_context 实现
│   └── version-diff.ts          # diff_versions 实现
```

### 4.4 MCP Server

```
src/
├── mcp/
│   ├── server.ts                 # MCP Server 入口 (Stdio 传输)
│   ├── tools/
│   │   ├── analyze-project.ts
│   │   ├── search-evidence.ts
│   │   ├── decision-trace.ts
│   │   ├── supporting-evidence.ts
│   │   ├── export-context.ts
│   │   └── diff-versions.ts
│   └── schema.ts                 # Tool JSON Schema 定义
```

### 4.5 CLI (调试用)

```
src/
├── cli/
│   ├── index.ts                 # lens analyze / search / trace / export / diff
│   └── output-formatter.ts      # 终端友好的输出格式化
```

---

## 五、tree-sitter 查询规则设计

### TypeScript / JavaScript

```scheme
;; 捕获类声明
(class_declaration
  name: (type_identifier) @class.name) @class.def

;; 捕获函数声明
(function_declaration
  name: (identifier) @function.name) @function.def

;; 捕获箭头函数
(lexical_declaration
  (variable_declarator
    name: (identifier) @function.name
    value: (arrow_function))) @function.def

;; 捕获导入依赖
(import_statement
  source: (string) @import.source) @import.def

;; 捕获方法调用 (用于 calls 关系)
(call_expression
  function: (member_expression
    object: (identifier) @caller
    property: (property_identifier) @method)) @call.def
```

### Python

```scheme
;; 类声明
(class_definition
  name: (identifier) @class.name) @class.def

;; 函数声明
(function_definition
  name: (identifier) @function.name) @function.def

;; 装饰器
(decorated_definition
  definition: (function_definition
    name: (identifier) @function.name)) @function.decorated

;; 导入
(import_statement
  module_name: (dotted_name) @import.source) @import.def

(import_from_statement
  module_name: (dotted_name) @import.source) @import.def
```

---

## 六、迁移路径

### 6.1 模块复用与删除矩阵

| V3 模块 | V4 状态 | 处理方式 |
|:---|:---|:---|
| `src/analyzer/ast-parser.ts` | **复用** | 提取 AST 核心逻辑，删除所有 LLM 相关代码 |
| `src/analyzer/git-analyzer.ts` | **复用** | 保留 git blame/diff 分析，重新绑定到 Evidence |
| `src/analyzer/evidence-mapper.ts` | **重构** | 从"生成 Resume 亮点"改为"生成 Fact 节点" |
| `src/analyzer/file-discovery.ts` | **复用** | 直接迁移 |
| `src/builder/` (Resume Builder) | **删除** | 整个目录删除 |
| `src/interview/` (Interview Agent) | **删除** | 整个目录删除 |
| `src/critic/` (Critic) | **删除** | 整个目录删除 |
| `src/bridge/` (LocalAgentBridge) | **删除** | 不再需要子进程调用 Agent |
| `src/schemas/` | **重写** | 从 Resume Schema 改为 Fact/Evidence Schema |
| `src/mcp/` | **重写** | 从 5 个工具改为 6 个工具 |

### 6.2 迁移时间线

```
Week 1:  删除旧模块 (builder/, interview/, critic/, bridge/)
         重写 Schemas (fact.ts, evidence.ts)
         重写 MCP Server 骨架

Week 2:  实现 Fact Extractor (tree-sitter + file scanner)
         实现 Evidence Binder (git blame + diff)

Week 3:  实现 Query Engine (search, decision_trace, verification)
         实现 export_context + diff_versions

Week 4:  MCP 联调测试 (Claude Code / Gemini 调用)
         CLI 调试工具
         发布 Cognitive Infrastructure 1.0
```

---

## 七、项目目录结构

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
│   ├── query/                   # 查询引擎
│   │   ├── index.ts
│   │   ├── search.ts
│   │   ├── decision-trace.ts
│   │   ├── verification.ts
│   │   ├── context-export.ts
│   │   └── version-diff.ts
│   ├── mcp/                     # MCP Server
│   │   ├── server.ts
│   │   ├── tools/
│   │   └── schema.ts
│   ├── cli/                     # CLI (调试用)
│   │   ├── index.ts
│   │   └── output-formatter.ts
│   └── schemas/                 # Zod Schema
│       ├── fact.ts
│       ├── evidence.ts
│       └── project.ts
├── tests/
│   ├── extractor/
│   ├── evidence/
│   ├── query/
│   └── mcp/
├── docs/
│   ├── erge.md
│   ├── plan-v2.md
│   ├── plan-v3.md
│   └── plan-v4.md              # 本文档
├── package.json
├── tsconfig.json
└── README.md
```

---

## 八、依赖清单

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

---

## 九、长期价值：为什么这比求职工具更抗风险

```
旧定位的风险:
  Claude 4.0 能自己写简历 → Lens 的 Resume Builder 废了
  Gemini 能自己问面试题 → Lens 的 Interview Agent 废了
  用户直接在聊天界面解决一切 → Lens 没人用了

新定位的护城河:
  模型再强，也无法凭空读取本地 Git 历史和增量 AST
  Agent 必须有人告诉它"代码里到底有什么"
  Lens 成为 Agent 不可或缺的"眼睛和记忆"
  越多 Agent 使用 → 越多数据沉淀 → 越难替代
```

**一句话：不是在和 Agent 竞争，而是成为 Agent 的基础设施。**
