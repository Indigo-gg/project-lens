# Project-Lens V6 Architecture

> **Version**: 6.0 | **Date**: 2026-07-17 | **Based on**: Constitution v1.0
>
> **核心变化**: 基于宪法重新设计，明确工具职责边界

---

## 〇、V5 → V6 核心变化

| 变化 | V5 | V6 | 原因 |
|:---|:---|:---|:---|
| 工具数量 | 5 个 | **6 个** | 拆分职责，每个工具回答一个问题 |
| 工具命名 | search_evidence | **explore** | Exploration 不是 Search |
| 新增工具 | - | **trace** | 决策追踪独立，不再藏在 search_evidence |
| Evidence Ranking | 单一 Score | **Credibility + Importance** | 拆分不同维度，Agent 自己选择 |
| Requirement Expansion | 自动扩展 | **Agent 负责** | Agent 能自己扩展，Lens 不做 Interpretation |
| 宪法 | 无 | **Constitution v1.0** | 冻结设计原则，防止跑偏 |

### 宪法检验

V6 的每个工具都必须通过宪法检验：

1. ✅ `observe()` — 回答"这个项目里有什么？"
2. ✅ `explore()` — 回答"某个功能在项目里怎么走？"
3. ✅ `trace()` — 回答"为什么这样实现？"
4. ✅ `verify()` — 回答"这句话有代码证据吗？"
5. ✅ `snapshot()` — 回答"整个项目是什么样的？"
6. ✅ `render()` — 回答"如何把 JSON 变成 PDF？"

---

## 一、六个核心工具

### Tool 1: observe()

**职责**: 扫描项目，建立索引（Facts + Edges + Evidence）

**回答的问题**: 这个项目里有什么？

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

**宪法检验**: 
- ✅ 回答一个具体问题
- ✅ 帮助 Agent 理解项目
- ✅ 输出可追溯到 Code/Git/Test/Doc
- ✅ 避免 Interpretation

---

### Tool 2: explore()

**职责**: 探索项目知识，提供导航路径

**回答的问题**: 某个功能在项目里怎么走？

```typescript
// Input
{
  query?: string,                    // 全文搜索关键词
  category?: string,                 // "performance" | "security" | "data" | ...
  evidence_type?: string,            // "git_commit" | "test" | "benchmark" | "dependency"
  fact_type?: string,                // "function" | "class" | "interface" | "module"
  
  // 排序
  sort_by?: "credibility" | "importance" | "recent",  // 默认 credibility
  
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
    credibility: {
      has_benchmark: boolean,
      has_test: boolean,
      has_docs: boolean,
      has_git_history: boolean,
      score: number,                  // 0-1
    },
    importance: {
      centrality: number,             // 连接度
      frequency: number,              // 修改频率
      recency: number,                // 时效性
      score: number,                  // 0-1
    },
  }>,
  next_cursor?: string,
  total_count: number,
  navigation_guide?: Array<{          // 探索路径
    from: string,
    to: string,
    via: string,
  }>,
}
```

**宪法检验**:
- ✅ 回答一个具体问题（"某个功能怎么走？"）
- ✅ 提供 Exploration 而不只是 Answer
- ✅ 输出可追溯到 Code/Git/Test/Doc
- ✅ 避免 Interpretation

**与 V5 search_evidence 的区别**:
- V5: 万能搜索，混合多种职责
- V6: 专注 Exploration，提供导航路径

---

### Tool 3: trace()

**职责**: 理解决策历史，追溯变更原因

**回答的问题**: 为什么这样实现？

```typescript
// Input
{
  query?: string,                    // 搜索关键词
  fact_id?: string,                  // 限定到某个 Fact
  filepath?: string,                 // 限定到某个文件
  author?: string,                   // 限定到某个作者
  date_from?: string,                // 开始时间
  date_to?: string,                  // 结束时间
  limit?: number,                    // 默认 50
}

// Output
{
  timeline: Array<{
    commit_hash: string,
    author: string,
    timestamp: string,
    change_type: "introduction" | "modification" | "replacement" | "removal",
    description: string,
    affected_facts: Array<{
      fact_id: string,
      name: string,
      filepath: string,
      change_description: string,
    }>,
    related_issue?: string,
  }>,
  decision_summary?: {
    key_decisions: Array<{
      timestamp: string,
      description: string,
      rationale: string,              // 从 commit message 提取
    }>,
  },
}
```

**宪法检验**:
- ✅ 回答一个具体问题（"为什么这样实现？"）
- ✅ 输出可追溯到 Git
- ✅ 避免 Interpretation（只提供事实，不解释为什么是对的）

---

### Tool 4: verify()

**职责**: 验证断言是否有代码证据支撑

**回答的问题**: 这句话有代码证据吗？

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

**宪法检验**:
- ✅ 回答一个具体问题（"这句话是真的吗？"）
- ✅ 输出可追溯到 Code/Git/Test
- ✅ 避免 Interpretation（只判断是否有证据，不判断是否正确）

