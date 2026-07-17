---
name: tri-collab
description: Three-way agent collaboration protocol — MiMoCode as top-level orchestrator, agy (Antigravity/Gemini) as macro-planner & defensive architect, codex (LongCat-2.0) as engineering rigor & implementation enforcer. Use when the user asks to coordinate multiple AI agents on a task, run a multi-agent review, or orchestrate agy + codex together. Triggers on keywords: 'multi-agent', '三方协作', 'collaborate with agy and codex', 'coordinate agents', 'tri-collab'.
---

# Tri-Collab: MiMoCode × agy × codex 三方协作协议

## 角色定义

```
┌─────────────────────────────────────────────────┐
│          MiMoCode (你) — 顶层协调者              │
│   职责: 任务拆解 / 调度编排 / 结果聚合 / 用户交互  │
│   权限: 全部工具 / 代理环境管理 / 重试与降级       │
└──────────────────────┬──────────────────────────┘
                       │ 调度
          ┌────────────┴────────────┐
          ▼                         ▼
┌───────────────────┐    ┌───────────────────┐
│  agy (Gemini)     │    │  codex (LongCat)  │
│  宏观规划者        │    │  工程执行者        │
│  职责:            │    │  职责:            │
│  - 系统蓝图设计    │    │  - 逻辑严密性校验  │
│  - 安全威胁建模    │    │  - 工程落地约束    │
│  - 降级策略制定    │    │  - 输出质量控制    │
│  - 状态管理方案    │    │  - 代码级审查      │
│  自荐角色:        │    │  自荐角色:        │
│  Orchestrator &   │    │  Tech Lead &      │
│  Principal Arch   │    │  Core Developer   │
└───────────────────┘    └───────────────────┘
```

## 各 Agent 特征画像

### agy (Gemini Antigravity) — 宏观防御性规划者

- **思维模式**: 自顶向下、系统性、偏产品思维
- **强项**: 全局视野、安全威胁建模(Prompt Injection)、降级策略粒度细(4级)、状态管理技术方案(lowdb/SQLite)、多Agent调度框架
- **弱项**: 偏重架构设计，对具体实现细节着墨较少；倾向于"提出框架"而非"写出代码"
- **输出风格**: 结构化报告 + Mermaid 流程图 + 风险矩阵(P0-P2)
- **调用方式** (必须设置代理):
  ```powershell
  $env:http_proxy = "http://127.0.0.1:10808"
  $env:https_proxy = "http://127.0.0.1:10808"
  $null | agy -p "你的指令"
  ```

### codex (LongCat-2.0) — 务实的工程批判者

- **思维模式**: 自底向上、实证主义、偏工程思维
- **强项**: 逻辑严密性(发现隐私声称矛盾)、工程落地细节、产品逻辑自洽性校验、降级架构简洁性(核心层+增强层)、"能力假设"的批判性
- **弱项**: 对安全层面(Prompt注入)未涉及；状态管理建议不如agy具体
- **输出风格**: 分层评估 + 风险表格 + 具体改进建议
- **调用方式**:
  ```powershell
  $null | codex exec "你的指令" --skip-git-repo-check
  ```

## 协作流程

### Phase 0: MiMoCode 接收任务，拆解为子任务

MiMoCode 作为协调者，将用户请求拆解为可并行/串行的子任务，决定哪些交给 agy、哪些交给 codex。

### Phase 1: 并行派发

同时向 agy 和 codex 派发各自擅长的任务：

| 任务类型 | 派发给 | 原因 |
|:---|:---|:---|
| 系统架构设计/蓝图 | agy | 自顶向下全局视野 |
| 安全威胁分析 | agy | 唯一关注 Prompt Injection 的 Agent |
| 降级/退化策略 | agy + codex | agy 粒度细，codex 更简洁务实 |
| 代码级审查/逻辑校验 | codex | 逻辑严密性最强 |
| 输出 Schema 设计 | codex | 工程严谨性最高 |
| 状态管理方案 | agy | 技术方案更具体(lowdb/SQLite) |
| 简历文字润色 | agy | 宏观叙事能力强 |
| 代码亮点提炼 | codex | 工程导向的技术总结 |

### Phase 2: 结果聚合

