# Project-Lens 参考项目分析

> 基于 `docs/advise.md` 报告中提到的开源项目，按 plan-v4-final 的需求进行相关性评估。
>
> **迁移宪法检验**：所有借鉴项已通过 `migration-constitution.md` 六条宪法检验。

---

## 一、与 Constitution 的需求映射

> **原则：迁移机制，不迁移功能。迁移 Implementation，不迁移 Interpretation。**

| 迁移什么 Primitive | 对应 Constitution 条款 | 对应参考项目 | 对应 Lens 模块 |
|:---|:---|:---|:---|
| AST → Fact → Edge | 第一条（机制） | codebase-memory-mcp, CocoIndex | extractor/ |
| SQLite 图谱存储 | 第一条（机制） | codebase-memory-mcp | store.ts |
| MCP Server | 第一条（机制） | codebase-memory-mcp, GitHub MCP | mcp/ |
| FTS + Hybrid Search | 第一条（机制） | codebase-memory-mcp, CodeRAG | query/ |
| Git Signal → Evidence | 第二条（Implementation） | GitIQ | evidence/ |
| Trace Recovery | 第二条（Implementation） | LiSSA | verify/ |
| ~~JD/简历结构化解析~~ | ~~不属于 Lens~~ | ~~BAML 生态~~ | **拒绝** |
| ~~开发者能力图谱~~ | ~~Interpretation~~ | ~~Kognit, GitIQ~~ | **拒绝** |

---

## 二、高相关项目（直接参考）

### 1. codebase-memory-mcp ⭐⭐⭐⭐⭐

**GitHub**: https://github.com/DeusData/codebase-memory-mcp

**与 plan-v4 的关系**：这是**最直接的参考项目**，几乎覆盖了 plan-v4 的 Layer 0 + Layer 1 + MCP Server 的核心架构。

**核心机制**：
- 用 tree-sitter 将代码库解析为 SQLite 知识图谱
- 记录函数、类、调用链、HTTP 路由
- 内嵌 Hybrid LSP 做深度语义类型解析
- 生成 CALLS、USAGE、RESOLVED_CALLS 图谱边
- 利用 MCP 协议让 LLM 做"自然语言→Cypher 查询"的翻译器

**关键数据**：
- 传统逐文件探索：~412,000 tokens
- 知识图谱查询：~3,400 tokens（缩减 99.2%）
- 亚毫秒级查询，83%+ 准确率

**对 plan-v4 的启发**：
- **SQLite 知识图谱存储方案**：直接参考其 `facts` + `fact_edges` 表设计
- **tree-sitter 查询规则**：参考其多语言 .scm 规则文件
- **MCP Tool 设计**：参考其 search/query 工具的输入输出 Schema
- **增量更新策略**：参考其文件哈希 + 增量解析机制

**可直接复用的代码**：
- tree-sitter 解析器封装
- SQLite 图谱表结构
- MCP Server 骨架

---

### 2. CocoIndex ⭐⭐⭐⭐

**GitHub**: https://github.com/cocoindex-io/cocoindex-code

**与 plan-v4 的关系**：轻量级 AST 代码搜索引擎，与 plan-v4 的 `search_evidence` 能力高度相关。

**核心机制**：
- 基于 AST 的代码分块（不是字符级分块）
- 保持函数边界、类层级结构
- 支持多语言

**对 plan-v4 的启发**：
- **AST-aware 分块策略**：代码搜索时按函数/类边界分块，而非按行数
- **索引结构设计**：如何将 AST 节点映射为可搜索的索引条目

---

### 3. Kognit ⭐⭐⭐⭐

**GitHub**: https://github.com/Pomilon/Kognit

**与 plan-v4 的关系**：AI 驱动的技术传记生成器，支持多智能体对仓库进行深度反向工程。与 `extract_capabilities` 和 `export_context` 能力直接相关。

**核心机制**：
- 多智能体架构对仓库进行深度分析
- 生成开发者技术传记
- 从代码中提取能力画像

**对 plan-v4 的启发**：
- **Capability Extraction 的映射规则**：哪些代码模式对应哪些能力标签
- **多维度画像**：从不同角度（技术栈、架构模式、贡献度）分析项目
- **输出格式**：技术传记的结构化表示

---

### 4. GitIQ ⭐⭐⭐

**GitHub**: https://github.com/naman-kalwani/GitIQ

**与 plan-v4 的关系**：基于 LLM 的轻量级仓库级信号提取工具。与 `get_decision_trace` 和 Evidence 提取相关。

**核心机制**：
- 从 Git 历史中提取信号
- 仓库级的分析粒度
- 轻量级设计

**对 plan-v4 的启发**：
- **Git 信号提取**：如何从 commit message + diff 中提取有意义的工程信号
- **Decision Trace 构建**：如何将 commit 序列组织为架构决策链

---

## 三、中等相关项目（选择性参考）

### 5. LiSSA ⭐⭐⭐

**GitHub**: https://github.com/ardoco/lissa

**与 plan-v4 的关系**：基于 RAG 的通用可追溯性链路恢复框架。与 `verify_statement` 的溯源能力相关。

**核心机制**：
- 需求到代码的追溯链路恢复
- 基于 RAG 的检索增强

**对 plan-v4 的启发**：
- **Statement Verification 的溯源逻辑**：如何从一句话追溯到具体的代码证据
- **置信度计算**：如何评估一个断言被代码支撑的程度

---

### 6. BAML 生态 ⭐⭐⭐

**GitHub**: https://github.com/BoundaryML/baml-db-query

