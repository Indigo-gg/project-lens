# Project-Lens Constitution v1.0

> **Version**: 1.0 | **Date**: 2026-07-17 | **Status**: 冻结
>
> **一句话定位**: Project-Lens is a Project Understanding Engine for AI Agents. It reduces the cognitive cost of exploring, understanding, and verifying large codebases. Career-related tasks such as resume generation, JD matching, and interview simulation are implemented as Skills built on top of Project-Lens, not inside it.

---

## 核心原则

在设计任何新模块、修改现有功能、或评估一个 Tool 是否应该存在时，必须通过以下宪法检验。

---

## 第一条：唯一目标

> **降低 Agent 理解大型项目的成本。**

这不是：

- 生成简历
- 分析 JD
- 模拟面试
- 提供职业建议

这些全部属于上层 Skill。Lens 永远只负责：

> **把代码转换成 Agent 更容易理解的知识。**

### 检验问题

1. 这个功能是在帮助 Agent 更好地理解项目吗？
2. 如果删除它，Agent 对项目理解能力会明显下降吗？

**两个答案都必须是 Yes，否则应该放到上层 Skill。**

---

## 第二条：所有输出必须来源于项目

Lens 的任何输出都必须能够追溯到：

- Code（代码）
- Git（提交历史）
- Test（测试）
- Benchmark（基准测试）
- Documentation（文档）

不能凭空推断。

### 正确示例

```
Redis 被引入于：
  commit abc123
  原因：fix session bottleneck
```

### 错误示例

```
这是缓存优化能力
```

因为这是解释（Interpretation），不是事实（Fact）。

### 检验问题

1. 这个输出能追溯到具体的代码、Git 提交、测试或文档吗？
2. 如果没有证据支撑，它是不是在凭空推断？

---

## 第三条：Lens 不理解职业

职业属于 Agent。

### 示例

JD 要求：需要 Redis

Lens 不应该说：你符合 80%

Lens 应该回答：

```
项目中找到：
  Redis
  ioredis
  pub/sub
  session

对应 Evidence：
  ...
```

Agent 自己判断是否满足 JD。

### 检验问题

1. 这个功能是否涉及"匹配度"、"符合度"、"推荐"等职业判断？
2. Agent 是否能自己完成这个判断？

**如果 Agent 能自己做，Lens 就不应该做。**

---

## 第四条：Lens 提供的是 Exploration，不是 Answer

Lens 不应该只会 Search。应该帮助 Agent 探索项目。

### 示例

Agent：我想理解 Authentication

Lens：

```
Authentication
    ↓
JWT
    ↓
Middleware
    ↓
Permission
    ↓
User Service
    ↓
Database
```

这不是回答。这是 Exploration。

### 检验问题

1. 这个功能是提供一个"答案"，还是提供一条"探索路径"？
2. Agent 能否基于这个输出继续深入探索？

---

## 第五条：任何工具都必须回答一个问题

这是判断工具是否应该存在的方法。

### 正确示例

**Tool**: `search_evidence()`

**回答**: 哪些事实相关？

✅ 成立

---

**Tool**: `verify_statement()`

**回答**: 这句话是真的吗？

✅ 成立

---

### 错误示例

**Tool**: `extract_capabilities()`

**回答**: Redis 是不是缓存能力？

❌ 这个已经开始解释，违反 Constitution。

### 检验问题

1. 这个工具在回答什么具体问题？
2. 这个问题是否属于"What Exists"范畴？
3. Agent 能否自己回答这个问题？

---

## 第六条：Lens 不产生职业 Artifact

Lens 不产生以下内容：

- Resume
- Interview Questions
- Career Plan
- Matching Scores
- Capability Labels

Lens 只产生：

- Project Snapshot
- Knowledge Graph
- Evidence
- Fact
- Decision Trace

### 检验问题

1. 这个输出是否包含"职业"语义？
2. 这个输出是否需要 Agent 的判断才能产生？

---

## 第七条：Skill 建立在 Lens 上

Skill 通过调用 Lens 获取数据，然后由 Agent 完成职业判断。

### 正确架构

```
Interview Skill
    ↓
调用 Lens
    ↓
获取 Decision Trace + Evidence
    ↓
Agent 生成问题
```

### 错误架构

```
Lens
    ↓
直接生成面试问题
```

### 检验问题

1. 这个功能是 Skill 还是 Lens 的核心能力？
2. 如果是 Skill，它是否正确地调用了 Lens 而不是自己实现？

---

## 第八条：Evidence Ranking 必须可拆分

Evidence Ranking 有两个维度，必须分开：

### Credibility Score（可信度）

- Benchmark：有 benchmark evidence
- Test：有 test evidence
- Documentation：有文档说明
- Git：有提交历史

