# 参考项目对比分析

## 概览

| 项目 | 语言 | 定位 | 核心特点 |
|:---|:---|:---|:---|
| **codebase-memory-mcp** | C | 代码知识图谱引擎 | 158 语言、Hybrid LSP、15 个 MCP 工具、性能极致 |
| **Kognit** | Python | 开发者技术传记 | GitHub 分析、LLM 驱动、PDF 报告生成 |
| **cocoindex** | Python/Rust | AST 语义代码搜索 | 向量嵌入、增量索引、语义搜索 |
| **GitIQ** | Python/JS | GitHub 配置分析 | Web 应用、评分系统、LLM 洞察 |
| **Project-Lens** | TypeScript | 项目知识层 | 6 个 MCP 工具、Evidence 绑定、声明验证 |

---

## 1. codebase-memory-mcp

### 项目定位
最成熟的代码知识图谱引擎。用 C 语言编写，支持 158 种语言，提供 15 个 MCP 工具。

### 我们借鉴了什么

| 借鉴点 | 我们的实现 | 差异 |
|:---|:---|:---|
| **SQLite 存储架构** | `src/store.ts` 中的 nodes/edges/evidence 表设计 | 我们简化了表结构，移除了 Capabilities 表 |
| **FTS5 全文搜索** | `nodes_fts`、`evidence_fts`、`decision_traces_fts` | 他们使用自定义 `cbm_camel_split` 分词器 |
| **增量索引策略** | `src/extractor/file-scanner.ts` 的 SHA-256 哈希比对 | 他们使用 RAM-first 管道 + LZ4 压缩 |
| **MCP Server 架构** | `src/mcp/server.ts` 的工具注册模式 | 他们有 15 个工具，我们简化为 6 个 |
| **WASM 解析** | 使用 `web-tree-sitter` WASM | 他们编译原生 C 二进制，性能更高 |

### 关键差异

1. **语言选择**: 他们用 C（极致性能），我们用 TypeScript（开发效率）
2. **语言支持**: 他们支持 158 种，我们支持 3 种（TS/Python/Go）
3. **功能范围**: 他们有 Cypher 查询、死代码检测、跨服务链接；我们专注于 Evidence 绑定和声明验证
4. **Hybrid LSP**: 他们实现了跨文件类型推断，我们只做 AST 级别提取

### 可学习的未来方向

- 自定义 FTS5 分词器（camelCase/snake_case 感知）
- 跨文件类型推断（Hybrid LSP 简化版）
- 图可视化界面

---

## 2. Kognit

### 项目定位
开发者技术传记生成器。用 Python 编写，通过 LLM 分析 GitHub 画像生成 PDF 报告。

### 我们借鉴了什么

| 借鉴点 | 我们的实现 | 差异 |
|:---|:---|:---|
| **Git 信号提取** | `src/evidence/git-signal.ts` 的 blame/history 分析 | 他们更侧重 GitHub API，我们用本地 git 命令 |
| **能力推断概念** | 早期规划中的 Capability Extraction（未实现） | 他们用 LLM 推断，我们计划用规则匹配 |
| **PDF 渲染** | `src/mcp/tools/render.ts` 的 Typst 渲染 | 他们用 WeasyPrint，我们用 Typst |

### 关键差异

1. **目标用户**: 他们面向求职者生成简历，我们面向 AI Agent 提供知识
2. **LLM 依赖**: 他们重度依赖 LLM 做推断，我们尽量不依赖 LLM
3. **数据来源**: 他们从 GitHub API 获取，我们从本地 git 仓库提取
4. **输出形式**: 他们生成 PDF 报告，我们提供结构化 JSON

### 可学习的未来方向

- GitHub 画像分析功能（作为附加模块）
- 更丰富的 PDF 模板

---

## 3. cocoindex

### 项目定位
AST 语义代码搜索工具。基于 Rust 引擎，支持向量嵌入和语义搜索。

### 我们借鉴了什么

