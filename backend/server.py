import os
import sys
import asyncio
import logging
import time
from pathlib import Path
from typing import Any

ROOT_DIR = Path(__file__).parent
sys.path.insert(0, str(ROOT_DIR))

from fastapi import FastAPI, APIRouter, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pydantic import BaseModel

load_dotenv(ROOT_DIR / ".env")
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── Try to import heavy RAPTOR modules (requires ML packages) ──────────────
RAPTOR_READY = False
try:
    from models import IndexRequest, IndexResponse, QueryRequest, QueryResponse
    from ingestion.tree_builder import build_tree
    from ingestion.chunker import count_tokens
    from retrieval.searcher import search_similar_nodes
    from retrieval.node_selector import select_nodes, is_multihop_query, select_multihop
    from retrieval.context_assembler import assemble_context
    from retrieval.qa import answer_question
    from store.vector_store import VectorStore
    import store.index_store as index_store
    from config import get_api_key
    RAPTOR_READY = True
    logger.info("RAPTOR modules loaded successfully")
except ImportError as e:
    logger.warning(f"RAPTOR modules not available yet: {e}")
    # Minimal fallback models
    class IndexRequest(BaseModel):
        conversation_id: str
        messages: list[Any] = []
        options: dict = {}
    class IndexResponse(BaseModel):
        conversation_id: str
        status: str
        stats: dict = {}
    class QueryRequest(BaseModel):
        conversation_id: str
        query: str
        token_budget: int = 4000
        model: str = "claude-sonnet-4-6"
    class QueryResponse(BaseModel):
        answer: str
        nodes_used: list = []
        token_counts: dict = {}
        latency_ms: int = 0

# MongoDB (keep existing env)
mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
mongo_client = AsyncIOMotorClient(mongo_url)
db = mongo_client[os.environ.get("DB_NAME", "test_database")]

app = FastAPI(title="ConvoMemory RAPTOR API")
api_router = APIRouter(prefix="/api")

# In-memory indexing status tracker
indexing_status: dict[str, dict] = {}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    if RAPTOR_READY:
        index_store.load()
        await asyncio.to_thread(VectorStore.get_instance)
    logger.info(f"ConvoMemory backend started (RAPTOR_READY={RAPTOR_READY})")


@app.on_event("shutdown")
async def shutdown():
    mongo_client.close()


# ── Health ──────────────────────────────────────────────────────────────────
@api_router.get("/health")
async def health():
    return {"status": "ok", "raptor_ready": RAPTOR_READY}


# ── Index ───────────────────────────────────────────────────────────────────
async def run_indexing(request: IndexRequest):
    conv_id = request.conversation_id
    try:
        if not get_api_key():
            indexing_status[conv_id] = {
                "status": "error",
                "progress": "No API key. Add ANTHROPIC_API_KEY in Settings.",
            }
            return

        indexing_status[conv_id] = {"status": "indexing", "progress": "Chunking messages..."}
        tree = await build_tree(request.messages, conv_id)

        indexing_status[conv_id]["progress"] = "Storing embeddings in vector DB..."
        nodes_list = []
        for node in tree.nodes.values():
            d = node.model_dump() if hasattr(node, "model_dump") else dict(node)
            nodes_list.append(d)

        vs = VectorStore.get_instance()
        await asyncio.to_thread(vs.upsert_nodes, conv_id, nodes_list)

        index_store.set_tree(conv_id, tree)

        indexing_status[conv_id] = {
            "status": "indexed",
            "progress": "Complete",
            "stats": tree.stats,
        }
        logger.info(f"Indexed {conv_id}: {tree.stats}")

    except Exception as e:
        logger.error(f"Indexing failed for {conv_id}: {e}", exc_info=True)
        indexing_status[conv_id] = {"status": "error", "progress": str(e)}


@api_router.post("/index", response_model=IndexResponse)
async def index_conversation(request: IndexRequest, background_tasks: BackgroundTasks):
    if not RAPTOR_READY:
        raise HTTPException(503, "ML packages not installed yet. Please wait ~1 minute and retry.")
    conv_id = request.conversation_id
    indexing_status[conv_id] = {"status": "indexing", "progress": "Starting..."}
    background_tasks.add_task(run_indexing, request)
    return IndexResponse(conversation_id=conv_id, status="indexing", stats={})


# ── Status ───────────────────────────────────────────────────────────────────
@api_router.get("/status/{conversation_id}")
async def get_status(conversation_id: str):
    if RAPTOR_READY:
        tree = index_store.get(conversation_id)
        if tree:
            return {"status": "indexed", "stats": tree.stats, "progress": "Complete"}
    status = indexing_status.get(conversation_id, {"status": "not_indexed"})
    return status