MiMoCode 收集两方输出后：
1. 合并共识点（两者都认同的改进方向优先级最高）
2. 标记分歧点（需要 MiMoCode 做最终裁决）
3. 消除重复内容
4. 生成统一的评估报告或实施方案

### Phase 3: 裁决与交付

对于 agy 和 codex 的分歧，MiMoCode 根据以下原则裁决：
- 涉及安全/稳定性 → 优先采纳 agy 的防御性方案
- 涉及工程可执行性 → 优先采纳 codex 的简洁方案
- 涉及产品体验 → 综合两者，取更用户友好的方案

## 调用模板

### 场景 A: 多 Agent 评审

```
# Step 1: MiMoCode 拆解任务
# Step 2: 并行调用
$env:http_proxy = "http://127.0.0.1:10808"
$env:https_proxy = "http://127.0.0.1:10808"
$null | agy -p "请从系统架构、安全风险、降级策略三个维度评估以下方案：<方案内容>"

$null | codex exec "请从工程落地、逻辑严密性、输出质量控制三个维度评估以下方案：<方案内容>" --skip-git-repo-check

# Step 3: MiMoCode 聚合两方输出，生成统一报告
```

### 场景 B: 设计决策讨论

```
# Step 1: 先让 agy 画蓝图
$env:http_proxy = "http://127.0.0.1:10808"
$env:https_proxy = "http://127.0.0.1:10808"
$null | agy -p "请为以下需求设计系统架构蓝图，包含组件划分、数据流、降级路径：<需求>"

# Step 2: 再让 codex 做工程校验
$null | codex exec "请审查以下架构设计，识别工程落地风险、逻辑矛盾、过度设计：<agy的蓝图输出>" --skip-git-repo-check

# Step 3: MiMoCode 综合裁决
```

### 场景 C: 代码实现协作

```
# agy 负责: 宏观架构 + 安全设计
$env:http_proxy = "http://127.0.0.1:10808"
$env:https_proxy = "http://127.0.0.1:10808"
$null | agy -p "请为 LocalAgentBridge 设计防御性架构，包含超时控制、输出校验、错误恢复、Prompt注入防护"

# codex 负责: 具体实现 + 代码审查
$null | codex exec "请审查以下 TypeScript 实现，检查类型安全、错误处理边界、性能问题：<代码片段>" --skip-git-repo-check
```

## 代理环境管理

每次调用 agy 前**必须**设置代理环境变量，因为子进程不会继承上一次设置：

```powershell
$env:http_proxy = "http://127.0.0.1:10808"
$env:https_proxy = "http://127.0.0.1:10808"
```

调用 codex 不需要代理设置。

## 错误处理与降级

| 场景 | 处理方式 |
|:---|:---|
| agy 超时 | 降级到 codex 执行同任务，或 MiMoCode 自行处理 |
| codex 超时 | 降级到 agy 执行同任务，或 MiMoCode 自行处理 |
| 两者都超时 | MiMoCode 直接处理，记录失败任务 |
| 输出格式异常 | MiMoCode 做 JSON 清洗（剥离 Markdown fences）后重新解析 |

## 共识点（两者都认同的改进方向）

以下是 agy 和 codex 在评估中达成的共识，可作为后续实施的优先级参考：

1. **降级/退化机制**是第一优先级改进
2. **LocalAgentBridge** 是最复杂的核心模块
3. **LLM 输出**需要严格的 Schema 校验
4. **Typst** 是正确的 PDF 渲染选型
5. **无状态设计**是重大缺陷，需引入 `~/.lens/` 持久化

## 分歧点（需裁决）

| 分歧 | agy 观点 | codex 观点 | 建议裁决 |
|:---|:---|:---|:---|
| 降级粒度 | 4级细分(完美/退化A/退化B/最低) | 2层简洁(核心层+增强层) | 采用 codex 的2层架构，但保留 agy 的探活机制 |
| 自荐角色 | Orchestrator & Principal Architect | Tech Lead & Core Developer | 按实际擅长分配：agy管蓝图，codex管实现 |
| 安全防护 | 详细(Prompt注入+权限隔离) | 未涉及 | 采纳 agy 的安全方案 |
| 状态管理 | lowdb/SQLite + 文件哈希缓存 | 仅指出缺失 | 采纳 agy 的具体方案 |
