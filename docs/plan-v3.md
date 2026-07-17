# Project-Lens V3 完整实施方案

> **版本**: 3.0 (合并评估意见版) | **协调者**: MiMoCode | **评估方**: agy + codex
>
> 本方案合并了 plan-v2 的工程基础与 `docs/erge.md` 评估指导意见中的高价值建议，
> 经 agy (宏观架构) 与 codex (工程落地) 联合评估后形成。

---

## 〇、设计目的与目标关联

### 我们要做什么？

Project-Lens 是一个**本地 CLI/MCP 工具链**，目标是让程序员**写完代码后，一键从代码仓库中提取真实技术亮点，自动生成高质量 PDF 简历，并基于真实代码细节开展死磕式模拟面试**。

### 为什么这样设计？

程序员的求职准备长期存在三个痛点：

| 痛点 | 现状 | 我们的解法 |
|:---|:---|:---|
| 简历定制脱离代码实际 | 手动从代码中提炼"技术亮点"，费时费力，文字流于表面 | **Code as Source of Truth** — AST/Git 自动提取事实，LLM 只做润色不做编造 |
| 模拟面试问不到点上 | 市面 AI 面试都是"通用八股文"，不理解你项目的代码细节 | **Decision Trace** — 从 Git commit 序列中提取架构演变链，面试官能死磕"为什么这么设计" |
| 工具链体验碎片化 | 网页端复制粘贴，频繁跨平台切换 | **Zero UI** — CLI + MCP，直接嵌入 IDE/Terminal/Agent 工作流 |

### 这个方案与目标的对应关系

```
核心目标: Code-to-Career 闭环
  │
  ├─→ "写完代码" ──→ lens-analyzer (AST + Git 事实提取)
  │                   ↓
  │              EvidenceNode (结构化证据，不是 Prompt 编造)
  │                   ↓
  ├─→ "提炼亮点" ──→ LLM 增强润色 (codex/claude/ollama)
  │                   ↓
  │              Critic 反馈环 (检查 JD 匹配度 + 亮点覆盖度)
  │                   ↓
  ├─→ "生成简历" ──→ lens-resume-builder (Typst → PDF)
  │
  └─→ "模拟面试" ──→ lens-interview-evaluator
                      ├─ Decision Trace (架构演变链 → 追问链)
                      └─ Rubric 评分 (基于真实代码，不是八股文)
```

### V3 相比 V2 做了什么改进？

`docs/erge.md` 的评估指导意见指出了 V2 的一个核心缺口：

> V2 的设计是 "Facts First, LLM Later"（事实优先，LLM 后置），这非常正确。
> 但 AST/Git 事实直接输出为 `project.json`，中间缺少一个**结构化的证据层**，
> 导致 LLM 需要在 Prompt 中硬编排"Redis → cache.ts → commit xxx → benchmark"的逻辑链，容易产生幻觉。

V3 的改进策略是**最小侵入式**的：

| 改进 | V2 做法 | V3 做法 | 为什么这样改 |
|:---|:---|:---|:---|
| 证据层 | 无，事实直连 LLM | 新增 EvidenceNode Schema，嵌入 project.json | 让每个技术亮点都有可追溯的证据链（文件+commit），而非 LLM 凭空编造 |
| 面试追问 | 基于 Tech Stack 静态匹配 | 新增 Decision Trace，从 Git commit 序列提取设计演变 | 面试官问的是"为什么这么设计"，不是"你用过 Redis 吗" |
| 输出质量 | 生成即终态 | 新增 Critic 反馈环 | 简历生成后自动检查"JD 要求的能力我覆盖了吗？代码中的亮点我写了吗？" |
| 有状态 Agent | 无（且不引入） | 不采纳 | 与核心价值矛盾：求职场景需要确定性（Facts First），不是 Agent 自主探索 |

### 一句话总结

**V3 的设计目的是：在保持 V2 "Facts First, LLM Later" 核心优势的前提下，通过 EvidenceNode Schema + Decision Trace + Critic 反馈环三个增量改进，让系统从"能用"变成"好用且可靠"——每个简历断言都有代码证据支撑，每次面试追问都基于真实架构演变，每次生成都有自动质量检查。**

