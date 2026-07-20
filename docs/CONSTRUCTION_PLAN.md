# Project-Lens 施工方案 v1.0

> **基于**: ACCEPTANCE_FRAMEWORK.md v2.0
> **目标**: 从文件索引器 → Context Assembly Engine
> **范围**: 项目内的代码和文本文件

---

## 总体架构

```
当前（v6.0）:
  Observe → 提取事实 → 存入 SQLite → Snapshot（扁平列表）

目标（v7.0）:
  Observe → 提取事实 → 存入 SQLite
    ↓
  Question → Context Assembly Engine
    ├── 自动组织 Hierarchy
    ├── 附加 Claim-based Evidence
    ├── 输出压缩 Context
    └── 支持迭代扩展（Expand）
```

---

## 施工路线图（3 个里程碑）

### 里程碑 1：基础修复 + Hierarchy 输出（预计 1-2 天）

**目标**：让 Agent 第一次使用 Lens 就能看到项目结构，而不是噪音。

#### 1.1 修复 Critical Bug

| 任务 | 文件 | 描述 |
|:----|:-----|:------|
| 修 path 校验 | `src/mcp/tools/observe.ts` | 删除 `validateProjectPath` 的 cwd 限制，允许任意绝对路径 |
| 加 `--source-only` 过滤 | `src/query/explore.ts` | explore 结果自动排除 `tests/` 目录，或降权到末尾 |

**验收标准**：
- `lens observe --path /任意/绝对/路径` 成功，不再报 "Path must be within cwd"
- `lens explore "orchestrator"` 前 10 条结果中至少 3 条是 `src/` 下的核心代码，不是测试文件

#### 1.2 输出 Hierarchy

| 任务 | 文件 | 描述 |
|:----|:-----|:------|
| 新增 `context` 模块 | `src/context/` | 新目录，负责将扁平 facts 组装为层级结构 |
| 实现 Hierarchy Builder | `src/context/hierarchy.ts` | 按 `file_path` 前缀自动分组：`src/core/` → `experiments/` → `tests/` |
| 修改 snapshot 输出 | `src/snapshot/builder.ts` | 从扁平 key_facts 改为层级结构 |
| 新增 explore 层级模式 | `src/query/explore.ts` | 加 `--mode=drill` 参数，支持逐层下钻 |

**输出示例**：
```json
{
  "project": "openstruct",
  "hierarchy": {
    "src/core": {
      "facts": 149,
      "files": ["orchestrator.py", "edge.py", "ruleset.py", "node.py", "token.py", "metrics.py", "logical_phase.py", "physical_phase.py", "types.py", "visualizer.py"],
      "entry_points": ["orchestrator.py::run_step", "orchestrator.py::init_system"],
      "children": {
        "orchestrator.py": { "functions": 23, "top": ["run_step", "init_system", "get_metrics_history"] },
        "edge.py": { "functions": 23, "top": ["bind", "cut", "bind_with_replacement"] }
      }
    },
    "experiments": { "facts": 337, "files": 30, "scripts": ["run_robustness.py", "run_2x2_v2.py", ...] },
    "tests": { "facts": 151, "files": 9 }
  }
}
```

**验收标准**：
- Agent 能看到 openstruct → Core → Orchestrator → run_step() 这样的层级路径
- 每个层级显示该模块的职责摘要（从事实自动生成）
- 不再输出 `import sys` 作为 key fact

---

### 里程碑 2：Evidence 透明化 + Claim 支持（预计 2-3 天）

**目标**：Agent 可以信任 Lens 的结论，因为每个结论都附带可追溯的证据。

#### 2.1 分数透明化

| 任务 | 文件 | 描述 |
|:----|:-----|:------|
| 重写 ranking 输出 | `src/query/ranking.ts` | 每个分数附加 `breakdown` 字段：`{ benchmark: 0.0, tests: 1.0, git_commits: 3, callers: 18 }` |
| 修改 explore 输出 | `src/query/explore.ts` | 每个 result 的 credibility/importance 附带 breakdown |

**输出示例**：
```json
{
  "fact": { "name": "run_step", "filepath": "src/core/orchestrator.py" },
  "credibility": {
    "score": 0.83,
    "breakdown": {
      "has_test": true,
      "test_coverage": 3,
      "has_git_history": false,
      "git_commits": 0,
      "has_benchmark": false,
      "has_docs": true
    }
  },
  "importance": {
    "score": 0.91,
    "breakdown": {
      "callers": 18,
      "is_entry_point": true,
      "module_centrality": "high",
      "modification_frequency": "medium"
    }
  }
}
```

#### 2.2 Claim-based Evidence

| 任务 | 文件 | 描述 |
|:----|:-----|:------|
| 新增 Claim 模块 | `src/claim/` | 新目录，负责将事实组织为 Claim → Evidence → Source 结构 |
| 实现 Claim Builder | `src/claim/builder.ts` | 输入问题，从 facts 中自动匹配相关 Claim |
| 新增 verify 升级 | `src/verify/verdict.ts` | 验证结果增加 Claim 层级 |

