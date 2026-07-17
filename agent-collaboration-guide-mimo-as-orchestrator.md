# Project-Lens 本地多 Agent 协同与分工指南（MiMoCode 作为协调者版）

为了实现 Project-Lens V2 的 **"AI-First / Zero UI"** 求职演练闭环，我们打破了传统的单智能体或纯代码分析思路，引入了 **"本地多 Agent 协同"** 架构。

本指南以 **MiMoCode (mimo)** 作为最高层编排者 (Orchestrator)，协调 **`agy` (Antigravity/Gemini)** 作为核心实施者 (Implementer)，同时可调度 **`claude`** 和 **`codex`** 辅助完成精细任务。

---

## 一、 本地 AI 助手的命令行调用规范

### 1. `mimo` (MiMoCode) — 本方案的协调者

* **角色**：最高层编排器 (Orchestrator)，负责任务拆解、调度编排、结果聚合与用户交互。
* **特长**：本地研发任务生命周期追踪、多环境状态控制、轻量级 TUI 交互。
* **自身调用**（用于自检或内部任务）：
  ```bash
  $null | mimo run "你的指令" --dangerously-skip-permissions
  ```

### 2. `agy` (Antigravity/Gemini) — 本方案的核心实施者

* **角色**：核心执行者 (Implementer)，负责宏观架构提炼、高并发/缓存决策、代码亮点提取与简历文字润色。
* **特长**：宏观架构理解、高并发/缓存决策提炼、简历级亮点文字润色、系统级防御性设计。
* **非交互式调用命令**：
  ```bash
  # PowerShell 格式（需先设置代理环境变量）
  $env:http_proxy = "http://127.0.0.1:10808"
  $env:https_proxy = "http://127.0.0.1:10808"
  $null | agy -p "你的指令"

  # 带超时控制的完整调用
  $env:http_proxy = "http://127.0.0.1:10808"
  $env:https_proxy = "http://127.0.0.1:10808"
  $null | agy -p --print-timeout 5m "你的指令"
  ```

  *(注：`agy -p` 等同于 `--print`，运行单次 prompt 并打印响应后自动退出。通过 `-p` 调用可绕过 TUI 交互。)*

* **Python SDK 调用方式**（适用于需要更精细控制的场景）：
  ```python
  import asyncio
  from google.antigravity import Agent, LocalAgentConfig, CapabilitiesConfig

  async def call_agy(prompt: str):
      config = LocalAgentConfig(
          system_instructions="You are a code analysis expert.",
          capabilities=CapabilitiesConfig(),
      )
      async with Agent(config) as agent:
          response = await agent.chat(prompt)
          result = ""
          async for token in response:
              result += token
          return result
  ```

### 3. `claude` (Claude Code) — 精细代码分析辅助

* **特长**：精细代码阅读、小步快跑的代码重构、细节 Bug 修复与校验。
* **非交互式调用命令**：
  ```bash
  claude -p "你的指令"
  ```

### 4. `codex` (Codex CLI / LongCat-2.0) — 技术亮点提炼辅助

* **特长**：宏观架构理解、高并发/缓存决策提炼、简历级亮点文字润色。
* **非交互式调用命令**：
  ```bash
  $null | codex exec "你的指令" --skip-git-repo-check
  ```

---

## 二、 角色定位与协作拓扑

### MiMoCode 作为协调者的核心职责

1. **任务拆解**：将用户的自然语言请求拆解为可执行的子任务
2. **调度编排**：决定哪些任务交给 `agy` 执行，哪些需要 `claude`/`codex` 辅助
3. **代理环境管理**：在调用 `agy` 前设置 `$env:http_proxy` 和 `$env:https_proxy`
4. **结果聚合**：收集各实施者的输出，合并为最终交付物
5. **错误处理与重试**：监控子进程超时与异常，执行重试逻辑
6. **用户交互**：向用户展示进度、收集反馈、呈现最终结果

### agy 作为实施者的核心职责