---

## 一、方案变更摘要

| 变更项 | V2 原方案 | V3 采纳评估意见 | 变更原因 |
|:---|:---|:---|:---|
| EvidenceNode Schema | 无 | **新增** — `highlights[]` 中嵌入 `evidence_node_id` 字段 | agy+codex 共识：证据图是缺失的中间层，Schema 先冻结 |
| Decision Trace | 无 | **新增** — Interview 模块基于 Git commit sequence 提取设计演变 | agy+codex 共识：面试从 Tech Stack 升级到 Decision Trace |
| Critic 反馈环 | 无 | **新增** — Resume 输出后增加一次 JD 匹配度 + 亮点覆盖度检查 | 裁决：Workflow 内受控反馈环，非 Agent 自治 |
| 有状态 Agent System | 无 | **不采纳** | 与核心价值主张"Facts First"矛盾，Workflow 是正确范式 |
| 独立 Evidence 存储 | 无 | **延后到 V3+** | 3-4 人周工作量，V2 阶段以 Schema 预留替代 |
| Career Knowledge Graph | 无 | **延后到 V4** | 需 JD/Gap/LearningPath 三套新 Schema，远期路线图 |

---

## 二、架构总览

### 1.1 分层架构（采纳评估意见的四层模型）

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 3 — 展示层 (Presentation)                             │
│  Resume PDF · Portfolio · Interview · JD Matching            │
├─────────────────────────────────────────────────────────────┤
│  Layer 2 — 推理层 (Reasoning)                                │
│  Planner · Critic · Retriever · Interview Agent              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ V2 新增: Critic 反馈环 (JD 匹配度 + 亮点覆盖度检查)    │  │
│  └───────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  Layer 1 — 证据层 (Evidence) ← V3 远期独立存储               │
│  Evidence Graph · Capability Graph · Architecture Evolution  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ V2 阶段: Schema 定义冻结，数据嵌入 project.json        │  │
│  └───────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  Layer 0 — 事实层 (Facts)                                    │
│  AST 解析 · Git 历史 · Metrics · Tests · Benchmarks         │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 数据流（V2 阶段实际路径）

```
代码仓库
  │
  ├─→ tree-sitter AST 解析 ──→ 技术栈指纹 + 设计模式识别
  ├─→ git log/diff 分析 ────→ 贡献度 + Commit 序列
  └─→ Metrics 分析 ────────→ 复杂度 + 依赖图
          │
          ▼
   Layer 0: Raw Facts JSON
          │
          ▼
   EvidenceNode Schema 映射 (V2: 嵌入 project.json)
          │
          ▼
   LLM 推理 (claude -p / codex exec / ollama)
          │
          ├─→ Resume 亮点提炼
          │       │
          │       ▼
          │   Critic 反馈环 (V2 新增)
          │       │
          │       ▼
          │   最终 resume.json
          │       │
          │       ▼
          │   Typst → PDF
          │
          └─→ Interview Decision Trace 提取 (V2 新增)
                  │
                  ▼
              面试 Rubric + 追问链
```

---

## 三、新增 Schema 设计

### 2.1 EvidenceNode Schema（V2 阶段嵌入 project.json）