---

### Tool 5: snapshot()

**职责**: 导出项目知识包

**回答的问题**: 整个项目是什么样的？

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
  architecture: {
    entry_points: Array<{
      filepath: string,
      type: string,
      description: string,
    }>,
    core_modules: Array<{
      filepath: string,
      facts: number,
      centrality: number,
    }>,
    dependencies: Record<string, string[]>,
  },
  key_facts: Array<{
    id: string,
    type: string,
    filepath: string,
    summary: string,
    credibility: number,
    importance: number,
  }>,
  recent_decisions: Array<{
    fact_id: string,
    commit_hash: string,
    author: string,
    timestamp: string,
    change_type: string,
    description: string,
  }>,
  navigation_guide: Array<{
    feature: string,
    files: string[],
    description: string,
  }>,
}
```

**宪法检验**:
- ✅ 回答一个具体问题（"整个项目是什么样的？"）
- ✅ 输出可追溯到 Code/Git/Test
- ✅ 包含 Navigation Guide（Exploration）
- ✅ 避免 Interpretation

---

### Tool 6: render()

**职责**: 将 JSON 渲染为 PDF

**回答的问题**: 如何把 JSON 变成 PDF？

```typescript
// Input
{
  json_data: string,              // JSON string
  template?: string,              // 默认 "modern"
}

// Output
{
  pdf_path: string,               // 生成的 PDF 文件路径
}
```

**宪法检验**:
- ✅ 回答一个具体问题
- ✅ 是 Utility，不涉及职业判断
- ✅ 建立在 Lens 上（接收 JSON，输出 PDF）

---

## 二、宪法检验清单

在设计新模块或修改现有功能时，逐项检查：

### 必须通过（否则拒绝）

| # | 检验问题 | 预期答案 |
|:---|:---|:---|
| 1 | 是否回答一个具体问题？ | Yes |
| 2 | 是否帮助 Agent 理解项目？ | Yes |
| 3 | 输出是否可追溯到 Code/Git/Test/Doc？ | Yes |
| 4 | 是否避免 Interpretation？ | Yes |

### 建议通过（否则讨论）

| # | 检验问题 | 预期答案 |
|:---|:---|:---|
| 5 | 是否提供 Exploration 而不只是 Answer？ | Yes |
| 6 | Agent 能否自己完成这个任务？ | No（需要 Lens） |
| 7 | 是否混合了多个职责？ | No |
| 8 | 是否属于 Skill 层而不是 Lens 层？ | No（属于 Lens） |

---

## 三、Evidence Ranking 设计

### Credibility Score（可信度）

```typescript
{
  has_benchmark: boolean,      // 有 benchmark evidence
  has_test: boolean,           // 有 test evidence
  has_docs: boolean,           // 有文档说明
  has_git_history: boolean,    // 有提交历史
  score: number,               // 0-1
}
```

### Importance Score（重要程度）

```typescript
{
  centrality: number,          // 连接度（边数量 / 最大边数量）
  frequency: number,           // 修改频率（commit 次数 / 最大 commit 次数）
  recency: number,             // 时效性（1 - 天数 / 365）
  score: number,               // 0-1
}
```

### Agent 如何使用

Agent 可以选择：
- 按 `credibility` 排序：找有测试、有 benchmark 的代码
- 按 `importance` 排序：找核心模块、频繁修改的代码
- 按 `recent` 排序：找最近修改的代码

Lens 不合成一个 Score，让 Agent 自己决定。

---

## 四、目录结构 (V6)

```
project-lens/
├── src/
│   ├── extractor/                  # Layer 0: Fact 提取
│   │   ├── index.ts                # observe() 核心
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
│   ├── query/                      # 查询引擎 (explore + trace)
│   │   ├── index.ts
│   │   ├── explore.ts              # 🆕 explore() 核心
│   │   ├── trace.ts                # 🆕 trace() 核心
│   │   └── ranking.ts              # 🆕 Credibility + Importance 评分
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
│   │   ├── server.ts               # 🔄 改为 6 个工具
│   │   └── tools/
│   │       ├── observe.ts
│   │       ├── explore.ts
│   │       ├── trace.ts
│   │       ├── verify.ts
│   │       ├── snapshot.ts
│   │       └── render.ts
│   ├── store.ts                    # 🔄 扩展: FTS5 + helpers
│   ├── schemas/                    # 🔄 改写
│   │   ├── fact.ts                 # ✅ 保留
│   │   ├── evidence.ts             # ✅ 保留
│   │   ├── ranking.ts              # 🆕 Credibility + Importance
│   │   └── index.ts                # 🔄 简化导出
│   └── cli/
│       └── index.ts                # 🔄 简化为 6 个命令
├── tests/
├── docs/
│   ├── constitution.md             # 🆕 设计宪法
│   ├── plan-v6.md                  # 本文件
│   └── ...
├── package.json
├── tsconfig.json
└── README.md
```

---

## 五、数据流图

### 场景 1: Agent 第一次认识项目

```
Agent: "帮我理解这个项目"
  ↓
