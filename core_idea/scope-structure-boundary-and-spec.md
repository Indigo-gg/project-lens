# Scope vs Structure 边界分析 & 四模块 Spec 实施方案

> 基于 Constitution v2.0（2026-07-18）
> 生成日期：2026-07-19

---

## 一、Scope 与 Structure 的边界分析

### 问题

Scope 和 Structure 是 Context Package 中相邻的两个部分。两者都涉及"模块"，但职责不同：

| 部分 | 职责 | 示例 |
|:----|:-----|:------|
| **Scope** | 缩小世界：当前问题涉及的范围 | `Core/Experiment/Metrics/` |
| **Structure** | 逻辑树：涉及哪些模块，如何组织 | `Experiment → Orchestrator → Metrics → Persistence` |

风险在于：如果两者独立输出，可能产生不一致——Scope 说涉及 3 个模块，Structure 只展示了 2 个，或者 Structure 引入了一个 Scope 中没有的模块。

### 分析

**Scope 是"筛选器"，Structure 是"地图"。** Scope 回答"哪些模块与当前问题相关"，Structure 回答"这些模块之间如何组织与连接"。两者不是同一层抽象。

**Scope 是扁平的集合，Structure 是层级化的图。** Scope 是一个简单的模块名集合（或路径前缀集合），没有结构信息。Structure 是一个有向图或树，包含节点之间的层级关系和连接关系。

**核心边界规则：Structure ⊆ Scope（闭包约束）。** 即 Structure 中的每一个节点都必须在 Scope 中。如果 Structure 需要引入一个 Scope 中没有的中间节点（例如两模块通过一个中间模块连接），则 Assembler 必须将该中间节点加入 Scope。这保证了 Scope 是 Structure 的"超集"，永远不会出现"Structure 引用了 Scope 未声明的内容"。

**为什么 Scope 不能是 Structure 的子集？** 因为 Scope 的职责是"划定范围"，它可能包含比 Structure 更宽泛的条目——比如 Scope 声明了 `Core/`，但 Structure 只展示了 Core 中的 `Metrics` 模块。Scope 是"允许的集合"，Structure 是"实际展示的集合"。倒过来（Structure ⊂ Scope）是自然成立的。

### 结论

| 维度 | 结论 |
|:----|:------|
| **关系** | 两个独立但互相约束的部分 |
| **约束** | **Structure ⊆ Scope**（Structure 的每个节点必须在 Scope 中） |
| **Assembler 规则** | 先确定 Scope → 再构建 Structure → 验证所有 Structure 节点在 Scope 中 |
| **边界情况** | 如果 Structure 需要中间节点，Assembler 必须将其加入 Scope，或调整 Structure 路径 |
| **违反后果** | 出现 Structure 节点不在 Scope 中 → Context Package 无效，Renderer 应标记 |

---

## 二、四模块 Spec 实施方案

### Builder Spec

**输入**：Repository 路径（本地文件系统路径）

**输出**：Repository Context（内部数据结构，非 Context Package）

```
Input:
  repo_path: string    # 本地路径，如 /home/user/project
  options?: {
    max_depth?: number          # 目录解析最大深度（默认 10）
    include_patterns?: string[] # 仅解析匹配的文件（默认 *.py, *.rs, *.ts, *.go, *.md）
    exclude_patterns?: string[] # 排除的路径（默认 node_modules, .git, __pycache__）
  }

Output:
  RepositoryContext {
    root: string                  # 仓库根路径
    modules: Module[]             # 解析出的模块列表
    signatures: Signature[]       # 函数/类/接口的签名与位置
    dependencies: Dependency[]    # 模块间依赖关系
    structures: Structure[]       # 层级结构信息
    files: FileEntry[]            # 文件元数据（路径、大小、行数）
    metadata: {
      total_files: number
      total_modules: number
      built_at: timestamp
      builder_version: string
    }
  }
```

**核心逻辑**：