```typescript
// src/schemas/evidence-node.ts

import { z } from 'zod';

/**
 * 证据节点类型枚举
 * 每个节点代表一个从代码事实中提取的可验证断言
 */
export const EvidenceNodeType = z.enum([
  'technology',    // 使用了某技术 (Redis, Kafka, PostgreSQL)
  'pattern',       // 应用了某设计模式 (CQRS, DDD, Circuit Breaker)
  'metric',        // 产生了某度量指标 (延迟降低40%, QPS提升3倍)
  'decision',      // 做出了某架构决策 (选择了 Redis 而非 Memcached)
  'tradeoff',      // 进行了某技术权衡 (一致性 vs 可用性)
  'evolution',     // 架构发生了某次演进 (单体 → 微服务)
]);

/**
 * 单个证据节点
 * V2 阶段：嵌入在 project.json 的 highlights[] 中
 * V3 阶段：独立 SQLite-Graph 存储
 */
export const EvidenceNodeSchema = z.object({
  /** 节点唯一标识 — V2 用 content hash，V3 用 UUID */
  node_id: z.string().min(1),

  /** 节点类型 */
  type: EvidenceNodeType,

  /** 技术/模式/指标名称 */
  name: z.string().min(1).max(200),

  /** 自然语言描述 */
  description: z.string().max(500),

  /** 置信度 0-1 */
  confidence: z.number().min(0).max(1),

  /** 支撑此节点的源文件 */
  source_files: z.array(z.string()).min(1),

  /** 关联的 Git commit SHA 列表 */
  commits: z.array(z.string()).optional(),

  /** V3 预留: 关联的边 (source_node_id → type → this node_id) */
  // edges: z.array(EvidenceEdgeSchema).optional(),
});

export type EvidenceNode = z.infer<typeof EvidenceNodeSchema>;

/**
 * Evidence Edge — V3 独立存储时使用
 * V2 阶段仅定义 Schema，不实际使用
 */
export const EvidenceEdgeSchema = z.object({
  source: z.string(),
  target: z.string(),
  type: z.enum([
    'uses_technology',      // Symbol → Technology
    'implements_pattern',   // Symbol → Pattern
    'measured_by',          // Pattern → Metric
    'evolved_from',         // Evolution → Decision
    'evidence_for',         // Pattern/Tech → Capability (V3)
  ]),
  confidence: z.number().min(0).max(1),
});

export type EvidenceEdge = z.infer<typeof EvidenceEdgeSchema>;
```

### 2.2 Decision Trace Schema（V2 新增）

```typescript
// src/schemas/decision-trace.ts

import { z } from 'zod';

/**
 * 架构决策记录 — 从 Git commit sequence 中提取
 * 用于面试模块的追问链生成
 */
export const DecisionTraceSchema = z.object({
  /** 决策标题 */
  title: z.string().max(200),

  /** 决策背景：为什么需要做这个决策 */
  context: z.string().max(500),

  /** 涉及的技术选型 */
  technologies: z.array(z.string()),

  /** 决策过程：从 commit sequence 中提取的演变链 */
  evolution: z.array(z.object({
    /** 时间点 (commit date) */
    timestamp: z.string().datetime(),
    /** commit SHA */
    commit: z.string(),
    /** 变更描述 */
    change: z.string().max(300),
    /** 变更类型 */
    type: z.enum(['introduction', 'refactor', 'optimization', 'removal', 'replacement']),
  })),

  /** 面试追问链：从这个决策衍生的面试问题 */
  followup_chain: z.array(z.object({
    /** 问题文本 */
    question: z.string().max(300),
    /** 问题深度：1=基础 2=进阶 3=架构 */
    depth: z.number().min(1).max(3),
    /** 预期考察点 */
    expects: z.string().max(200),
  })).max(5),
});

export type DecisionTrace = z.infer<typeof DecisionTraceSchema>;
```

### 2.3 Critic 检查 Schema（V2 新增）

```typescript
// src/schemas/critic.ts

import { z } from 'zod';

/**
 * Critic 反馈环的检查结果
 * 在 Resume 亮点生成后、最终输出前执行
 */
export const CriticReportSchema = z.object({
  /** JD 匹配度分析 */
  jd_match: z.object({
    /** 匹配的 JD 关键词 */
    matched: z.array(z.string()),
    /** 未覆盖的 JD 关键词 */
    uncovered: z.array(z.string()),
    /** 匹配度分数 0-1 */
    score: z.number().min(0).max(1),
  }).optional(),

  /** 亮点覆盖度检查 */
  coverage: z.object({
    /** 已覆盖的技术亮点 */
    covered: z.array(z.string()),
    /** 代码中有证据但简历未提及的亮点 */
    missing: z.array(z.object({
      evidence_node_id: z.string(),
      name: z.string(),
      reason: z.string(),
    })),
  }),

  /** 建议操作 */
  actions: z.array(z.object({
    type: z.enum(['add_highlight', 'rewrite_highlight', 'remove_highlight', 'reorder']),
    target: z.string(),
    rationale: z.string().max(300),
  })),
});

export type CriticReport = z.infer<typeof CriticReportSchema>;
```