observe({ project_path: "./my-project" })
  ↓
返回: project info + stats + modules
  ↓
Agent 知道: 项目规模、语言、模块结构
```

### 场景 2: Agent 探索某个功能

```
Agent: "我想理解 Authentication"
  ↓
explore({ query: "authentication" })
  ↓
返回: related facts + evidence + navigation_guide
  ↓
Agent 知道: JWT → Middleware → Permission → User Service → Database
```

### 场景 3: Agent 理解决策历史

```
Agent: "Redis 是什么时候引入的？"
  ↓
trace({ query: "Redis" })
  ↓
返回: timeline with commits + changes
  ↓
Agent 知道: commit abc123 引入，原因是 fix session bottleneck
```

### 场景 4: Agent 验证陈述

```
Agent: "我优化了 Redis 缓存性能"
  ↓
verify({ statement: "优化了 Redis 缓存性能" })
  ↓
返回: verdict + evidence
  ↓
Agent 知道: SUPPORTED, 有 benchmark 证据
```

### 场景 5: Agent 获取项目全貌

```
Agent: "给我这个项目的整体介绍"
  ↓
snapshot({ format: "compact" })
  ↓
返回: architecture + key_facts + navigation_guide
  ↓
Agent 知道: 项目结构、核心模块、探索路径
```

### 场景 6: Agent 生成 PDF

```
Agent: "把这个 JSON 变成 PDF"
  ↓
render({ json_data: "..." })
  ↓
返回: pdf_path
  ↓
Agent 知道: PDF 生成成功
```

---

## 六、实现时间线 (2 周)

### Week 1: 基础层 + 核心工具

```
Day 1-2: 宪法 + 清理
  ├─ 创建 constitution.md
  ├─ 更新 package.json 版本为 6.0.0
  └─ 更新 README.md

Day 3-5: observe() + trace()
  ├─ 实现 src/extractor/ast-parser.ts
  ├─ 实现 src/extractor/fact-builder.ts
  ├─ 实现 src/evidence/git-signal.ts
  ├─ 实现 src/query/trace.ts
  └─ 编写测试

Day 6-7: explore() + ranking
  ├─ 实现 src/query/explore.ts
  ├─ 实现 src/query/ranking.ts
  └─ 编写测试
```

### Week 2: 查询层 + 联调

```
Day 8-9: verify()
  ├─ 实现 src/verify/keyword-extractor.ts
  ├─ 实现 src/verify/confidence.ts
  └─ 实现 src/verify/verdict.ts

Day 10-11: snapshot()
  ├─ 实现 src/snapshot/builder.ts
  ├─ 实现 src/snapshot/compressor.ts
  └─ 实现 src/snapshot/token-estimator.ts

Day 12-14: MCP 联调 + 测试
  ├─ 实现 src/mcp/tools/*.ts
  ├─ Claude Code 调用测试
  └─ 端到端测试
```

---

## 七、与宪法的映射

| 宪法条款 | V6 实现 |
|:---|:---|
| 第一条：唯一目标 | 所有工具都帮助 Agent 理解项目 |
| 第二条：输出可追溯 | 所有输出都关联 Code/Git/Test |
| 第三条：不理解职业 | 没有 match_capabilities、extract_capabilities |
| 第四条：Exploration | explore() 提供导航路径 |
| 第五条：工具回答问题 | 每个工具都有明确的问题 |
| 第六条：不产生职业 Artifact | 没有 render_resume、generate_interview |
| 第七条：Skill 建立在 Lens 上 | Skill 调用 observe/explore/trace/verify |
| 第八条：Ranking 可拆分 | Credibility + Importance 分开 |

---

## 八、关键设计决策

### Decision 1: 拆分 search_evidence 为 explore + trace

- **背景**: V5 的 search_evidence 承担了多种职责
- **决策**: 拆分为 explore()（探索）和 trace()（追踪）
- **原因**: 每个工具应该只回答一个问题

### Decision 2: 删除 Requirement Expansion

- **背景**: V5 自动将 "Redis" 扩展为 ["redis", "ioredis", "cache", ...]
- **决策**: 删除，由 Agent 负责扩展
- **原因**: 这是 Interpretation，Agent 能自己做

### Decision 3: 拆分 Evidence Ranking

- **背景**: V5 的 Score 混合了多个维度
- **决策**: 拆分为 Credibility + Importance
- **原因**: Agent 应该自己决定用哪个维度

### Decision 4: 冻结宪法

- **背景**: V4 → V5 有很多设计变更，需要稳定
- **决策**: 创建 constitution.md，冻结设计原则
- **原因**: 防止后续跑偏