- **一次解析，只做一件事**：Builder 不关心"问题"，只关心"仓库里有什么"。它扫描仓库，解析文件，提取模块定义、函数/类签名、模块间依赖关系、文件路径树。
- **不判断相关性**：Builder 是离线、无状态的。它不回答"这个模块是否相关"，只回答"这个模块叫什么、在哪、依赖谁"。
- **存储分离**：Builder 的输出（Repository Context）应持久化到文件或缓存中，供 Assembler 在线读取。格式可以是 JSON、SQLite、或 MessagePack。Builder 本身不负责"查询"。
- **增量更新**：Builder 应当支持增量解析——只扫描变更的文件，而不是每次全量重建。但增量更新是优化，不是语义要求。
- **技术中立**：AST、Tree-sitter、grep、正则、Git 分析都是内部实现细节。Builder 只要产出的 Repository Context 符合结构定义即可。

**关键设计决策**：

- Repository Context 是一个**事实数据库**，不包含任何"观点"（相关性、置信度等）。
- 每个 Module 包含：名称、路径、类型（文件/目录/类/函数）、父模块、子模块列表。
- 每个 Dependency 包含：源模块、目标模块、类型（import/call/extends/implements）、位置（文件、行号）。
- Builder 不负责计算置信度——那是 Assembler 的事。

---

### Assembler Spec

**输入**：Question + Repository Context

**输出**：Context Package（Scope / Structure / Evidence / Relation / Confidence）

```
Input:
  question: string                        # 用户问题，如 "Experiment 的 Metrics 是如何收集的？"
  repository_context: RepositoryContext   # Builder 产出的 Repository Context
  options?: {
    max_scope_modules?: number   # Scope 最大模块数（默认 20）
    max_evidence?: number        # 每条证据最多引用数（默认 5）
  }

Output:
  ContextPackage {
    scope: ScopeSection           # 涉及的范围
    structure: StructureSection   # 逻辑树
    evidence: EvidenceSection     # 可追溯证据
    relation: RelationSection     # 关系
    confidence: ConfidenceSection # 置信度
  }
```

**核心逻辑（按顺序执行）**：

1. **确定 Scope**：解析问题，识别出问题中提到的模块名、领域、功能区域。从 Repository Context 中匹配对应的模块。Scope 是一个**扁平集合**，格式为 `ModuleName[/SubModule]` 列表。
   - 使用关键词匹配 + 符号解析（如果问题提到 `Metrics`，匹配所有名为 `Metrics` 的模块）
   - Scope 可以包含"大范围"（如 `Core/`）和"具体模块"（如 `Metrics.Persistence`）
   - 如果问题模糊，Scope 可以包含多个候选范围，由 Confidence 标明优先级

2. **构建 Structure**：基于 Scope 中的模块，从 Repository Context 中提取这些模块的层级关系，构建一棵**逻辑树**。
   - **验证约束**：Structure 中的每个节点必须在 Scope 中。如果发现 Structure 路径包含不在 Scope 中的中间节点，必须：要么将该节点加入 Scope，要么调整路径绕过它。
   - 树的根是问题最相关的顶层模块（如 `Experiment`）
   - 树的边是"包含/调用/依赖"关系
   - 树只展示到合理深度（默认 3 层）

3. **匹配 Evidence**：从 Repository Context 中为 Structure 的每个节点匹配对应的实现证据。
   - Evidence = 文件路径 + 行号 + 代码片段摘要（不是完整代码）
   - 格式：`Claim → implemented in → source_file:line`
   - 每条 Evidence 对应一个模块的职责声明

4. **构建 Relation**：从 Repository Context 的 `dependencies` 中提取 Structure 中节点之间的连接关系。
   - Relation = 源模块 + 关系类型 + 目标模块 + 影响方向
   - 格式：`run_step() → updates → Edge → affects → Metrics`
   - 只包含 Structure 中节点之间的关系

5. **计算 Confidence**：为每个模块和每条 Evidence 计算置信度。
   - 置信度基于：引用数（代码引用、测试覆盖、文档提及）
   - 格式：`0.92 — 3 references, 2 tests, 1 README`
   - 如果某个模块没有测试覆盖，Confidence 降低

**Scope / Structure 边界处理**：