### 2.4 修改后的 project.json Schema（嵌入 EvidenceNode）

```typescript
// 在现有 ProjectLensSchema 的 highlights[] 中新增字段

const HighlightSchema = z.object({
  title: z.string().max(200),
  description: z.string().max(1000),
  category: z.enum(['performance', 'architecture', 'scale', 'security', 'innovation']),
  evidence: z.object({
    files: z.array(z.string()),
    commits: z.array(z.string()).optional(),
  }),
  confidence: z.number().min(0).max(1),

  // V3 新增: 关联的证据节点 ID 列表
  evidence_node_ids: z.array(z.string()).optional(),
});
```

---

## 四、模块详细设计

### 3.1 `lens-analyzer` — 项目分析引擎

#### 输入/输出

```
输入: 本地项目路径 + 技术栈提示 (可选)
输出: project.json (含 EvidenceNode 嵌入)
```

#### 内部 Pipeline

```
┌──────────────────────────────────────────────────────┐
│  lens-analyzer Pipeline                              │
│                                                      │
│  1. 文件发现 (glob: **/*.{ts,py,go,java})            │
│  2. 文件哈希计算 (SHA-256)                            │
│  3. 增量检测 (与 ~/.lens/cache/file_hashes.db 比对)   │
│  4. 对变更文件:                                       │
│     ├─ tree-sitter AST 解析 → 技术栈 + 设计模式       │
│     ├─ git log/diff → 贡献度 + Commit 序列            │
│     └─ 依赖分析 → 外部库引用                          │
│  5. EvidenceNode 映射 (Raw Facts → 证据节点)          │
│  6. LLM 增强 (可选: codex/claude/ollama)              │
│     └─ 对 EvidenceNode 进行自然语言润色               │
│  7. 输出 project.json                                 │
│  8. 更新缓存 (file_hashes.db)                         │
└──────────────────────────────────────────────────────┘
```

#### 关键实现文件

```
src/
├── analyzer/
│   ├── index.ts                 # lens-analyzer 入口
│   ├── pipeline.ts              # Pipeline 编排
│   ├── file-discovery.ts        # 文件发现 + 哈希
│   ├── ast-parser.ts            # tree-sitter AST 解析
│   ├── git-analyzer.ts          # Git 历史分析
│   ├── metrics-collector.ts     # 依赖/复杂度指标
│   ├── evidence-mapper.ts       # EvidenceNode 映射 (V2 新增)
│   └── llm-enhancer.ts          # LLM 增强 (可选)
```

### 3.2 `lens-interview-evaluator` — 面试评估模块（含 Decision Trace）

#### 输入/输出

```
输入: project.json + 技术栈列表 + 可选 JD
输出: interview.json (含 Decision Trace + Rubric + 追问链)
```

#### Decision Trace 提取逻辑

```
┌──────────────────────────────────────────────────────┐
│  Decision Trace Extractor                            │
│                                                      │
│  1. 从 project.json 获取 evidence_node_ids            │
│  2. 对每个 technology/pattern 节点:                    │
│     ├─ 检索关联的 commits (时间序列)                   │
│     ├─ 按时间排序，识别 introduction → refactor 链     │
│     └─ 生成 evolution[] 数组                          │
│  3. 为每个 Decision 生成 followup_chain:              │
│     ├─ depth 1: "你为什么选择 Redis？"                │
│     ├─ depth 2: "为什么不用 LRU？"                    │
│     └─ depth 3: "如果 10 倍流量，缓存策略怎么重构？"   │
│  4. 输出 interview.json                               │
└──────────────────────────────────────────────────────┘
```

#### 关键实现文件

