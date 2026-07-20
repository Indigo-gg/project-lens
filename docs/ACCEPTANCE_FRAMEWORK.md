# Project-Lens Acceptance Framework v2.0

> **核心原则**: 不衡量"我们提取了多少信息"，而衡量"Agent因此少做了多少工作"。
>
> **升级原则**: Project-Lens 的目标不是生成更好的项目摘要，而是构建一个能够围绕任何任务动态组装 Context 的 Engine。Hierarchy、Evidence、Compression 都只是实现这一目标的能力，而不是最终产品本身。Lens 的输入范围限定为项目内的代码和文本文件。

---

## 前置问题：Agent 在什么情况下应该调用 Lens？

Claude Code 已经能做的：
- `grep` — 关键词搜索
- `read_file` — 读文件
- `find` / `glob` — 文件查找

Lens 的存在理由是：**降低 Agent 理解项目的成本**，而不是"帮 Agent 找文件"。

---

## Context 的定义

> **Context = 为了当前任务，自动组织出来的一组 Evidence。**

不是：
```
文件 → 摘要
```
不是：
```
Hierarchy
```
而是：
```
Question
↓
Evidence Graph
↓
Relevant Context
↓
Answer
```

Context 不是存储对象，Context 是一种**动态生成物**。

---

## 7 个验收问题（升级版）

### Q1: Token 压缩比
```
不用 Lens：需要读取多少 token 才能回答问题？
使用 Lens：需要多少 token？

通过条件：Lens 版本 ≤ 不用 Lens 版本的 1/5
（如：35万 token → 5万 token）
```

### Q2: Context 还是 Files？
```
Lens 输出的是概念层（Concept → Responsibilities → Lifecycle → Entry → Dependencies）
还是文件列表（Top Files）？

通过条件：Agent 可以不打开文件就知道模块职责
```

### Q3: Evidence 还是 Claim-based Evidence？
```
当前：
  Evidence → Source

升级后：
  Claim
    ↓
  Evidence
    ↓
  Source (Experiment / Code / Figure)

通过条件：每个结论可追溯到它在支持什么 Claim
```

### Q4: Structure 还是 Files？
```
Lens 输出的是架构（Architecture: React → FastAPI → Worker）
还是 200 个文件列表？

通过条件：输出反映系统结构，而非文件平铺
```

### Q5: Hierarchy（层级下钻）
```
当前：test / main / utils 一起排（无层级）
需要：
  System
  └── Subsystem
      └── Module
          └── Component
              └── File

通过条件：Agent 可以逐层下钻，而非直接看到 File 层
```

### Q6: Why？
```
说"重要"不够。
需要：
  Scheduler → 重要
  因为：
  - 负责 Task Scheduling
  - 18 个调用者
  - 唯一入口

通过条件：每个重要性判断附带原因
```

### Q7: Dynamic Context Assembly
```
给 Agent 一个问题：
  "为什么 Persistence 失败？"

Engine 是否能自动组织：
  12 条 Evidence
  → 4 个 Experiment
  → 2 个 Code
  → 1 个 Paper
  → 组成 Context

如果不能，说明不是 Context Engine，只是 Retriever。

通过条件：能根据问题动态组装 Context，而非返回固定摘要
```

---

## 8 层验收框架（升级版）

| Level | 名称 | 问题 | 通过标准 |
|:-----|:-----|:-----|:---------|
| 1 | **Correctness** | 路径正确？文件遗漏？解析错误？ | 0 errors |
| 2 | **Evidence** | 每个结果有来源/引用/confidence？ | 可溯源 |
| 3 | **Understanding** | Agent 能不用打开文件就知道模块职责？ | 准确描述职责 |
| 4 | **Navigation** | Agent 能在 3 步以内找到真正需要看的地方？ | 3 步内定位 |
| 5 | **Compression** | 10万 token 项目 → 5000 token Context，还能回答问题？ | 压缩比 ≥ 20:1 |
| 6 | **Decision** | Agent 敢不敢基于 Lens 的输出来推理/修改/总结？ | "敢推理" |
| 7 | **Context Assembly** | 给一个问题，Engine 能不能动态组装 Context 而非返回固定摘要？ | 按需组装 |
| 8 | **Reusability** | 同一个 Context 能否回答多个相关问题（Persistence → Dissipation → Critical Point）？ | 跨问题复用 |

---

## 最终验收指标：Trust（信任度）

每次 Agent 使用 Lens 后回答以下 5 个问题（1-5 分）：

| # | 问题 | 目的 | 分数 |
|:-:|:-----|:-----|:----:|
| 1 | 我理解了这个项目的整体结构吗？ | 是否建立了全局模型 | /5 |
| 2 | 我知道应该先读哪些地方，而不是盲目搜索吗？ | 是否提供了导航能力 | /5 |
| 3 | 我相信 Lens 给出的结论，而不是必须重新验证吗？ | 是否建立了证据和可解释性 | /5 |
| 4 | 我能基于 Lens 开始推理/修改/总结，而不是重新探索吗？ | 是否真正降低了认知成本 | /5 |
| 5 | 如果没有 Lens，我会花明显更多时间吗？ | 是否创造了不可替代的价值 | /5 |

> **通过标准**: 5 项平均分 ≥ 4.0
>
> **如果低于 4.0**：Lens 还没有成为 Context Engine，它仍然只是一个更高级的索引器。

---

## 理想工作流（动态 Context）

```
Snapshot（初始压缩）
  ↓
Agent 提问
  ↓
Context Assembly Engine 自动组织 Evidence
  ↓
Agent 继续追问
  ↓
Engine 动态扩展 Context
  ↓
Agent 推理 → 回答
  ↓
Engine 保存 Context 供后续复用
```

这不是一次性的 Snapshot，而是：**Question → Context Assembly → Expand → Reason → Expand → Answer** 的迭代循环。

---

## 项目定位

> **Project-Lens 的目标不应该是生成更好的项目摘要，而应该是构建一个能够围绕任何任务动态组装 Context 的 Engine。**
>
> Hierarchy、Evidence、Compression 都只是实现这一目标的能力，而不是最终产品本身。
>
> 从"代码理解工具"出发，最终收敛到的是同一个核心——**把项目内的代码和文本，转化为 Agent 可以信任、可以推理、可以持续扩展的 Context**。