1. **宏观架构提炼**：从代码库中提取核心架构亮点
2. **技术贡献描述**：生成简历级的技术贡献叙事
3. **防御性设计评审**：对架构方案进行容错性评估
4. **高并发/缓存决策**：提炼并发设计、缓存策略等关键技术决策
5. **简历文字润色**：将技术亮点转化为简历级别的专业表述

---

## 三、 调用 agy 的标准协议

### 3.1 环境准备（必须步骤）

在调用 `agy` 之前，**必须**设置代理环境变量以确保网络连通性：

```powershell
# PowerShell 调用模板
$env:http_proxy = "http://127.0.0.1:10808"
$env:https_proxy = "http://127.0.0.1:10808"

# 执行 agy 命令
$null | agy -p "你的指令"
```

### 3.2 任务指令模板

#### 模板 A：代码亮点提炼

```powershell
$env:http_proxy = "http://127.0.0.1:10808"
$env:https_proxy = "http://127.0.0.1:10808"
$null | agy -p "请深度阅读以下代码目录，提炼出最核心的并发/缓存/架构设计亮点，并以结构化 JSON 格式输出。JSON Schema: { project_name: string, highlights: Array<{ title: string, description: string, tech_stack: string[], impact: string }> }  代码目录: <path>"
```

#### 模板 B：技术贡献润色

```powershell
$env:http_proxy = "http://127.0.0.1:10808"
$env:https_proxy = "http://127.0.0.1:10808"
$null | agy -p "请将以下技术要点润色为简历级别的专业描述，要求：1) 突出量化指标 2) 体现技术深度 3) 控制在 2-3 句话内。技术要点: <points>"
```

#### 模板 C：架构评审

```powershell
$env:http_proxy = "http://127.0.0.1:10808"
$env:https_proxy = "http://127.0.0.1:10808"
$null | agy -p "请对以下架构方案进行防御性评审，识别潜在的容错风险、性能瓶颈和改进建议，并以结构化格式输出。架构描述: <description>"
```

### 3.3 超时与错误处理

```powershell
# 设置 5 分钟超时（默认值）
$env:http_proxy = "http://127.0.0.1:10808"
$env:https_proxy = "http://127.0.0.1:10808"
$null | agy -p --print-timeout 5m "你的指令"

# 超时后重试逻辑（在 mimo 中实现）
# 1. 捕获超时错误
# 2. 记录失败任务
# 3. 降级策略：使用 claude -p 或 codex exec 替代
```

---

## 四、 多 Agent 协同分工矩阵（MiMoCode 协调者版）

### 协同拓扑图

```
                           ┌──────────────────────────┐
                           │      用户 / MiMoCode     │
                           │      (协调者 Orchestrator)│
                           └─────────────┬────────────┘
                                         │ 任务拆解与调度 (P0)
                                         ▼
                           ┌──────────────────────────┐
                           │    LocalAgentBridge      │
                           │  (代理环境: proxy 10808)  │
                           └──────┬────────────┬──────┘
                                  │            │
             调用 (P1) agy 执行    │            │  调用 (P2) claude/codex 辅助
    ┌────────────────────────────┘            └───────────────────────────┐
    ▼                                                                     ▼
┌──────────────┐                                                     ┌───────────┐
│   agy        │                                                     │  claude   │
│  (实施者)    │                                                     │  codex    │
└──────┬───────┘                                                     └─────┬─────┘
       │ 提炼核心技术画像 JSON + 简历润色                                     │ 精细代码分析与重构校验
       ▼                                                                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                              resume.json                                 │
└─────────────────────────────────────┬────────────────────────────────────┘
                                      │ Nunjunks + Typst (P3)
                                      ▼
                               ┌─────────────┐
                               │  resume.pdf │
                               └─────────────┘
```

### 1. 开发期分工 (Development Phase)