```
src/
├── interview/
│   ├── index.ts                 # lens-interview-evaluator 入口
│   ├── decision-trace.ts        # Decision Trace 提取器 (V2 新增)
│   ├── rubric-engine.ts         # Rubric 评分引擎
│   ├── question-generator.ts    # 追问链生成
│   └── scoring.ts               # 评分计算
```

### 3.3 Critic 反馈环（V2 新增）

#### 执行时机

在 `lens-resume-builder` 生成 resume.json **之后**、Typst 渲染 **之前**。

#### 检查流程

```
┌──────────────────────────────────────────────────────┐
│  Critic Pipeline                                     │
│                                                      │
│  输入: resume.json + project.json + 可选 JD           │
│                                                      │
│  1. JD 匹配度 (如有 JD):                              │
│     ├─ 提取 JD 关键词                                 │
│     ├─ 与 resume highlights 做语义匹配                │
│     └─ 输出 matched / uncovered                       │
│                                                      │
│  2. 亮点覆盖度:                                       │
│     ├─ 遍历 project.json 的 evidence_node_ids         │
│     ├─ 检查哪些节点在 resume 中有对应 highlight         │
│     └─ 输出 covered / missing                         │
│                                                      │
│  3. 建议生成:                                         │
│     ├─ 对 missing 节点生成 add_highlight 建议          │
│     ├─ 对低置信度节点生成 rewrite 建议                 │
│     └─ 输出 actions[]                                 │
│                                                      │
│  输出: critic-report.json                             │
│                                                      │
│  后续: 用户确认 → 自动应用 actions → 重新生成 PDF      │
└──────────────────────────────────────────────────────┘
```

#### 关键实现文件

```
src/
├── critic/
│   ├── index.ts                 # Critic 入口
│   ├── jd-matcher.ts            # JD 关键词匹配
│   ├── coverage-checker.ts      # 亮点覆盖度检查
│   └── action-generator.ts      # 建议操作生成
```

### 3.4 `lens-resume-builder` — 简历渲染引擎

#### 流程（更新版）

```
resume.json + project.json
        │
        ▼
   Critic 反馈环 (V2 新增)
        │
        ├─ 有 JD 时: 检查匹配度
        └─ 无 JD 时: 仅检查覆盖度
        │
        ▼
   用户确认 Critic 建议 (可选)
        │
        ▼
   应用 actions → 更新 resume.json
        │
        ▼
   Typst 模板渲染
        │
        ├─ resume.pdf
        ├─ resume.html (预览)
        └─ resume.md (纯文本)
```

#### 关键实现文件

```
src/
├── builder/
│   ├── index.ts                 # lens-resume-builder 入口
│   ├── resume-assembler.ts      # resume.json 组装
│   ├── typst-renderer.ts        # Typst 模板渲染
│   └── templates/
│       ├── modern-tech.typ      # 现代技术风格
│       ├── minimal.typ          # 极简风格
│       └── chinese.typ          # 中文专用模板
```

---

## 五、`~/.lens/` 目录结构（更新版）

```
~/.lens/
├── config.json                    # 全局配置
├── cache/
│   ├── file_hashes.db             # 文件哈希与 EvidenceNode 映射 (V2)
│   └── evidence.db                # V3: 独立 Evidence Graph 存储 (预留)
├── snapshots/
│   └── <project-uuid>/
│       ├── metadata.json          # 快照索引表
│       ├── snap_<ts>.json         # 历史 resume.json 快照
│       └── resume_<ts>.pdf        # 历史 PDF 备份
├── templates/
│   ├── modern-tech.typ
│   ├── minimal.typ
│   └── chinese.typ
└── interview/
    └── rubrics/
        ├── redis.json             # Redis 考点库
        ├── kafka.json             # Kafka 考点库
        ├── postgresql.json        # PostgreSQL 考点库
        └── ...
```

---

## 六、降级策略（四层架构增强版）

