# Project-Lens

**Project Understanding Layer for AI Agents**

> Lens maintains *project knowledge*. Agent maintains *career knowledge*.
>
> Lens answers **What Exists**. Agent answers **What It Means**.

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

\\\
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
\\\

## The 5 Tools

### 1. nalyze_project -- Build the Index

Scans a project and builds a knowledge index: facts (functions, classes, modules), edges (relationships), and evidence (git commits, tests, benchmarks).

\\\ash
lens analyze --path ./my-project
\\\

### 2. search_evidence -- Universal Search

The single search entry point for all queries. Supports keyword search, category filtering, requirement matching (auto-expands "Redis" to ["redis", "ioredis", "cache", "pub/sub", "session"]), and decision trace lookup.

\\\ash
lens search "authentication" --category security --limit 10
lens search --requirement "Redis"
\\\

Results are ranked by a composite evidence score:

\\\
Score = 0.25*Benchmark + 0.20*Tests + 0.20*GitEvolution
     + 0.10*LOC + 0.15*Recency + 0.10*Complexity
\\\

This means Lens knows that a function with benchmark tests, recent commits, and high complexity is more significant than an untouched utility.

### 3. erify_statement -- Truth Check

Verifies whether a claim has supporting code evidence. Use it to validate resume bullets, PR descriptions, or design docs against reality.

\\\
Input:  "Optimized Redis caching performance"
Output: { confidence: 0.82, evidence: [...], unsupportedParts: [] }
\\\

### 4. export_snapshot -- Compact Project Snapshot

Exports the entire project knowledge package in under 50K tokens -- small enough to fit in an agent's context window. Includes key facts, recent decisions, and top evidence, with full commit history intentionally omitted.

\\\ash
lens snapshot --format compact --max-tokens 50000
\\\

### 5. ender_resume -- Render to PDF

Takes a structured resume JSON and renders it to PDF using Typst.

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

\\\ash
npm install project-lens
\\\

## Quick Start

\\\ash
# 1. Index your project
lens analyze --path ./my-project

# 2. Search for evidence
lens search "database migration" --limit 5

# 3. Export a snapshot for your AI agent
lens snapshot --format compact

# 4. Start the MCP server (for Claude Code integration)
lens serve
\\\

## Integration with AI Agents

Project-Lens exposes all 5 tools through the [Model Context Protocol](https://modelcontextprotocol.io/) (MCP). Connect it to Claude Code, Cursor, or any MCP-compatible agent:

\\\json
{
  "mcpServers": {
    "project-lens": {
      "command": "lens",
      "args": ["serve"]
    }
  }
}
\\\

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

- [x] V5 architecture redesign (5 tools, unified search)
- [x] Fact extraction via Tree-sitter
- [x] Git evidence binding with ranking
- [x] Statement verification with confidence scoring
- [x] Compact snapshot export with token budgeting
- [ ] PDF resume rendering (Typst)
- [ ] Additional language support (Rust, Java, C#)
- [ ] CI/CD integration (auto-index on push)
- [ ] Web UI for exploring the knowledge graph

## License

MIT