# ── Query ────────────────────────────────────────────────────────────────────
@api_router.post("/query", response_model=QueryResponse)
async def query_conversation(request: QueryRequest):
    if not RAPTOR_READY:
        raise HTTPException(503, "ML packages not installed yet.")

    conv_id = request.conversation_id
    tree = index_store.get(conv_id)
    if not tree:
        raise HTTPException(404, f"Conversation '{conv_id}' not indexed")

    start_time = time.time()

    root = tree.nodes.get(tree.root_id)
    if not root:
        raise HTTPException(500, "Root node not found in tree")

    root_dict = root.model_dump() if hasattr(root, "model_dump") else dict(root)
    root_dict["similarity"] = 1.0

    # Retrieve candidates
    if is_multihop_query(request.query):
        raw_candidates = await search_similar_nodes(conv_id, request.query, top_k=15)
        topic_cands = [c for c in raw_candidates if c["level"] in ("SECTION", "TOPIC")]
        matched_ids = [c["node_id"] for c in topic_cands[:3]]
        multihop_chunks = select_multihop(tree, matched_ids) if matched_ids else []
        candidates = raw_candidates + multihop_chunks
    else:
        candidates = await search_similar_nodes(conv_id, request.query, top_k=20)

    selected, is_fallback = select_nodes(candidates, root_dict, request.token_budget)

    # Enrich with full text from tree
    enriched = []
    for sel in selected:
        node = tree.nodes.get(sel["node_id"])
        if node:
            d = node.model_dump() if hasattr(node, "model_dump") else dict(node)
            d["similarity"] = sel.get("similarity", 0.0)
            enriched.append(d)
        else:
            enriched.append(sel)

    context_text = assemble_context(enriched)
    answer, latency_ms = await answer_question(request.query, context_text, request.model)

    if is_fallback:
        answer += "\n\n*Note: Limited context found for this query.*"

    context_tokens = count_tokens(context_text)
    answer_tokens = count_tokens(answer)
    estimated_raw = tree.stats.get("estimated_raw_tokens", 0)
    reduction_pct = max(0, int((1 - context_tokens / max(1, estimated_raw)) * 100)) if estimated_raw else 0
    total_latency = int((time.time() - start_time) * 1000)

    nodes_used = [
        {
            "node_id": n["node_id"],
            "level": n["level"],
            "similarity": round(n.get("similarity", 0), 3),
            "token_count": n.get("token_count", 0),
            "line_range": list(n.get("line_range", [0, 0])),
            "topic_label": n.get("topic_label", ""),
        }
        for n in enriched
    ]

    return QueryResponse(
        answer=answer,
        nodes_used=nodes_used,
        token_counts={
            "context_tokens": context_tokens,
            "token_budget": request.token_budget,
            "answer_tokens": answer_tokens,
            "estimated_raw_tokens": estimated_raw,
            "reduction_pct": reduction_pct,
            "latency_ms": total_latency,
        },
        latency_ms=total_latency,
    )


# ── Delete ────────────────────────────────────────────────────────────────────
@api_router.delete("/index/{conversation_id}", status_code=204)
async def delete_index(conversation_id: str):
    if RAPTOR_READY:
        index_store.delete(conversation_id)
        vs = VectorStore.get_instance()
        await asyncio.to_thread(vs.delete_conversation, conversation_id)
    indexing_status.pop(conversation_id, None)
    return None


# ── Tree structure (for dashboard) ────────────────────────────────────────────
@api_router.get("/tree/{conversation_id}")
async def get_tree(conversation_id: str):
    if not RAPTOR_READY:
        raise HTTPException(503, "ML packages not installed yet.")
    tree = index_store.get(conversation_id)
    if not tree:
        raise HTTPException(404, f"Conversation '{conversation_id}' not found")

    nodes_out = {}
    for node_id, node in tree.nodes.items():
        d = node.model_dump() if hasattr(node, "model_dump") else dict(node)
        d.pop("embedding", None)  # Strip large vectors from response
        nodes_out[node_id] = d

    return {
        "conversation_id": tree.conversation_id,
        "root_id": tree.root_id,
        "nodes": nodes_out,
        "stats": tree.stats,
    }


# ── Conversations list ─────────────────────────────────────────────────────────
@api_router.get("/conversations")
async def list_conversations():
    if not RAPTOR_READY:
        return []
    return index_store.get_all_stats()


# ── Settings ──────────────────────────────────────────────────────────────────
class SettingsUpdate(BaseModel):
    api_key: str = ""

@api_router.post("/settings")
async def update_settings(data: SettingsUpdate):
    key = data.api_key.strip()
    if key:
        os.environ["ANTHROPIC_API_KEY"] = key
        env_path = ROOT_DIR / ".env"
        lines = env_path.read_text().splitlines()
        new_lines, updated = [], False
        for line in lines:
            if line.startswith("ANTHROPIC_API_KEY="):
                new_lines.append(f"ANTHROPIC_API_KEY={key}")
                updated = True
            else:
                new_lines.append(line)
        if not updated:
            new_lines.append(f"ANTHROPIC_API_KEY={key}")
        env_path.write_text("\n".join(new_lines) + "\n")
    return {"status": "ok"}


@api_router.get("/settings")
async def get_settings():
    key = os.environ.get("ANTHROPIC_API_KEY", "") or os.environ.get("EMERGENT_LLM_KEY", "")
    has_key = bool(key.strip())
    preview = (key[:8] + "...") if has_key else ""
    is_emergent = key.startswith("sk-emergent")
    return {
        "has_api_key": has_key,
        "key_preview": preview,
        "is_emergent_key": is_emergent,
        "raptor_ready": RAPTOR_READY,
    }


# ── Legacy status endpoint (keep existing) ────────────────────────────────────
@api_router.get("/")
async def root():
    return {"message": "ConvoMemory RAPTOR API", "raptor_ready": RAPTOR_READY}


app.include_router(api_router)
