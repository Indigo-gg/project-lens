# Project-Lens

**Project Knowledge Layer for AI Agents**

> Lens maintains *project knowledge*. Agent maintains *career knowledge*.
>
> Lens answers **What Exists**. Agent answers **What It Means**.

**Version 6.0** — Redesigned with clear tool responsibilities

---

## What is Project-Lens?

Project-Lens is a tool that scans your codebase and turns it into a structured, queryable knowledge index -- facts, evidence, and decision history -- that AI agents can use to reason about your project.

Think of it as a **"grounding layer"** between your raw code and an AI coding assistant like Claude Code. Instead of asking the agent to read thousands of files, Lens pre-processes the project into a compact, ranked, evidence-backed knowledge package that the agent can search and verify against.

## Why?

AI agents are great at understanding intent, but they struggle with **project-scale context**:

- They can't hold 100K lines of code in context at once.
- They don't know which functions are battle-tested vs. experimental.
- They can't tell whether a claim about the codebase ("we optimized Redis caching") is actually backed by code and commit history.

Project-Lens solves this by:

1. **Extracting** structural facts from your code (functions, classes, modules).
2. **Binding** evidence to those facts (git history, tests, benchmarks).
3. **Ranking** facts by importance and recency.
4. **Exporting** a compact project snapshot that fits inside an agent's context window.
5. **Verifying** claims against actual code evidence.

## Core Architecture

```
+-------------------------------------------------------+
|                   AI Agent (Claude)                    |
|            "What does this mean for the JD?"           |
+--------------+----------------------+-----------------+
               | MCP Protocol         |
+--------------v----------------------v-----------------+
|                  Project-LENS                         |
|                                                     |
|  +-----------+  +----------+  +------------------+  |
|  | Extractor |->|  Store   |->|  Query & Ranking |  |
|  | (AST + Git)|  |(SQLite+FTS)|  | (Evidence Score)|  |
|  +-----------+  +----------+  +------------------+  |
|  +-----------+  +----------+  +------------------+  |
|  |  Verify   |  | Snapshot |  |  Render (PDF)    |  |
|  |(Confidence)|  |(Export)  |  |  (Typst)         |  |
|  +-----------+  +----------+  +------------------+  |
+-------------------------------------------------------+
```

## The 6 Tools

### 1. observe — Build the Index

Scans a project and builds a knowledge index: facts (functions, classes, modules), edges (relationships), and evidence (git commits, tests).

```bash
lens observe --path ./my-project
```

### 2. explore — Explore Project Knowledge

Explores project knowledge and provides navigation paths. Answers "how does this feature work?"

```bash
lens explore "authentication" --category security --limit 10
```

Results are ranked by credibility and importance:

```
Credibility = 0.3*benchmark + 0.3*test_coverage + 0.2*documentation + 0.2*git_history
Importance = 0.4*connectivity + 0.3*modification_frequency + 0.3*recency
```

### 3. trace — Decision History

Understands decision history, traces why something was implemented. Answers "why was this done this way?"

```bash
lens trace "Redis" --limit 10
lens trace --fact-id 123
```

### 4. verify — Statement Verification

Verifies whether a claim has supporting code evidence. Use it to validate resume bullets, PR descriptions, or design docs against reality.

```
Input:  "Optimized Redis caching performance"
Output: { confidence: 0.82, evidence: [...], unsupportedParts: [] }
```

### 5. snapshot — Project Snapshot

Exports the entire project knowledge package in under 50K tokens -- small enough to fit in an agent's context window. Includes key facts, recent decisions, and top evidence, with full commit history intentionally omitted.

```bash
lens snapshot --format compact --max-tokens 50000
```

### 6. render — PDF Rendering

Renders JSON data to PDF using Typst.

## How It Works

### Step 1: Extract Facts

Lens parses source code using [Tree-sitter](https://tree-sitter.github.io/) (via WASM -- no native compilation needed) to extract functions, classes, interfaces, and modules. Each becomes a **Fact** in the knowledge graph.

### Step 2: Bind Evidence

Facts are enriched with evidence from your git history and test files:

- **Git commits** -> evolution evidence (who changed this, how often, how recently)
- **Test coverage** -> quality evidence (is this code tested?)
- **Benchmarks** -> performance evidence (are there perf claims?)
- **Dependencies** -> architectural evidence (what does this connect to?)

### Step 3: Rank and Query

All evidence is scored using a weighted formula and stored in SQLite with FTS5 full-text search. When an agent queries, it gets back ranked results -- not raw file dumps.

### Step 4: Snap and Verify

The agent can export a compact snapshot for broad understanding, or verify specific claims against code evidence. This is the core loop: **claim -> verify -> trust**.

## Installation

```bash
npm install project-lens
```

## Quick Start

```bash
# 1. Index your project
lens observe --path ./my-project

# 2. Explore project knowledge
lens explore "database migration" --limit 5

# 3. Trace decision history
lens trace "Redis" --limit 10

# 4. Export a snapshot for your AI agent
lens snapshot --format compact

# 5. Start the MCP server (for Claude Code integration)
lens serve
```

## Integration with AI Agents

Project-Lens exposes all 6 tools through the [Model Context Protocol](https://modelcontextprotocol.io/) (MCP). Connect it to Claude Code, Cursor, or any MCP-compatible agent:

```json
{
  "mcpServers": {
    "project-lens": {
      "command": "lens",
      "args": ["serve"]
    }
  }
}
```

Once connected, the agent can search your project's knowledge graph, verify statements against code evidence, and export compact project snapshots -- all without reading raw files.

## Design Principles

| Principle | Meaning |
|:--|:--|
| **Lens answers What Exists** | Lens deals with facts: code structure, commit history, test coverage. It does not interpret what those facts mean for a job application or business decision. |
| **Agent answers What It Means** | The AI agent takes Lens's facts and evidence and interprets them in context: "This Redis optimization is relevant to the JD because..." |
| **Evidence over Opinion** | Every fact has evidence. Every claim can be verified. No hallucination, no guessing. |
| **Compact by Design** | Snapshots fit in context windows. Ranking surfaces what matters. Less noise, more signal. |

## Supported Languages

- TypeScript / JavaScript
- Python
- Go

More languages can be added by writing Tree-sitter .scm query files.

## Roadmap

- [x] V6 architecture redesign (6 tools, clear responsibilities)
- [x] Credibility + Importance dual scoring
- [x] Decision trace as independent tool
- [x] Navigation paths
- [ ] PDF rendering improvements (Typst)
- [ ] Additional language support (Rust, Java, C#)
- [ ] CI/CD integration (auto-index on push)
- [ ] Web UI for exploring the knowledge graph

## License

MIT