| Agent | 职责 | 调用方式 |
|:---|:---|:---|
| **`mimo` (协调者)** | 搭建 CLI 骨架、项目持久化目录 (`~/.lens/`) 管理、代理环境配置、任务调度引擎 | 内部自检: `mimo run` |
| **`agy` (实施者)** | 实现 `LocalAgentBridge` 多进程编排、JSON Schema 定义与校验、防御性自我修复 Pipeline | `$env:proxy + agy -p` |
| **`claude`** | 实现 MCP Server 的 Stdio 传输协议、集成 Nunjucks ➜ Typst 编译管道 | `claude -p` |
| **`codex`** | 辅助宏观架构提炼、高并发决策分析 | `codex exec` |

### 2. 运行时分工 (Runtime Phase)

| Agent | 职责 | 调用方式 |
|:---|:---|:---|
| **`mimo` (协调者)** | **总指挥**，负责与用户打交道、任务调度、结果聚合、错误处理 | 内部自检: `mimo run` |
| **`agy` (实施者)** | **核心执行者**：扫描代码目录，提炼技术亮点 JSON，润色简历级描述 | `$env:proxy + agy -p` |
| **`claude`** | **精细抛光**：针对 `agy` 找出的技术要点，到对应的具体代码行进行深度分析 | `claude -p` |
| **`codex`** | **辅助提炼**：宏观架构理解、技术栈决策总结 | `codex exec` |

---

## 五、 完整调用流程示例

### 场景：用户请求"分析项目亮点，生成简历"

**Step 1: MiMoCode 接收用户请求，拆解任务**

```
用户: "帮我分析当前项目，把亮点加进我的简历，并生成一份 PDF 给我预览。"
```

**Step 2: MiMoCode 设置环境并调用 agy 进行代码亮点提炼**

```powershell
$env:http_proxy = "http://127.0.0.1:10808"
$env:https_proxy = "http://127.0.0.1:10808"
$null | agy -p "请深度阅读当前目录代码，提炼出最核心的并发/缓存/架构设计亮点并以 JSON 输出"
```

**Step 3: MiMoCode 调用 claude 对 agy 的输出进行精细校验**

```powershell
claude -p "请校验以下 JSON 中的技术描述是否与实际代码实现一致，标记不准确的条目"
```

**Step 4: MiMoCode 调用 agy 润色简历文字**

```powershell
$env:http_proxy = "http://127.0.0.1:10808"
$env:https_proxy = "http://127.0.0.1:10808"
$null | agy -p "请将以下技术亮点润色为简历级专业描述，控制在 2-3 句话内，突出量化指标"
```

**Step 5: MiMoCode 组装 resume.json 并触发渲染**

```
lens-resume-builder build --input resume.json --output ./dist/
```

**Step 6: MiMoCode 向用户交付**

```
"简历已更新！已生成 dist/resume.pdf"
```

---

## 六、 关键优势（相比原方案）

1. **代理可控**：MiMoCode 统一管理 `$env:http_proxy` / `$env:https_proxy`，避免各 Agent 独立管理代理配置的混乱。
2. **生命周期追踪**：MiMoCode 内置任务系统 (`task` 工具)，可精确追踪每个子任务的进度、状态与依赖关系。
3. **渐进式降级**：当 `agy` 超时或失败时，MiMoCode 可自动降级到 `claude -p` 或 `codex exec` 替代执行。
4. **结果聚合**：MiMoCode 负责合并多个 Agent 的输出，消除重复、冲突，生成一致的最终交付物。
5. **持久化状态**：利用 `~/.claude/projects/<project>/memory/` 实现跨会话的任务进度持久化。

---

## 七、 注意事项

1. **代理环境变量**：每次调用 `agy` 前**必须**重新设置 `$env:http_proxy` 和 `$env:https_proxy`，因为子进程不会继承上一次设置。
2. **超时控制**：`agy -p` 默认 5 分钟超时，复杂任务建议通过 `--print-timeout` 显式设置。
3. **输出解析**：`agy` 的输出可能包含 Markdown code block 标记（如 ` ```json ... ``` `），MiMoCode 需在聚合时做清洗。
4. **错误重试**：建议最多重试 2 次，仍失败则降级到 `claude -p` 或 `codex exec`。