| 降级级别 | 激活条件 | Layer 0 | Layer 1 | Layer 2 | Layer 3 | 输出质量 |
|:---|:---|:---|:---|:---|:---|:---|
| **Level 1** | claude + codex 均可用 | 完整 | EvidenceNode 映射 | 云端 LLM 推理 + Critic | PDF + Interview | 最佳 |
| **Level 2** | 仅 claude 或 codex | 完整 | EvidenceNode 映射 | 单 Agent 推理 | PDF | 良好 |
| **Level 3** | 无任何本地 Agent | 完整 | EvidenceNode 映射 | 本地 ollama 推理 | PDF | 中等 |
| **Level 4** | 本地 Agent 全失效 | 完整 | EvidenceNode 映射 | 规则引擎 (模板填充) | PDF | 可用 |
| **Level 5** | AST 解析器也出错 | 部分 | 无 | 无 | 仅渲染已有 JSON | 最低 |

### Level 4 规则引擎细节

当无 LLM 可用时，利用 EvidenceNode 的 `type` 和 `confidence` 字段进行模板填充：

```
for each EvidenceNode where confidence > 0.7:
  template += render_highlight(node.name, node.description, node.type)

output = apply_template(resume.typ, template)
```

---

## 七、安全防线（增强版）

### 6.1 原有防护（保持不变）

- 数据-指令严格隔离（XML 容器 + System Prompt 声明）
- 输入预净化（敏感词静态过滤）
- Zod Schema 输出强校验
- 子进程权限隔离（`shell: false`、环境变量剥离、资源限制）

### 6.2 新增防护（评估意见建议）

| 风险 | 级别 | 防护措施 |
|:---|:---|:---|
| 企业源码 PII 泄露 | P0 | **PII Sanitizer**: 在 Layer 0 生成 Raw Facts 后，对 IP、Email、密钥、敏感业务代号进行脱敏；发送给云端 LLM 前对类名/方法名进行单向 Hash（`OrderService` → `Service_A`），生成后本地还原 |
| AST 投毒 / Prompt 注入 | P1 | **类型强校验**: 严格限制 AST 提取的数据类型，过滤非结构化注释；**MCP 沙箱**: 系统命令白名单限制，LLM 输出不直接拼接执行 |
| 本地缓存篡改 | P2 | **图签名机制**: 基于文件哈希 + 本地密钥生成 EvidenceNode 签名；**目录权限**: `~/.lens/` 限制为当前 OS 用户 |

---

## 八、LocalAgentBridge 工程设计（保持 V2 不变）

### JSON 自修复 Pipeline

1. **直接解析**: `JSON.parse(raw)` + Zod 校验
2. **提取 JSON 块**: 正则匹配 ` ```json ... ``` ` 或 `{ ... }`
3. **常见修复**: 尾随逗号、单引号→双引号、无引号 key
4. **LLM 自修复**: 将损坏 JSON 发回 Agent 请求修正（最多 2 次）

### 超时控制

| 类型 | 超时 | 处理 |
|:---|:---|:---|
| 软超时 | 30s | 发送 SIGTERM，等待优雅退出 |
| 硬超时 | 60s | 发送 SIGKILL，强制终止 |
| 流式超时 | 10s 无新输出 | 中断并返回已收集内容 |

### 降级链

`codex → claude → ollama → 本地 AST 静态分析`

---

## 九、MCP 工具注册

### 8.1 工具清单

| MCP Tool 名称 | 功能 | 对应 CLI 命令 |
|:---|:---|:---|
| `lens_analyze` | 分析项目，生成 project.json | `lens analyze --path .` |
| `lens_build` | 从 resume.json 生成 PDF | `lens build --input resume.json` |
| `lens_interview` | 获取面试考点 + Decision Trace | `lens interview get --tech redis,fastapi` |
| `lens_validate` | 校验 resume.json 格式 | `lens validate resume.json` |
| `lens_snapshot` | 快照管理 | `lens snapshot list/diff/restore` |

### 8.2 MCP Server 实现

```
src/
├── mcp/
│   ├── server.ts                 # MCP Server 入口 (Stdio 传输)
│   ├── tools/
│   │   ├── analyze.ts            # lens_analyze tool
│   │   ├── build.ts              # lens_build tool
│   │   ├── interview.ts          # lens_interview tool
│   │   ├── validate.ts           # lens_validate tool
│   │   └── snapshot.ts           # lens_snapshot tool
│   └── schema.ts                 # MCP tool JSON Schema 定义
```

