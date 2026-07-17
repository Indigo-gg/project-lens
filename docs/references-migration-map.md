# 参考项目迁移映射

> 基于 `migration-constitution.md` 重新评估所有参考项目。
> **所有借鉴项必须通过宪法检验，否则拒绝。**

---

## 一、按 Primitive 分类（宪法第四条）

### Primitive A: Project Structure（项目结构）

**迁移什么**：AST → Fact → Edge → Graph

| 参考项目 | 迁移什么机制 | 对应宪法 | 对应 Lens 模块 | 评分 |
|:---|:---|:---|:---|:---|
| **codebase-memory-mcp** | tree-sitter 解析、Fact/Edge 数据模型、SQLite 存储 | 第一条 | extractor/ + store.ts | ⭐⭐⭐⭐⭐ |
| **CocoIndex** | AST-aware 分块策略（按函数/类边界分块） | 第一条 | extractor/ | ⭐⭐⭐⭐ |

**codebase-memory-mcp 具体迁移项**：

| Primitive | 来源 | Lens 用途 | 宪法检验 |
|:---|:---|:---|:---|
| tree-sitter .scm 查询规则 | codebase-memory-mcp/queries/ | ast-parser.ts 的多语言支持 | ✅ 机制，不是功能 |
| SQLite facts + fact_edges 表设计 | codebase-memory-mcp/schema | store.ts 的 nodes + edges 表 | ✅ 机制，不是功能 |
| 文件哈希 + 增量解析 | codebase-memory-mcp/indexer | file-scanner.ts 的增量更新 | ✅ 机制，不是功能 |
| MCP Server 骨架 | codebase-memory-mcp/server | mcp/server.ts | ✅ 机制，不是功能 |
| Graph traversal（图遍历） | codebase-memory-mcp/query | explore() 的路径发现 | ✅ 机制，不是功能 |

**CocoIndex 具体迁移项**：

| Primitive | 来源 | Lens 用途 | 宪法检验 |
|:---|:---|:---|:---|
| AST-aware chunking | CocoIndex/chunker | 按函数/类边界分块搜索 | ✅ 机制，不是功能 |
| 结构化索引条目 | CocoIndex/indexer | nodes_fts 的索引策略 | ✅ 机制，不是功能 |

**拒绝项**：

| 项目 | 拒绝内容 | 原因 | 违反条款 |
|:---|:---|:---|:---|
| codebase-memory-mcp | Query → Cypher → LLM → Answer workflow | Workflow 不迁移 | 第四条 |
| CocoIndex | 搜索结果的 LLM 摘要 | Interpretation | 第二条 |

---

### Primitive B: Evidence（证据）

**迁移什么**：Git Signal → Evidence → Decision Trace

| 参考项目 | 迁移什么机制 | 对应宪法 | 对应 Lens 模块 | 评分 |
|:---|:---|:---|:---|:---|
| **GitIQ** | commit → diff → signal extraction | 第二条 | evidence/ | ⭐⭐⭐⭐ |
| **LiSSA** | trace recovery、置信度计算 | 第二条 | verify/ | ⭐⭐⭐ |

**GitIQ 具体迁移项**：

| Primitive | 来源 | Lens 用途 | 宪法检验 |
|:---|:---|:---|:---|
| commit message 解析 | GitIQ/analyzer | git-signal.ts 的 commit 解析 | ✅ Implementation |
| diff → change type 检测 | GitIQ/analyzer | git-signal.ts 的 change_type | ✅ Implementation |
| 文件级影响分析 | GitIQ/analyzer | git-signal.ts 的 affectedNodeIds | ✅ Implementation |

**GitIQ 拒绝项**：

| 拒绝内容 | 原因 | 违反条款 |
|:---|:---|:---|
| Architecture Evolution 分析 | Interpretation | 第二条 |
| Developer Skill 提取 | Career Knowledge | 第二条 + 第六条 |
| 仓库级 LLM 分析 | Workflow | 第四条 |

**LiSSA 具体迁移项**：

| Primitive | 来源 | Lens 用途 | 宪法检验 |
|:---|:---|:---|:---|
| 需求到代码的追溯算法 | LiSSA/tracer | verify() 的溯源逻辑 | ✅ Implementation |
| 置信度计算公式 | LiSSA/confidence | verify() 的 confidence | ✅ Implementation |

**LiSSA 拒绝项**：

| 拒绝内容 | 原因 | 违反条款 |
|:---|:---|:---|
| RAG-based 检索增强 workflow | Workflow | 第四条 |
| 需求文档解析 | 不属于 Project Knowledge | 第六条 |

---

### Primitive C: Search（搜索）

**迁移什么**：FTS + Hybrid Search + Chunk Strategy

| 参考项目 | 迁移什么机制 | 对应宪法 | 对应 Lens 模块 | 评分 |
|:---|:---|:---|:---|:---|
| **CodeRAG** | 代码分块策略、混合搜索方案 | 第一条 | query/ | ⭐⭐ |

**CodeRAG 具体迁移项**：

| Primitive | 来源 | Lens 用途 | 宪法检验 |
|:---|:---|:---|:---|
| 代码分块策略 | CodeRAG/chunker | explore() 的分块搜索 | ✅ 机制 |
| 关键词 + 语义混合 | CodeRAG/retriever | explore() 的混合排序 | ✅ 机制 |

