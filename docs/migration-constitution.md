# Reference Migration Constitution v1.0

> **本文档优先级高于任何参考项目分析。**
> 所有从开源项目借鉴的内容，必须先通过本宪法检验，否则一律拒绝。

---

## 核心立场

> **Project-Lens 只借鉴别人的"能力实现方式"，绝不借鉴别人的"产品定义方式"。**

---

## 六条宪法

### 第一条：迁移的是机制，不是功能

**原则**：借鉴底层 primitive，不借鉴上层 product。

**示例**：
- ✅ 从 codebase-memory-mcp 借鉴：tree-sitter 解析、SQLite 图谱存储、Fact/Edge 数据模型
- ❌ 从 codebase-memory-mcp 借鉴："它有 Query Tool，我也做 Query Tool"

**检验方法**：如果借鉴的内容可以被描述为"它有 X 功能，我也做 X 功能"，那就是功能迁移，必须拒绝。只有能被描述为"它用 X 机制实现 Y，我的 Y 也可以用 X"，才是机制迁移。

---

### 第二条：迁移 Implementation，不迁移 Interpretation

**原则**：只拿信号提取，不拿信号解释。

**示例**：
- ✅ 从 GitIQ 借鉴：commit → diff → signal extraction（提交 → 差异 → 信号提取）
- ❌ 从 GitIQ 借鉴：commit → architecture evolution → developer skill（提交 → 架构演进 → 开发者技能）

**原因**：Developer Skill 属于 Career Knowledge，不是 Project Knowledge。Project Lens 只维护 Project Knowledge。

**检验方法**：如果借鉴的内容涉及"这个代码代表什么能力"、"这个开发者擅长什么"，那就是 Interpretation，必须拒绝。只有涉及"从原始数据中提取结构化事实"，才是 Implementation。

---

### 第三条：任何参考项目都必须映射到 Constitution

**原则**：每个借鉴项必须明确对应宪法条款，无法映射的直接删除。

**格式**：

| 参考项目 | 迁移什么机制 | 对应宪法条款 | 对应 Lens 模块 |
|:---|:---|:---|:---|
| codebase-memory | Fact Graph + SQLite | 第一条 | extractor/ |
| CocoIndex | AST Chunk | 第一条 | extractor/ |
| GitIQ | Git Signal | 第二条 | evidence/ |
| LiSSA | Trace Recovery | 第二条 | verify/ |

**检验方法**：如果一个参考项目的某个能力无法映射到宪法条款，那这个能力不属于 Lens。

---

### 第四条：不迁移 Workflow，只迁移 Primitive

**原则**：借鉴零件，不借鉴流水线。

**示例**：
- ✅ 从 codebase-memory-mcp 借鉴：Fact、Edge、Graph、Search primitive
- ❌ 从 codebase-memory-mcp 借鉴：Query → Cypher → LLM → Answer 整个 workflow

**原因**：Workflow 决定了产品形态。如果借鉴 workflow，产品会越来越像别人。

**检验方法**：如果借鉴的内容包含"用户输入 → 处理步骤1 → 处理步骤2 → 输出"的完整流程，那就是 Workflow，必须拒绝。只有单个可独立复用的组件（数据结构、算法、协议），才是 Primitive。

---

### 第五条：任何迁移都必须回答——如果删掉，它还能工作吗？

**原则**：只有删掉会导致系统废掉的，才是核心迁移。

**示例**：
- 删掉 Fact Graph → 整个 Lens 废掉 → ✅ 核心
- 删掉 Requirement Expansion → Lens 仍能帮助 Agent 理解项目 → ❌ 非核心
- 删掉 AST 解析 → 无法提取 Fact → ✅ 核心
- 删掉 Capability Extraction → Lens 仍能工作 → ❌ 非核心

**检验方法**：对每个借鉴项做"删除测试"。如果删掉后 Lens 的核心能力（帮助 Agent 理解项目）不受影响，那它不应该在 Lens 层。

---

### 第六条：参考项目只能影响 Implementation，不能影响 Product Boundary

**原则**：产品边界只能来自 Constitution，绝不能来自参考项目。

**示例**：
- Kognit 的产品定位是 Developer Biography → 如果跟着它迁移，Lens 会变成职业助手
- GitIQ 的产品定位是 Developer Skill Analysis → 如果跟着它迁移，Lens 会变成能力评估工具
- LiSSA 的产品定位是 Requirements Traceability → 如果跟着它迁移，Lens 会变成需求管理工具

**原因**：每个开源项目都有自己的产品定位。跟着它迁移，就是把它的产品边界强加给 Lens。

**检验方法**：如果借鉴的内容会让 Lens 的核心定位从 "Project Understanding Engine" 漂移成其他东西，必须拒绝。

---

## 评分标准

对每个参考项目，打四个分：

| 维度 | 问题 | 权重 |
|:---|:---|:---|
| **Mechanism Fit** | 有没有我需要的底层机制？ | 高 |
| **Constitution Fit** | 会不会破坏 Project Knowledge 边界？ | **最高** |
| **Engineering Reuse** | 能复用多少实现？ | 中 |
| **Product Pollution** | 会不会把产品定位带偏？ | **否决权** |

**关键规则**：Product Pollution ≥ 3 的项目，一票否决。

---

## 已冻结的 Lens 边界

以下能力属于 Lens，以下能力不属于 Lens：

### 属于 Lens（Project Knowledge）

| 能力 | 说明 |
|:---|:---|
| AST 解析 → Fact 提取 | 代码 → 结构化事实 |
| Edge 构建 | Fact 之间的关系 |
| SQLite 图谱存储 | 持久化 Project Knowledge |
| Evidence 绑定 | Fact ↔ Git/Test/Doc |
| Decision Trace | 变更历史 → 决策链 |
| FTS 搜索 | 全文检索 |
| Credibility/Importance 评分 | 可信度 + 重要度（分开） |
| Snapshot 导出 | 项目知识包 |
| 断言验证 | 陈述 → 证据 |

### 不属于 Lens（属于 Agent 或 Skill）

| 能力 | 归属 | 原因 |
|:---|:---|:---|
| Requirement Expansion | Agent | Interpretation |
| Capability Extraction | Agent | Interpretation |
| Developer Skill 分析 | Agent | Career Knowledge |
| JD 匹配 | Skill | 职业判断 |
| 简历生成 | Skill | 职业 Artifact |
| 面试模拟 | Skill | 职业 Artifact |
| Career Plan | Skill | 职业 Artifact |

---

## 附录：宪法检验清单

在设计新模块或引入新参考时，逐项检查：

### 必须通过（否则拒绝）

| # | 检验问题 | 预期答案 |
|:---|:---|:---|
| 1 | 是否迁移机制而非功能？ | Yes |
| 2 | 是否迁移 Implementation 而非 Interpretation？ | Yes |
| 3 | 是否能映射到宪法条款？ | Yes |
| 4 | 是否迁移 Primitive 而非 Workflow？ | Yes |
| 5 | 删掉后 Lens 核心能力是否受损？ | Yes（必须受损） |
| 6 | 是否影响 Product Boundary？ | No（必须不影响） |

### 建议通过（否则讨论）

| # | 检验问题 | 预期答案 |
|:---|:---|:---|
| 7 | Mechanism Fit ≥ 3？ | Yes |
| 8 | Constitution Fit ≥ 4？ | Yes |
| 9 | Engineering Reuse ≥ 3？ | Yes |
| 10 | Product Pollution ≤ 2？ | Yes |