---

## 十、具体实施路径（12 周 + 远期路线图）

### Phase 1: 数据层 + CLI 骨架（第 1-2 周）

| 周次 | 任务 | 产出文件 | 验收标准 |
|:---|:---|:---|:---|
| W1 | Resume / Project Zod Schema 定义 | `src/schemas/resume.ts`, `project.ts`, `evidence-node.ts`, `decision-trace.ts`, `critic.ts` | `lens validate resume.json` 100% 字段类型检测 |
| W1 | EvidenceNode Schema 冻结 (V2 新增) | `src/schemas/evidence-node.ts` | Schema 定义完成，单元测试通过 |
| W2 | CLI + MCP 双模式骨架 | `src/cli/index.ts`, `src/mcp/server.ts` | `lens build` / `lens --mcp` 可运行，MCP 被 Claude Code 识别 |

### Phase 2: 核心分析引擎（第 3-6 周）

| 周次 | 任务 | 产出文件 | 验收标准 |
|:---|:---|:---|:---|
| W3 | Git 历史分析器 | `src/analyzer/git-analyzer.ts` | 对 10 个开源项目运行，输出结构化 JSON |
| W4 | AST 静态分析器 (tree-sitter) | `src/analyzer/ast-parser.ts` | 单项目分析 < 5s，设计模式识别 ≥ 80% |
| W5 | LocalAgentBridge v1 | `src/bridge/index.ts`, `json-repair.ts`, `timeout.ts` | 故意损坏 JSON 修复成功率 ≥ 95% |
| W6 | EvidenceNode 映射器 (V2 新增) | `src/analyzer/evidence-mapper.ts` | Raw Facts → EvidenceNode 转换通过测试 |

### Phase 3: 渲染层（第 7-9 周）

| 周次 | 任务 | 产出文件 | 验收标准 |
|:---|:---|:---|:---|
| W7 | Typst 模板引擎 (3 套模板) | `src/builder/templates/*.typ` | 中文/英文排版无溢出、无乱码 |
| W8 | PDF 编译集成 | `src/builder/typst-renderer.ts` | 单页 PDF 生成 < 3s |
| W9 | Critic 反馈环 (V2 新增) | `src/critic/index.ts`, `jd-matcher.ts`, `coverage-checker.ts` | JD 匹配度 + 亮点覆盖度检查通过测试 |

### Phase 4: 增强层 + 生态对接（第 10-12 周）

| 周次 | 任务 | 产出文件 | 验收标准 |
|:---|:---|:---|:---|
| W10 | 多 Agent 适配 (codex / ollama) | `src/bridge/adapters/*.ts` | 三种 Agent 均可完成亮点提炼 |
| W11 | 面试评估模块 + Decision Trace | `src/interview/decision-trace.ts`, `rubric-engine.ts` | Decision Trace 提取 + Rubric 评分相关性 ≥ 0.7 |
| W12 | 发布准备 | npm 包 + 文档 + 示例项目 | 新用户 5 分钟内完成首次 PDF 生成 |

### 验收标准总表

| Phase | 核心验收指标 | 量化标准 |
|:---|:---|:---|
| P1 | Schema 校验准确率 | 100% 字段类型检测 |
| P1 | MCP 工具注册成功率 | Claude Code 100% 识别 |
| P1 | EvidenceNode Schema 冻结 | 单元测试 100% 通过 |
| P2 | AST 分析准确率 | 设计模式识别 ≥ 80% |
| P2 | JSON 修复成功率 | ≥ 95% |
| P2 | EvidenceNode 映射准确率 | Raw Facts → Node 转换 ≥ 90% |
| P3 | PDF 生成成功率 | ≥ 99% |
| P3 | 中文排版正确率 | 无溢出、无乱码 |
| P3 | Critic 反馈环 | JD 匹配度 + 覆盖度检查 100% 执行 |
| P4 | 多 Agent 兼容率 | ≥ 3 种 Agent 可用 |
| P4 | Decision Trace 提取 | 从 Git commit sequence 中提取 ≥ 80% 的设计演变 |
| P4 | 新用户上手时间 | ≤ 5 分钟 |

