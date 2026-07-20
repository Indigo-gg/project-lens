# Project-Lens Constitution v2.0

> **Version**: 2.0 | **Date**: 2026-07-18 | **Status**: 冻结
>
> **一句话定位**: Project-Lens builds structured, evidence-backed repository context for agents. It does not search files, summarize repositories, or answer questions directly. Its only responsibility is to organize trustworthy context so that agents can reason about software systems with less exploration, fewer tokens, and higher confidence.

---

## 核心原则

Project-Lens 是在定义**边界**，不是在定义产品。所有设计必须接受一个审判：

> **这项能力是在帮助 Agent 建立 Context，还是在帮助 Agent 写代码？**
>
> 如果是后者，就应该删掉。

---

## 第一条：唯一产出

> **Lens 的唯一产出是 Context Package。**

Context Package 包含固定五部分：

| 部分 | 职责 | 示例 |
|:----|:-----|:------|
| **Scope** | 缩小世界：当前问题涉及的范围 | `Core/Experiment/Metrics/` |
| **Structure** | 逻辑树：涉及哪些模块，如何组织 | `Experiment → Orchestrator → Metrics → Persistence` |
| **Evidence** | 可追溯证据：Claim → Evidence → Source | `Persistence → implemented in → metrics.py → line 42` |
| **Relation** | 关系：模块之间如何连接 | `run_step() → updates → Edge → affects → Metrics` |
| **Confidence** | 置信度：哪些能信，哪些要验证 | `0.94 — 4 references, 2 tests, 1 README` |

不是：
- Snapshot
- Summary
- File list
- Search results

---

## 第二条：什么是 Context

> **Context = 为了当前任务，自动组织出来的一组有结构的 Evidence。**

多出来的两个字是"有结构"。

不是：
```
Evidence
Evidence
Evidence
Evidence  ← 这就是 RAG，Agent 还是要自己组织
```

而是：
```
Question
  ↓
Relevant Modules
  ↓
Responsibilities
  ↓
Evidence
  ↓
Relations
  ↓
Open Questions
```

---

## 第三条：三个动作

Lens 只做三件事：

### ① Build（离线）
建立 Repository Context。一次解析，生成 Evidence，建立 Relation。

### ② Assemble（在线）
Agent 问问题，Engine 不是搜索，而是**组装**一个 Context Package。

### ③ Expand（在线）
Agent 继续追问，Engine 不是重新搜索，而是在已有 Context 基础上**补充新的 Evidence**。

---

## 第四条：架构

按产品能力划分，而非技术模块：

```
Project-Lens
├── Builder     建立 Repository Context（离线）
├── Assembler   根据问题组装 Context Package（在线）
├── Expander    增量扩展已有 Context（在线）
└── Renderer    格式化输出给 Agent
```

注意：AST、Tree-sitter、Git、Markdown Parser 都是 Builder 的内部实现细节，不是架构的一部分。

---

## 第五条：不许做的事

- ❌ Knowledge Graph（太大，偏离主题）
- ❌ Memory（不是这个项目的事）
- ❌ Repository Knowledge Base（太大）
- ❌ Context Engine（名字容易无限扩张）
- ❌ 直接回答 Agent 的问题（Agent 自己推理）
- ❌ 搜索文件（Agent 已经会 grep）
- ❌ 生成摘要（摘要只是 Context Package 的副产品）

---

## 第六条：验收标准

8 层框架：

| Level | 名称 | 问题 |
|:-----|:------|:-----|
| 1 | **Correctness** | 解析正确？没有遗漏？ |
| 2 | **Evidence** | 每个结果可溯源？ |
| 3 | **Understanding** | Agent 不打开文件就知道模块职责？ |
| 4 | **Orientation** | Agent 一分钟内知道入口、核心、可跳过、下一步？ |
| 5 | **Compression** | 10万 token → 5000 token？ |
| 6 | **Decision** | Agent 敢不敢基于 Lens 推理？ |
| 7 | **Context Assembly** | 能根据问题动态组装 Context Package？ |
| 8 | **Reusability** | 同一 Context 回答多个问题？ |

---

## 第七条：最终检验

> **Project-Lens 的唯一责任是组织可信任的 Context，让 Agent 能够用更少的探索、更少的 token、更高的置信度来推理软件系统。**
>
> 所有实现（AST、grep、Tree-sitter、Git 分析、调用图、符号索引等）都退居幕后，只作为 Builder 的实现细节。这样后续无论技术怎么演进，项目都不会偏离最初的宪法。