**与 plan-v4 的关系**：结构化提取 DSL，与 `parse_jd` 的 JD 结构化解析相关。

**核心机制**：
- 领域特定语言（DSL）驱动的结构化提取
- 防错解析机制

**对 plan-v4 的启发**：
- **JD Parser 的 NER 规则**：如何从非结构化 JD 文本中提取结构化 requirements
- **Schema 驱动的提取**：用 Zod Schema 约束 LLM 的输出格式

---

### 7. LinkAnchor ⭐⭐

**GitHub**: https://github.com/ISE-Research/LinkAnchor

**与 plan-v4 的关系**：Issue 到 Commit 的链路恢复。与 Decision Trace 的 `related_issue` 字段相关。

**对 plan-v4 的启发**：
- 如何将 commit 与 issue/PR 关联
- 如何从 commit message 中提取 issue 编号

---

### 8. CodeRAG ⭐⭐

**GitHub**: https://github.com/Neverdecel/CodeRAG

**与 plan-v4 的关系**：代码 RAG 方案，与 search_evidence 的检索策略相关。

**对 plan-v4 的启发**：
- 代码检索的分块策略
- 语义搜索 vs 关键词搜索的混合方案

---

## 四、低相关项目（仅了解）

### 9. GitHub MCP Server ⭐

**GitHub**: https://github.com/github/github-mcp-server

**关系**：GitHub 官方 MCP Server，主要提供 GitHub API 能力（Issue、PR、Repo 等）。与 plan-v4 的核心能力不直接相关，但可以参考其 MCP Server 的实现模式。

### 10. codebase-mcp ⭐

**GitHub**: https://github.com/DeDeveloper23/codebase-mcp

**关系**：GitMCP 的相关实现，功能与 codebase-memory-mcp 类似但更简单。可作为轻量级参考。

### 11. NLPL-TLR ⭐

**GitHub**: https://github.com/ZZYG0g0g0/NLPL-TLR

**关系**：学术研究项目，结合辅助策略信号的代码溯源方案。偏学术，工程落地参考价值有限。

### 12. Web3Insight ⭐

**GitHub**: https://github.com/web3insight-ai/web3insight

**关系**：结合开源贡献数据建立开发者档案。偏 Web3 领域，与 plan-v4 的通用定位不完全匹配。

### 13. BAML-Claude-Skill ⭐

**GitHub**: https://github.com/FryrAI/BAML-Claude-Skill

**关系**：Claude 智能体自动生成 BAML 提取代码的实现。可参考其 Prompt 设计。

---

## 五、宪法评分（基于 migration-constitution.md）

| 项目 | Mechanism | Constitution | Reuse | Pollution | 宪法裁决 |
|:---|:---|:---|:---|:---|:---|
| **codebase-memory-mcp** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐ | ✅ **核心参考** |
| **CocoIndex** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐ | ✅ 重点参考 |
| **GitIQ** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ✅ 重点参考 |
| **LiSSA** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐ | ✅ 选择性参考 |
| **CodeRAG** | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐ | ✅ 了解即可 |
| **GitHub MCP** | ⭐ | ⭐⭐⭐⭐⭐ | ⭐ | ⭐ | ✅ 了解即可 |
| **Kognit** | ⭐⭐ | ⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ❌ **一票否决** |
| **BAML 生态** | ⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ❌ 整体拒绝 |
| **LinkAnchor** | ⭐⭐ | ⭐⭐⭐⭐ | ⭐ | ⭐ | ❌ 功能重叠 |
| **Web3Insight** | ⭐ | ⭐⭐ | ⭐ | ⭐⭐⭐⭐ | ❌ 领域不匹配 |

**关键发现**：Kognit 的 Product Pollution 极高（⭐⭐⭐⭐⭐），不是技术不好，而是产品边界会污染 Lens。

---

## 六、宪法检验记录

| 参考项目 | 迁移什么机制 | Constitution 条款 | 结果 |
|:---|:---|:---|:---|
| codebase-memory-mcp | tree-sitter + SQLite + Fact Graph | 第一条 | ✅ 通过 |
| codebase-memory-mcp | MCP Server 骨架 | 第一条 | ✅ 通过 |
| codebase-memory-mcp | 文件哈希 + 增量更新 | 第一条 | ✅ 通过 |
| CocoIndex | AST-aware 分块策略 | 第一条 | ✅ 通过 |
| GitIQ | commit → signal extraction | 第二条 | ✅ 通过 |
| LiSSA | trace recovery + 置信度 | 第二条 | ✅ 通过 |
| Kognit | Capability Extraction | 第二条 ❌ | **拒绝** |
| Kognit | Developer Profile | 第六条 ❌ | **拒绝** |
| BAML | JD 结构化解析 | 第六条 ❌ | **拒绝** |

---

## 七、实施优先级

### P0: 必须实现（删掉会废掉 Lens）

1. tree-sitter AST 解析 — 来源：codebase-memory-mcp
2. Fact/Edge 数据模型 — 来源：codebase-memory-mcp
3. SQLite 图谱存储 — 来源：codebase-memory-mcp
4. MCP Server 骨架 — 来源：codebase-memory-mcp

### P1: 应该实现（增强核心能力）

5. AST-aware 分块 — 来源：CocoIndex
6. Git signal extraction — 来源：GitIQ
7. 置信度计算 — 来源：LiSSA
8. 混合搜索 — 来源：CodeRAG

### P2: 可选实现（锦上添花）

9. 图遍历路径发现 — 来源：codebase-memory-mcp
10. 文件哈希增量更新 — 来源：codebase-memory-mcp