### Importance Score（重要程度）

- 核心模块：入口文件、高频调用
- 连接度：边数量多
- 修改频繁：commit 次数多
- 时效性：最近有修改

Agent 自己决定用哪个 Score，Lens 不要合成一个。

### 检验问题

1. Ranking 是否混合了不同维度？
2. Agent 能否独立使用每个维度？

---

## 工具清单（V6 冻结）

### 核心工具（4 个）

| Tool | 职责 | 回答的问题 |
|:---|:---|:---|
| `observe()` | 扫描项目，建立索引 | 这个项目里有什么？ |
| `explore()` | 探索项目知识 | 某个功能在项目里怎么走？ |
| `trace()` | 理解决策历史 | 为什么这样实现？ |
| `verify()` | 验证断言 | 这句话有代码证据吗？ |

### 辅助工具（2 个）

| Tool | 职责 | 回答的问题 |
|:---|:---|:---|
| `snapshot()` | 导出项目知识包 | 整个项目是什么样的？ |
| `render()` | 渲染 PDF | 如何把 JSON 变成 PDF？ |

### 不存在的工具

| Tool | 原因 |
|:---|:---|
| `match_capabilities()` | 违反第三条：Lens 不理解职业 |
| `extract_capabilities()` | 违反第二条：这是 Interpretation |
| `parse_jd()` | Agent 能自己读 JD |
| `render_resume()` | 应该是 Skill，不是 Lens |

---

## 评估清单

在设计新模块或修改现有功能时，逐项检查：

### 必须通过（否则拒绝）

- [ ] 是否回答一个具体问题？
- [ ] 是否帮助 Agent 理解项目？
- [ ] 输出是否可追溯到 Code/Git/Test/Doc？
- [ ] 是否避免 Interpretation？

### 建议通过（否则讨论）

- [ ] 是否提供 Exploration 而不只是 Answer？
- [ ] Agent 能否自己完成这个任务？
- [ ] 是否混合了多个职责？
- [ ] 是否属于 Skill 层而不是 Lens 层？

---

## 违规示例

### 违反第一条：目标偏移

❌ 新增 `career_advisor()` 工具，分析用户的职业发展路径

✅ 这应该是 Skill 的职责，不是 Lens

### 违反第二条：凭空推断

❌ 输出 `Redis 用于缓存优化`，没有代码证据

✅ 输出 `Redis 出现在 src/cache.ts:15，commit abc123 引入`

### 违反第三条：职业判断

❌ 输出 `候选人具备高并发处理能力，评分 85%`

✅ 输出 `项目中找到：async, queue, mutex, lock 共 47 处 Evidence`

### 违反第四条：提供 Answer

❌ 输出 `项目使用了 Redis 缓存`

✅ 输出 `Redis 相关文件：src/cache.ts, src/session.ts, src/queue.ts`

### 违反第五条：工具职责不清

❌ `search_evidence()` 同时支持全文搜索、需求扩展、决策追踪、分页排序

✅ 拆分为 `explore()`、`trace()`、`verify()` 各自职责清晰

### 违反第六条：职业 Artifact

❌ 新增 `generate_resume()` 功能

✅ 这应该是 Resume Skill 调用 Lens 获取 Evidence 后完成

### 违反第七条：层级错误

❌ Lens 直接生成面试问题

✅ Interview Skill 调用 `trace()` 获取决策历史，Agent 生成问题

### 违反第八条：Ranking 混合

❌ `Score = 0.3×Benchmark + 0.2×Git + 0.2×LOC + ...`

✅ `credibility: { benchmark, test, docs }` + `importance: { centrality, frequency, recency }`

---

## 附录：V5 → V6 变更

| 变化 | V5 | V6 | 原因 |
|:---|:---|:---|:---|
| 工具数量 | 5 个 | **6 个** | 拆分职责更清晰 |
| Tool 命名 | search_evidence | **explore** | 更准确描述 Exploration |
| Tool 命名 | verify_statement | **verify** | 简化 |
| Tool 命名 | export_snapshot | **snapshot** | 简化 |
| Tool 命名 | render_resume | **render** | 简化 |
| Tool 命名 | analyze_project | **observe** | 更符合 Observe 流程 |
| 新增 | - | **trace** | 独立决策追踪，不再藏在 search_evidence |
| Ranking | 单一 Score | **Credibility + Importance** | 拆分不同维度 |
| Requirement Expansion | 自动扩展 | **Agent 负责** | Agent 能自己扩展 |

---

## 最终检验

> **如果删除一个功能，Agent 对项目理解能力会明显下降吗？**
>
> **如果答案是否定的，这个功能就应该放到上层 Skill。**
>
> 这是 Project-Lens 的边界检验标准。