---

## 十一、远期路线图（V3+ / V4）

### V3 — Evidence Graph 独立存储（12 周后启动）

```
目标: 将 EvidenceNode 从 project.json 嵌入结构升级为独立 SQLite-Graph 存储

关键交付:
├── ~/.lens/cache/evidence.db (SQLite: nodes 表 + edges 表)
├── Evidence Graph Builder (图构建器)
├── Incremental Updater (基于 file watch 的局部重算)
├── Query API ("给定 Capability X, 返回所有 Evidence Node")
└── 缓存从 file_hash 迁移到 node_id + content_hash

工作量估算: 3-4 人周
```

### V4 — Career Knowledge Graph（V3 完成后启动）

```
目标: Code → Evidence → Capability → Resume → JD → Gap → Learning → Interview → Offer

关键交付:
├── JD Schema (解析招聘网站 JD)
├── Capability Schema (候选人能力画像)
├── Gap Analysis (Capability vs JD Requirement 的差分)
├── Learning Path (基于 Gap 的学习建议)
└── Offer Analysis (谈判策略建议)

工作量估算: 4-6 人周
```

---

## 十二、项目目录结构

```
project-lens/
├── src/
│   ├── schemas/                  # Zod Schema 定义
│   │   ├── resume.ts
│   │   ├── project.ts
│   │   ├── evidence-node.ts      # V2 新增
│   │   ├── decision-trace.ts     # V2 新增
│   │   └── critic.ts             # V2 新增
│   ├── analyzer/                 # Layer 0: 事实层
│   │   ├── index.ts
│   │   ├── pipeline.ts
│   │   ├── file-discovery.ts
│   │   ├── ast-parser.ts
│   │   ├── git-analyzer.ts
│   │   ├── metrics-collector.ts
│   │   └── evidence-mapper.ts    # V2 新增: EvidenceNode 映射
│   ├── bridge/                   # LocalAgentBridge
│   │   ├── index.ts
│   │   ├── json-repair.ts
│   │   ├── timeout.ts
│   │   └── adapters/
│   │       ├── claude.ts
│   │       ├── codex.ts
│   │       └── ollama.ts
│   ├── builder/                  # Layer 3: 展示层
│   │   ├── index.ts
│   │   ├── resume-assembler.ts
│   │   ├── typst-renderer.ts
│   │   └── templates/
│   ├── interview/                # 面试评估
│   │   ├── index.ts
│   │   ├── decision-trace.ts     # V2 新增
│   │   ├── rubric-engine.ts
│   │   ├── question-generator.ts
│   │   └── scoring.ts
│   ├── critic/                   # V2 新增: Critic 反馈环
│   │   ├── index.ts
│   │   ├── jd-matcher.ts
│   │   ├── coverage-checker.ts
│   │   └── action-generator.ts
│   ├── mcp/                      # MCP Server
│   │   ├── server.ts
│   │   ├── tools/
│   │   └── schema.ts
│   └── cli/                      # CLI 入口
│       └── index.ts
├── tests/
│   ├── schemas/
│   ├── analyzer/
│   ├── bridge/
│   ├── builder/
│   ├── interview/
│   └── critic/
├── docs/
│   ├── plan-v2.md
│   ├── plan-v3.md               # 本文档
│   └── erge.md
├── package.json
├── tsconfig.json
└── README.md
```

---

## 十三、依赖清单

```json
{
  "dependencies": {
    "zod": "^3.23",
    "tree-sitter": "^0.22",
    "tree-sitter-typescript": "^0.23",
    "tree-sitter-python": "^0.23",
    "tree-sitter-go": "^0.23",
    "effect": "^2.5",
    "commander": "^12.0",
    "chalk": "^5.3"
  },
  "devDependencies": {
    "typescript": "^5.5",
    "vitest": "^2.0",
    "@types/node": "^22.0"
  },
  "optionalDependencies": {
    "typst": "^0.12"
  }
}
```