**输出示例**：
```json
{
  "claim": "系统存在自由容量稳态机制",
  "confidence": 0.85,
  "evidence": [
    {
      "type": "experiment",
      "source": "experiments/V5_REPORT.md",
      "detail": "3.8% 自由容量在 50000 步内保持稳定，双向扰动恢复"
    },
    {
      "type": "code",
      "source": "src/core/logical_phase.py",
      "detail": "compute_free_capacity() 函数实现"
    },
    {
      "type": "metric",
      "source": "src/core/metrics.py",
      "detail": "机会密度追踪：30 步内恢复到 0.034"
    }
  ]
}
```

**验收标准**：
- `lens verify "系统有稳态机制"` 返回 Claim + 多条 Evidence，每条有具体来源
- 每个分数附带 breakdown，Agent 可以判断"为什么是这个分数"
- 不再输出 `score: 0.7` 这种黑盒分数

---

### 里程碑 3：动态 Context Assembly（预计 3-5 天）

**目标**：Agent 不再接收一次静态 Snapshot，而是可以提问 → 获得 Context → 追问 → 扩展。

#### 3.1 Context Assembly Engine

| 任务 | 文件 | 描述 |
|:----|:-----|:------|
| 新增 Context Engine | `src/context/engine.ts` | 核心引擎，输入问题，输出动态组装的 Context |
| 实现 Evidence Graph | `src/context/evidence-graph.ts` | 事实之间的连接关系（引用、调用、依赖） |
| 实现 Relevance Scoring | `src/context/relevance.ts` | 计算每个事实与当前问题的相关度 |
| 实现 Context 压缩 | `src/context/compressor.ts` | 将相关 Evidence 压缩为 ≤5K tokens 的 Context |

**工作流**：
```
Agent: "为什么 Edge Cost 无效？"
  ↓
Engine: 1. 解析问题 → 关键词: [edge, cost, 无效]
        2. 搜索相关事实 → 找到 12 条 Evidence
        3. 构建 Evidence Graph → 发现 4 个实验 + 2 个代码文件 + 1 篇文档
        4. 按相关度排序 → 取 top 8 条
        5. 压缩为 Context → 输出（~2K tokens）
  ↓
Agent: "那 Metrics 为什么这么设计？"
  ↓
Engine: 1. 基于已有 Context 扩展（不重新搜索）
        2. 新增相关 Evidence
        3. 更新 Context
```

#### 3.2 新 CLI 命令：`lens ask`

```
lens ask "为什么 Edge Cost 无效？" --max-tokens 5000
```

返回动态组装的 Context，而非静态 Snapshot。

#### 3.3 Iterative Expand

```
lens ask --expand "那 Metrics 呢？"
```

基于上一次 Context 扩展，而非重新搜索。

**验收标准**：
- 给 Agent 一个问题，Engine 能自动组装出 3+ 条相关 Evidence
- Agent 追问时，Engine 能基于已有 Context 扩展，而非重新搜索
- 每次输出 ≤5K tokens
- 同一个 Context 能回答 3+ 个相关问题（Reusability）

---

## 优先级矩阵

| 里程碑 | 任务 | 工作量 | 对 Agent 的价值 | 优先级 |
|:------|:-----|:------:|:---------------:|:------:|
| M1 | 修 path 校验 | 0.5h | 🔴 不然 CLI 不能用 | **P0** |
| M1 | `--source-only` 过滤 | 1h | 🔴 不然 explore 被测试淹没 | **P0** |
| M1 | Hierarchy 输出 | 4h | 🟠 Agent 看到结构而非列表 | **P1** |
| M2 | 分数 breakdown | 2h | 🟠 Agent 信任结论 | **P1** |
| M2 | Claim-based Evidence | 4h | 🟠 Agent 能推理 | **P1** |
| M3 | Context Assembly Engine | 8h | 🔵 核心价值 | **P2** |
| M3 | `lens ask` 命令 | 4h | 🔵 动态交互 | **P2** |
| M3 | Iterative Expand | 4h | 🔵 持续扩展 | **P2** |

---

## 验收标准总结

### 里程碑 1 通过条件
- [ ] `lens observe --path /任意/路径` 成功
- [ ] `lens explore "orchestrator"` 前 10 条至少 3 条非测试
- [ ] `lens snapshot` 输出层级结构，flat 文件列表不再出现在 top 5

### 里程碑 2 通过条件
- [ ] 每个分数附带 breakdown，Agent 可验证
- [ ] `lens verify "X"` 返回 Claim + Evidence + Source
- [ ] 不再输出 `import sys` 作为 key fact

### 里程碑 3 通过条件
- [ ] `lens ask "问题"` 返回动态组装的 Context
- [ ] 追问时扩展而非重新搜索
- [ ] 每次输出 ≤5K tokens
- [ ] 同一 Context 回答 3 个相关问题

---

## 建议执行顺序

```
Day 1:  修 path 校验 + --source-only 过滤 → 立即见效
Day 1:  实现 Hierarchy 输出 → Agent 看到结构
Day 2:  分数 breakdown → 可信任
Day 2-3: Claim-based Evidence → 可推理
Day 3-5: Context Assembly Engine + lens ask → 核心价值
```

要开始吗？先从 M1 开始——修 path 校验 + `--source-only` 过滤？