```
Assembler 流程中的 Scope-Structure 交互：

1. Parse question → 候选模块列表 M
2. 从 Repository Context 中匹配 M → 实际 Scope 集合 S
3. 从 Repository Context 中提取 S 中模块的层级关系 → 候选结构 T
4. 获取 T 中所有节点集合 N
5. 如果 N ⊈ S（即存在结构节点不在 Scope 中）：
   → 策略 A（默认）：将 N \ S 中的节点加入 Scope，扩展 S
   → 策略 B（保守）：从 T 中移除包含 N \ S 节点的路径，裁剪 T
   → 策略 C（严格）：标记为不一致，要求问题重述
6. 输出：S（Scope）+ T（Structure），满足 T ⊆ S
```

---

### Expander Spec

**输入**：Follow-up Question + 已有 Context Package + Repository Context

**输出**：扩展后的 Context Package

```
Input:
  follow_up_question: string         # 后续问题，如 "那 Persistence 是怎么写入的？"
  existing_context: ContextPackage   # 上次 Assemble 产出的 Context Package
  repository_context: RepositoryContext
  options?: {
    expansion_mode?: 'narrow' | 'broad'   # 窄扩展（只补缺失）或宽扩展（重新评估）
  }

Output:
  ContextPackage  # 包含原有内容 + 新增内容
```

**核心逻辑**：

- **增量优先**：Expander 不重新执行 Assembler 的全流程。它首先检查 follow-up question 是否在已有 Scope 内。
  - 如果在 Scope 内（如已有 `Metrics.Persistence`，追问 `Persistence.write()` 的实现细节）→ 只扩展 Evidence 和 Relation，不修改 Scope 和 Structure。
  - 如果在 Scope 外但相邻（如已有 `Experiment.Metrics`，追问 `Experiment.Orchestrator`）→ 扩展 Scope，加入新模块，更新 Structure 树，但保留已有的 Scope/Structure 不变。
  - 如果完全超出 Scope（如从 `Experiment` 跳到 `Core`）→ 触发重新 Assemble，但保留原有 Context 作为"历史参考"。

- **合并策略**：扩展后的 Context Package 是"增量叠加"——原有内容不变，新增内容追加。如果新旧 Evidence 冲突，保留两者并降低 Confidence。

- **Scope 扩展规则**：
  - 新 Scope = 旧 Scope ∪ 新发现的模块
  - 新 Structure = 旧 Structure 的树 + 新模块的子树（插入到对应父节点下）
  - 新 Evidence = 旧 Evidence + 新模块的 Evidence
  - 新 Relation = 旧 Relation + 新模块的 Relation（包括跨新旧模块的关系）
  - 新 Confidence = 重新计算受影响的模块，未受影响的模块 Confidence 保持不变

- **Expander 不重算全部**：这是一种优化，也是一种语义——Expander 认为"已有的 Context 仍然有效，只是不够完整"。

---

### Renderer Spec

**输入**：Context Package

**输出**：格式化的 Agent 可读文本

```
Input:
  context_package: ContextPackage     # Assembler 或 Expander 产出的 Context Package
  options?: {
    format?: 'compact' | 'verbose'    # 紧凑模式（默认）或详细模式
    max_depth?: number                # Structure 最大展示深度（默认 3）
    max_evidence_per_module?: number  # 每个模块最多展示证据数（默认 3）
    include_confidence?: boolean      # 是否展示置信度（默认 true）
  }

Output:
  formatted_text: string              # 格式化后的文本，Agent 可直接消费
```

**核心逻辑**：

- **五部分按顺序输出**，每部分用 `---` 分隔。输出格式对 Agent 友好——使用 Markdown 结构，但避免过度格式化。

- **Scope 部分**：
  - 输出格式：列表或路径形式
  - 示例：
    ```
    ## Scope
    - Experiment
    - Experiment.Metrics
    - Experiment.Metrics.Persistence
    - Core
    ```

- **Structure 部分**：
  - 输出格式：缩进树或 `→` 链
  - 示例：
    ```
    ## Structure
    Experiment
    ├── Orchestrator
    │   ├── run_step()
    │   └── schedule()
    ├── Metrics
    │   ├── Collector
    │   └── Persistence
    └── Config
    ```
  - 或紧凑模式：
    ```
    Experiment → Orchestrator → run_step()
    Experiment → Metrics → Collector
    Experiment → Metrics → Persistence
    ```

