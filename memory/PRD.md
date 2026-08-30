# ConvoMemory — RAPTOR Memory Layer PRD

**Last Updated:** February 2026  
**Status:** MVP Complete

---

## Problem Statement
Users lose context in long AI chats because platforms either drop old messages or compress everything into one blunt summary. ConvoMemory fixes this with a RAPTOR-style summary tree: the conversation is chunked, clustered, and summarized bottom-up into a 3-level hierarchy (CHUNK → TOPIC → ROOT). At query time, a token-budget-aware retrieval engine selects the optimal mix of levels and packages them into ≤4,000 tokens of structured context.

---

## Architecture

### Components
1. **Chrome Extension (Manifest V3)** — `/app/extension/`
   - `manifest.json` — MV3, host_permissions for claude.ai
   - `content.js` — DOM extraction from claude.ai, badge injection
   - `background.js` — service worker, fetch relay, polling
   - `popup.html/js/styles.css` — multi-state popup UI

2. **FastAPI Backend** — `/app/backend/` (port 8001, /api prefix)
   - `server.py` — all endpoints + background indexing tasks
   - `config.py` — env vars, model names, constants
   - `models.py` — Pydantic models (exact spec)
   - `ingestion/` — chunker, embedder, clusterer, summarizer, tree_builder
   - `retrieval/` — searcher, node_selector, context_assembler, qa
   - `store/` — vector_store (ChromaDB), index_store (JSON persistence)

3. **React Dashboard** — `/app/frontend/src/`
   - Dashboard, IndexPage, TreeView, QueryPage, Settings
   - NavBar with health indicator
   - SVG RAPTOR tree visualization with framer-motion

### Storage
- **ChromaDB** — local disk persistence at `/app/backend/data/chroma/`
- **Index Store** — in-memory dict + JSON at `/app/backend/data/index_store.json`
- **MongoDB** — existing env (not used for RAPTOR, kept for compatibility)

---

## Core Requirements (Static)

### LOCKED CONSTRAINTS
- Platform: claude.ai only (extension)
- Backend: port 8001, /api prefix, FastAPI
- Embeddings: all-MiniLM-L6-v2 (384-dim), sentence-transformers
- Clustering: K-Means k=3–5 (scikit-learn)
- Vector DB: ChromaDB (local disk)
- Token counting: tiktoken cl100k_base
- Summarization model: claude-haiku-4-5-20251001
- Q&A model: claude-sonnet-4-6
- Token budget: 4,000 total (500 ROOT + 1,500 TOPIC + 2,000 CHUNK)

### API Endpoints
- `POST /api/index` → async indexing with background task
- `POST /api/query` → retrieval + LLM answer
- `GET /api/status/{id}` → indexing progress
- `DELETE /api/index/{id}` → remove conversation
- `GET /api/health` → health check
- `GET /api/tree/{id}` → tree structure for visualization
- `GET /api/conversations` → list all indexed
- `GET/POST /api/settings` → API key management

---

## What's Been Implemented

### ✅ MVP Complete (Feb 2026)
- Full RAPTOR pipeline: chunk → embed → cluster → summarize → ROOT
- Async background indexing with polling
- Token-budget-aware node selection (exact spec algorithm)
- Multi-hop query detection and chronological retrieval
- Context assembly with structured format (OVERVIEW/SECTIONS/DETAILS)
- ChromaDB vector storage with per-conversation collections
- JSON persistence for index store (survives restarts)
- Chrome Extension MV3: manifest, content script, background service worker, popup with all UI states
- Web Dashboard: Dashboard, Index, Tree View, Query, Settings pages
- SVG tree visualization with ROOT/TOPIC/CHUNK nodes + bezier edges
- Token bar with reduction % display
- Emergent Universal Key configured by default (sk-emergent-...)
- IBM Plex Mono/Sans fonts, dark theme (#050505), purple/indigo/emerald nodes

---

## P0/P1/P2 Backlog

### P0 (Critical for production)
- [ ] Test with real large conversations (5K+ lines) to validate 60s indexing target
- [ ] Extension: test DOM extraction on current claude.ai DOM structure
- [ ] Incremental indexing (update tree when new messages arrive)

### P1 (High value)
- [ ] Streaming Q&A responses (SSE) for better UX
- [ ] Export/import tree as JSON for sharing
- [ ] Multiple model selection in web dashboard
- [ ] Better chunking strategy (semantic boundaries, not just token count)

### P2 (Nice to have)
- [ ] Multi-platform support (ChatGPT, Gemini)
- [ ] Cross-session memory (persistent across browser restarts)
- [ ] Team memory features
- [ ] RAPTOR tree diff (show what changed between versions)

---

## Test Conversations
- `test-demo-1` — 4 messages about RAPTOR (small demo)
- `test-index-flow` — 12 messages about ML (created by testing agent)
- `ml-recommendation-system` — **52 messages (17K raw tokens)** — Production ML recommendation system: FAISS ANN, tiered caching, EKS, daily retraining, cold start, fairness, A/B testing. **5 topics, 49 chunks, 76% reduction**
- `fintech-data-platform` — **44 messages (14.9K raw tokens)** — Modern fintech data platform: Kafka/Flink, Apache Iceberg, dbt, ClickHouse, ML platform, data governance. **5 topics, 42 chunks, 73% reduction**
- `cloud-security-fintech` — **24 messages (10.6K raw tokens)** — Cloud security program: PCI-DSS CDE isolation, zero trust IAM, WAF, SIEM, incident response, compliance. **5 topics, 24 chunks, 62% reduction**
- `fintech-architecture-complete` — **110 messages (37.7K raw tokens)** — Complete fintech platform: ML + data platform + security. **5 topics, 105 chunks, 89-91% reduction** ← FLAGSHIP DEMO

## New Features (Feb 2026 update)
- **Compare Page** (`/compare`): Side-by-side RAPTOR vs Full Raw context comparison. Both queries run concurrently. Shows token meters, reduction %, speed delta, and side-by-side answers.
- **Markdown Renderer** (`MarkdownRenderer.jsx`): Custom renderer for ##headers, **bold**, `code`, lists, tables, code blocks. Answers render as polished reports.
- **Large Conversation Demo**: `fintech-architecture-complete` — 110 messages, 37.7K tokens → **91% token reduction** (3,368 context / 38,482 raw)
