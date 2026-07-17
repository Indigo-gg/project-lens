我觉得这里要区分**"Agent 需要什么能力"**和**"Project-Lens 应该实现什么能力"**。

这是两个完全不同的问题，也是很多 MCP 项目最后越做越重的原因。

---

## 我建议用一个判断原则

假设未来 Claude Code 5（或者其他 Agent）已经非常强。

它会：

* 会写简历
* 会润色
* 会分析 JD
* 会模拟面试
* 会制定学习计划

那么你的 Project-Lens 还能剩下什么价值？

如果答案是：

> 啥也没剩下。

说明你的项目是在和 Agent 抢工作。

如果答案是：

> 没有 Lens，Agent 根本不知道代码里面发生了什么。

那说明你的定位就是正确的。

---

# 所以我建议重新定义产品

不要定义成功能。

而定义成：

> **Project-Lens = Career Intelligence Engine**

注意不是

> Resume Builder

也不是

> Interview Agent

而是

> Career Intelligence Engine

---

这个定义会改变很多事情。

例如：

用户：

> 帮我投 OpenAI。

Claude：

```
调用 Lens：

分析项目

↓

提取Evidence

↓

读取我的个人信息

↓

读取JD

↓

分析Gap

↓

生成简历

↓

模拟面试
```

整个过程中

真正思考的是 Claude。

Lens只是提供：

**可信的数据。**

---

# 那是不是就不要JD分析？

我的答案是：

**要。**

但是不要做：

```
JD分析Agent
```

而应该做：

```
JD Parser
```

区别非常大。

例如

JD：

```
熟悉Redis

熟悉高并发

熟悉微服务

熟悉K8s
```

Lens负责：

```json
{
  "requirements":[
    {
      "id":"redis",
      "type":"technology"
    },
    {
      "id":"microservice",
      "type":"architecture"
    }
  ]
}
```

Agent负责：

```
Redis满足。

微服务满足。

K8s不足。

建议这么写。
```

---

所以：

JD不是分析。

JD应该：

**结构化。**

---

# Gap Analysis呢？

我觉得：

应该做。

但是仍然不要：

```
你应该学习K8s。
```

而是：

```
Capability Graph

↓

Project Evidence

↓

JD Requirement

↓

Matching Matrix
```

例如：

```json
{
  "redis":0.92,
  "kafka":0.81,
  "k8s":0.18
}
```

Agent看到以后：

```
建议补K8s。
```

---

所以：

Gap是数据。

建议是Agent。

---

# Resume Editor呢？

这是我觉得最容易越界的地方。

因为：

编辑

本质就是：

Reasoning。

例如：

用户：

```
删掉这一段。
```

Claude天然会。

为什么还需要Lens？

---

但是：

Resume Schema

我认为要。

例如：

```json
Resume

↓

Experience

↓

Projects

↓

Education

↓

Skills
```

Lens负责：

Schema。

Agent负责：

编辑。

---

真正需要的是：

```
resume.json
```

不是：

```
Resume GUI
```

---

# 我甚至建议整个项目所有模块重新分类。

---

## 第一类：

### Intelligence

这是Lens真正应该做的。

例如：

```
analyze_project

extract_evidence

build_decision_trace

analyze_git

measure_metrics

parse_jd

extract_requirements

build_capability_graph

match_capabilities

search_evidence

verify_statement

diff_projects
```

这些全部都是：

Knowledge。

---

## 第二类：

### Artifact

就是：

各种结构化对象。

例如：

```
project.json

resume.json

jd.json

capability.json

interview.json
```

全部都是：

Artifact。

---

## 第三类：

### Utility

例如：

```
Typst

PDF

Markdown

HTML

Snapshot

Cache
```

这些都是：

Infrastructure。

---

第四类我建议不要有。

---

例如：

```
Interview Agent

Resume Agent

Career Planner

Mock Interview
```

全部删掉。

Agent已经有。

---

# 那有没有一些值得新增的能力？

我反而觉得有几个。

而且价值很高。

---

## 第一：

Statement Verification

Agent：

```
我准备写：

优化了缓存性能。
```

Lens：

```
Evidence：

Benchmark

Commit

Redis

Latency

Confidence 0.94
```

如果没有：

直接告诉Agent：

```
Evidence不足。
```

这是未来最值钱的。

---

## 第二：

Evidence Search

例如：

```
找所有和性能有关的Evidence
```

或者：

```
找所有和可扩展性有关的Evidence
```

Agent非常需要。

---

## 第三：

Capability Extraction

例如：

不是：

Redis。

而是：

```
Caching

Consistency

Distributed Coordination

API Design

Performance Optimization
```

这些不是建议。

只是：

Capability。

---

## 第四：

Decision Timeline

Agent最喜欢。

例如：

```
什么时候引入Redis？

为什么？

后来为什么又改？

```

直接返回。

---

## 第五：

Repository Memory

这是我认为最大的机会。

未来Agent上下文有限。

Lens可以：

```
把整个仓库

压缩成

Knowledge Package
```

Agent一句：

```
load_project_context()
```

就完成了。

---

# 还有一个我建议你改变的思路

你现在一直在问：

> **Project-Lens 应该有哪些功能？**

我觉得真正的问题应该变成：

> **一个 AI 求职 Agent，在完成任务过程中，会缺哪些信息？**

比如以"根据 JD 生成简历"为例，我们把流程拆开：

| Agent 的阶段 | Agent 缺什么     | Lens 应该提供                                |
| --------- | ------------- | ---------------------------------------- |
| 理解项目      | 不知道代码里做了什么    | 项目事实、Evidence、Decision Trace             |
| 理解 JD     | 不知道招聘要求的结构    | JD Parser、Requirement Schema             |
| 判断匹配      | 不知道哪些能力对应哪些证据 | Capability Matching Matrix               |
| 写简历       | 害怕编造          | Statement Verification                   |
| 模拟面试      | 不知道哪些地方值得深挖   | Decision Timeline、Architecture Evolution |

注意这里有一个共同点：

**Lens 提供的是"信息"，不是"结论"。**

---

## 如果让我重新定义 Project-Lens V4，我会把一句话改成：

> **Project-Lens is a Career Intelligence Layer for AI Agents.**

不是：

> AI Resume Builder

也不是：

> AI Interview Assistant

而是：

> **一个专门把代码、简历、JD 和职业信息统一转换成结构化、可验证知识的 MCP 工具层。**

这样一来，无论未来是 Claude、Codex、Gemini，还是你自己写的 Agent，它们都可以围绕同一套能力工作，而 Project-Lens 的价值不会随着 Agent 变强而下降，反而会因为 Agent 更依赖高质量、可验证的上下文而变得更加重要。