- **Evidence 部分**：
  - 输出格式：`Claim → Source:line` 三元组
  - 示例：
    ```
    ## Evidence
    - Metrics.Persistence 实现写入逻辑 → metrics.py:120
    - Metrics.Collector 收集性能数据 → collector.py:42
    - 测试覆盖写入路径 → test_metrics.py:88
    ```

- **Relation 部分**：
  - 输出格式：`Source → verb → Target` 三元组
  - 示例：
    ```
    ## Relation
    - run_step() → updates → Edge
    - Edge → affects → Metrics
    - Metrics.Persistence → writes → metrics.db
    ```

- **Confidence 部分**：
  - 输出格式：模块名 + 分数 + 理由
  - 示例：
    ```
    ## Confidence
    - Experiment.Orchestrator: 0.94 — 4 references, 2 tests
    - Experiment.Metrics: 0.88 — 3 references, 1 test, 1 README
    - Experiment.Metrics.Persistence: 0.75 — 2 references, 0 tests ⚠️
    ```

- **验证检查**：Renderer 在输出前应验证 Context Package 的完整性：
  - Scope 不为空
  - Structure 的每个节点在 Scope 中（否则标记 `⚠️ Structure node outside scope`）
  - 每条 Evidence 有对应的 Source 文件路径
  - 每条 Relation 的源和目标都在 Structure 中
  - 验证失败时不停止输出，但附带警告标记

- **Agent 友好**：Renderer 的输出应确保 Agent 可以**直接使用**，而不需要二次解析。这意味着：
  - 使用一致的缩进和分隔符
  - 避免歧义（如两个模块同名时附加路径）
  - 在紧凑模式下，一行只包含一个关系
  - 在详细模式下，可以包含简短的解释（1-2 句）

---

## 三、四模块数据流总图

```
                      ┌─────────────────────────────────────┐
                      │          Repository (Git)            │
                      └──────────┬──────────────────────────┘
                                 │
                                 ▼
                      ┌──────────────────┐
                      │     Builder      │  ← 离线，一次解析
                      │  (解析 + 索引)    │
                      └────────┬─────────┘
                               │
                               ▼
                      ┌──────────────────┐
                      │ Repository Context│  ← 持久化存储
                      │ (事实数据库)      │
                      └────────┬─────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
          ▼                    ▼                    ▼
   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
   │  Assembler   │    │   Expander   │    │   Expander   │
   │ (首次组装)    │    │ (增量扩展)    │    │ (超出范围时)  │
   │              │    │              │    │              │
   │ Question +   │    │ Follow-up +  │    │ 触发重新     │
   │ Context →    │    │ Old Pkg →    │    │ Assemble     │
   │ Context Pkg  │    │ Extended Pkg │    │ (保留历史)   │
   └──────┬───────┘    └──────┬───────┘    └──────┬───────┘
          │                   │                    │
          └───────────────────┼────────────────────┘
                              │
                              ▼
                     ┌────────────────┐
                     │   Renderer     │  ← 格式化
                     │ (Context Pkg   │
                     │  → 文本)       │
                     └────────┬───────┘
                              │
                              ▼
                     ┌────────────────┐
                     │  Agent 可读文本 │  ← 最终输出
                     └────────────────┘
```

---

## 四、总结

| 模块 | 输入 | 输出 | 核心职责 |
|:----|:-----|:-----|:---------|
| **Builder** | 仓库路径 | Repository Context | 解析仓库，提取事实，不判断相关性 |
| **Assembler** | 问题 + Repository Context | Context Package | 根据问题确定 Scope，组装五部分 |
| **Expander** | 追问 + 已有 Context Package | 扩展的 Context Package | 增量补充，不重新全量搜索 |
| **Renderer** | Context Package | 格式化文本 | 结构化输出，确保 Agent 可直接消费 |

**Scope 与 Structure 的边界规则**：Structure ⊆ Scope（结构节点必须在范围内）。Assembler 先 Scope 后 Structure，验证通过后输出。Expander 扩展 Scope 时同步更新 Structure。Renderer 输出前验证一致性。