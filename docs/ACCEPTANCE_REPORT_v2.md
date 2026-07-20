# Project-Lens 验收报告 v2.0（基于 Context Assembly 框架）

> **测试对象**: Lens v6.0.0 对 openstruct 项目的理解能力
> **验收标准**: ACCEPTANCE_FRAMEWORK.md v2.0
> **评估人**: Hermes Agent

---

## 总体评价

**按普通项目标准：9/10** — 已经知道不是检索问题，而是 Context、Hierarchy、Evidence 问题，比大多数 RAG 项目高一个层级。

**按 Context Engine 理念：7/10** — 最大的遗漏是：没有讨论 Context Assembly。报告始终站在"Lens 这个项目"里思考，而不是站在"Context Engine 的宪法"里思考。

---

## 7 个验收问题评分

### Q1: Token 压缩比 — 4/5 ✅

| 方式 | Token | 压缩比 |
|:----|:-----:|:------:|
| 不用 Lens | ~50K（核心源码+文档） | — |
| 用 Lens | ~4K（Snapshot） | **12:1** |

**问题**：压缩比达标，但 4K 内容价值低（前 5 条是 `import sys`）。

---

### Q2: Context vs Files — 2/5 ❌

**当前输出**：文件列表
```
Top 5 key facts:
  [file] p0_test_results.json
  [import] import sys
  [import] import os
  ...
```

**Agent 需要**：概念层
```
System: OpenStruct
├── Core Layer (10 files, 149 facts)
│   ├── Orchestrator → 生命周期管理, 23 functions
│   ├── Edge         → 边操作, 23 functions
│   └── ...
```

**差距**：不知道 Agent 需要什么，输出的是"有什么文件"而不是"项目是什么"。

---

### Q3: Claim-based Evidence — 1/5 ❌

**当前**：Evidence → Source（分数无来源）
```
[import] import sys  score: 0.7
```

**需要**：Claim → Evidence → Source
```
Claim: "系统有稳态机制"
  Evidence:
    Experiment: V5_REPORT.md → 3.8% 自由容量
    Code: run_robustness.py → 扰动恢复逻辑
    Metrics: 机会密度 0.034
  Source: docs/09-architecture.md
```

**差距**：没有 Claim 层，Agent 无法判断"这个结论在支持什么断言"。

---

### Q4: Structure vs Files — 1/5 ❌

**当前**：881 个事实平铺

**需要**：架构图
```
OpenStruct
├── Core Layer
│   ├── Orchestrator → 生命周期
│   ├── Ruleset → 规则系统
│   ├── Edge → 边操作
│   └── ...
├── Experiment Layer
└── Test Layer
```

**差距**：没有架构输出，只有按分数排序的文件列表。

---

### Q5: Hierarchy — 1/5 ❌

**当前**：无层级，所有 881 个事实混在一起

**需要**：逐层下钻
```
System → Core → Orchestrator → run_step()
                                 init_system()
                                 get_metrics_history()
```

**差距**：没有层级概念，Agent 只能从 881 个平铺事实中自己找。

---

### Q6: Why — 1/5 ❌

**当前**：分数无原因
```
[function] orchestrator  score: 0.7
```

**需要**：原因
```
[function] orchestrator  score: 0.7
  因为：入口函数，被 23 个调用者引用，3 个测试覆盖
```

**差距**：每个重要性判断没有附带原因，Agent 无法信任。

---

### Q7: Dynamic Context Assembly — 1/5 ❌

**当前**：一次 Snapshot，结束

**需要**：
```
Question: "为什么 Edge Cost 无效？"
  ↓
Engine 自动组装：
  12 条 Evidence → 4 个 Experiment → 2 个 Code → 1 个 Paper
  ↓
Agent 推理
  ↓
继续追问 → Engine 动态扩展
```

**差距**：没有动态组织能力，无法根据问题组装 Context。

---

## 8 层框架打分

| Level | 名称 | 分数 | 理由 |
|:-----|:-----|:----:|:------|
| 1 | **Correctness** | 3/5 | 解析 0 错误，但 path 校验 bug 导致 CLI 不可用 |
| 2 | **Evidence** | 2/5 | 分数存在但不透明，没有 Claim 层 |
| 3 | **Understanding** | 1/5 | 不能不看文件就知道模块职责 |
| 4 | **Navigation** | 1/5 | 不能 3 步内定位到核心代码 |
| 5 | **Compression** | 3/5 | 压缩比 12:1 达标，但内容质量差 |
| 6 | **Decision** | 1/5 | 不敢说"敢推理" |
| 7 | **Context Assembly** | 1/5 | 不能动态组装，只有一次 Snapshot |
| 8 | **Reusability** | 1/5 | 没有复用机制，每次重新搜索 |

**平均：1.6/5**

---

## Trust 5 问

| # | 问题 | 分数 | 理由 |
|:-:|:-----|:----:|:------|
| 1 | 理解整体结构了吗？ | 2/5 | 模块分布有用，但不知具体关系 |
| 2 | 知道先读哪吗？ | 1/5 | 关键 facts 全是 import 噪音 |
| 3 | 相信结论吗？ | 1/5 | 分数无来源，不敢信 |
| 4 | 能基于 Lens 推理吗？ | 1/5 | 还得自己 grep 找上下文 |
| 5 | 省时间了吗？ | 2/5 | 省了扫文件的 token，但没省心智成本 |

**平均：1.4/5**

---

## 升级方向（按优先级）

### 🟥 P0: Dynamic Context Assembly（新 Level 7）
从"一次 Snapshot"改为"问题驱动 → 动态组装 Context"。
```
Question → Engine 自动组织 Evidence → Agent 推理 → 继续追问 → 扩展
```

### 🟥 P0: Claim-based Evidence（Q3 升级）
每个输出附带它在支持什么 Claim。
```
Claim: "Exploration 导致相变"
  Evidence:
    - Experiment 结果
    - Code 实现
    - 图表
```

### 🟧 P1: Hierarchy（层级下钻）
System → Module → Component → File，而非扁平列表。

### 🟧 P1: Why（原因透明）
每个重要性判断附带原因（调用者数量、入口点、引用数）。

### 🟨 P2: Reusability（Level 8）
同一个 Context 能回答多个相关问题，而非每次重新搜索。

---

## 一句话总结

> **Project-Lens 当前是一个不错的文件索引器（压缩比 12:1 ✅），但还不是 Context Engine（信任度 1.4/5 ❌）。核心差距不是搜得准不准，而是它没有围绕任务动态组装 Context 的能力。**
>
> 升级方向：从"一次 Snapshot" → "Question → Context Assembly → Expand → Reason → Answer" 的迭代循环。