| 借鉴点 | 我们的实现 | 差异 |
|:---|:---|:---|
| **AST 分块策略** | `src/extractor/fact-builder.ts` 按函数/类边界提取 | 他们用 RecursiveSplitter，我们直接提取结构 |
| **增量索引** | `src/extractor/file-scanner.ts` 的文件哈希比对 | 他们用 CocoIndex 引擎的 memo 机制 |
| **MCP 集成** | `src/mcp/server.ts` 的 stdio 模式 | 他们同时支持 Skill 和 MCP 两种模式 |

### 关键差异

1. **搜索方式**: 他们用向量嵌入做语义搜索，我们用 FTS5 做全文搜索
2. **索引粒度**: 他们按代码块（chunk）索引，我们按函数/类/模块索引
3. **依赖**: 他们依赖外部嵌入模型（本地或云端），我们零外部依赖
4. **定位**: 他们专注于搜索，我们专注于知识提取和验证

### 可学习的未来方向

- 向量嵌入搜索（作为 FTS5 的补充）
- 自定义分块器（支持更多文件类型）
- 后台守护进程模式

---

## 4. GitIQ

### 项目定位
GitHub 配置分析 Web 应用。用 Python/JS 编写，提供评分和 LLM 洞察。

### 我们借鉴了什么

| 借鉴点 | 我们的实现 | 差异 |
|:---|:---|:---|
| **评分概念** | `src/query/ranking.ts` 的 Credibility + Importance | 他们用综合评分，我们用双维度评分 |
| **分析报告** | `src/snapshot/builder.ts` 的知识包导出 | 他们生成 Web 报告，我们生成 JSON 快照 |

### 关键差异

1. **架构**: 他们是 Web 应用（前端+后端+数据库），我们是 CLI/MCP 工具
2. **数据持久化**: 他们用 Supabase，我们用 SQLite
3. **AI 使用**: 他们用 OpenAI 生成洞察，我们不依赖外部 AI
4. **目标**: 他们优化 GitHub 展示，我们优化 AI Agent 理解

### 可学习的未来方向

- Web 可视化界面（路线图中已规划）
- 更细粒度的评分维度

---

## 总结：Project-Lens 的独特价值

| 特性 | codebase-memory | Kognit | cocoindex | GitIQ | **Project-Lens** |
|:---|:---|:---|:---|:---|:---|
| 本地运行 | ✅ | ❌ 需 API | ✅ | ❌ 需 API | ✅ |
| 零外部依赖 | ✅ | ❌ | ❌ | ❌ | ✅ |
| Evidence 绑定 | ❌ | 部分 | ❌ | ❌ | ✅ |
| 声明验证 | ❌ | ❌ | ❌ | ❌ | ✅ |
| 决策追踪 | 部分 | ❌ | ❌ | ❌ | ✅ |
| MCP 集成 | ✅ 15 tools | ❌ | ✅ 1 tool | ❌ | ✅ 6 tools |

### Project-Lens 的核心差异化

1. **Evidence-first 设计**: 每个事实都有证据支撑，每个声明都可验证
2. **双维度评分**: Credibility（可信度）+ Importance（重要性）
3. **声明验证**: 独特的 verify 工具，验证代码声明的真实性
4. **决策追踪**: 完整的 Decision Trace，理解代码演变历史
5. **零依赖**: 纯本地运行，无需外部 API 或嵌入模型

---

## 未来改进方向

基于参考项目的分析，以下功能值得考虑：

| 优先级 | 功能 | 参考来源 | 复杂度 |
|:---|:---|:---|:---|
| P1 | 自定义 FTS5 分词器 | codebase-memory | 中 |
| P1 | 向量嵌入搜索 | cocoindex | 高 |
| P2 | Web 可视化界面 | GitIQ + codebase-memory | 高 |
| P2 | GitHub 画像分析 | Kognit + GitIQ | 中 |
| P3 | 跨文件类型推断 | codebase-memory (Hybrid LSP) | 极高 |
| P3 | 158 语言支持 | codebase-memory | 高 |