---

### Primitive D: Infrastructure（基础设施）

**迁移什么**：MCP + CLI + Schema

| 参考项目 | 迁移什么机制 | 对应宪法 | 对应 Lens 模块 | 评分 |
|:---|:---|:---|:---|:---|
| **GitHub MCP Server** | MCP Server 实现模式 | 第一条 | mcp/ | ⭐ |

---

## 二、不迁移项目（宪法第六条）

以下项目的所有能力都**不属于 Lens**，整体拒绝：

### Kognit

| 项目 | 产品定位 | 产品污染度 | 拒绝原因 |
|:---|:---|:---|:---|
| **Kognit** | Developer Biography | ⭐⭐⭐⭐⭐ | 全部是 Career Knowledge |

**具体拒绝项**：

| Kognit 能力 | 为什么拒绝 | 违反条款 |
|:---|:---|:---|
| Capability Extraction | Interpretation（"这是什么能力"） | 第二条 |
| Developer Profile | Career Knowledge | 第二条 + 第六条 |
| 多智能体深度分析 | Workflow | 第四条 |
| 技术传记生成 | 职业 Artifact | 第六条 |

**Kognit 的唯一价值**：验证了"从代码中提取结构化信息"这个方向是对的。但提取的内容（能力画像）不属于 Lens。

---

### BAML 生态

| 项目 | 产品定位 | 产品污染度 | 拒绝原因 |
|:---|:---|:---|:---|
| **BAML 生态** | 结构化提取 DSL | ⭐⭐⭐ | DSL 属于工具链，不是 Primitive |

**拒绝原因**：BAML 是一个 DSL 框架，不是 Lens 需要的 Primitive。Lens 已经用 Zod 做 Schema 约束，不需要引入 BAML。

---

### LinkAnchor

| 项目 | 产品定位 | 产品污染度 | 拒绝原因 |
|:---|:---|:---|:---|
| **LinkAnchor** | Issue → Commit 链路恢复 | ⭐⭐ | 功能太窄，且已有 git-signal.ts |

---

### Web3Insight

| 项目 | 产品定位 | 产品污染度 | 拒绝原因 |
|:---|:---|:---|:---|
| **Web3Insight** | Web3 开发者档案 | ⭐⭐⭐⭐ | 领域太窄 + Career Knowledge |

---

## 三、综合评分（宪法第五条：删除测试）

| 项目 | Mechanism | Constitution | Reuse | Pollution | 删掉后 Lens 还能工作？ |
|:---|:---|:---|:---|:---|:---|
| **codebase-memory-mcp** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐ | ❌ 不能（核心） |
| **CocoIndex** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐ | ✅ 能（非核心） |
| **GitIQ** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ✅ 能（非核心） |
| **LiSSA** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐ | ✅ 能（非核心） |
| **CodeRAG** | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐ | ✅ 能（非核心） |
| **GitHub MCP** | ⭐ | ⭐⭐⭐⭐⭐ | ⭐ | ⭐ | ✅ 能（非核心） |
| **Kognit** | ⭐⭐ | ⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ 能（整体拒绝） |
| **BAML** | ⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ✅ 能（整体拒绝） |
| **LinkAnchor** | ⭐⭐ | ⭐⭐⭐⭐ | ⭐ | ⭐ | ✅ 能（功能重叠） |
| **Web3Insight** | ⭐ | ⭐⭐ | ⭐ | ⭐⭐⭐⭐ | ✅ 能（领域不匹配） |

---

## 四、实施优先级

### P0: 必须实现（删掉会废掉 Lens）

1. **tree-sitter AST 解析** — 来源：codebase-memory-mcp
2. **Fact/Edge 数据模型** — 来源：codebase-memory-mcp
3. **SQLite 图谱存储** — 来源：codebase-memory-mcp
4. **MCP Server 骨架** — 来源：codebase-memory-mcp

### P1: 应该实现（增强核心能力）

5. **AST-aware 分块** — 来源：CocoIndex
6. **Git signal extraction** — 来源：GitIQ
7. **置信度计算** — 来源：LiSSA
8. **混合搜索** — 来源：CodeRAG

### P2: 可选实现（锦上添花）

9. **图遍历路径发现** — 来源：codebase-memory-mcp
10. **文件哈希增量更新** — 来源：codebase-memory-mcp

---

## 五、宪法检验记录

每次引入新的参考项目或借鉴项时，填写此表：

| 日期 | 参考项目 | 借鉴内容 | 宪法检验 | 结果 |
|:---|:---|:---|:---|:---|
| 2026-07-17 | codebase-memory-mcp | tree-sitter 解析 | 第一条 ✅ | 通过 |
| 2026-07-17 | codebase-memory-mcp | SQLite 图谱存储 | 第一条 ✅ | 通过 |
| 2026-07-17 | CocoIndex | AST-aware 分块 | 第一条 ✅ | 通过 |
| 2026-07-17 | GitIQ | commit signal extraction | 第二条 ✅ | 通过 |
| 2026-07-17 | LiSSA | 置信度计算 | 第二条 ✅ | 通过 |
| 2026-07-17 | Kognit | Capability Extraction | 第二条 ❌ 第六条 ❌ | **拒绝** |
| 2026-07-17 | Kognit | Developer Profile | 第六条 ❌ | **拒绝** |
