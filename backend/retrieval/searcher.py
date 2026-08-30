import asyncio
import logging
from store.vector_store import VectorStore
from ingestion.embedder import encode_single

logger = logging.getLogger(__name__)


async def search_similar_nodes(
    conversation_id: str, query: str, top_k: int = 20
) -> list[dict]:
    """Embed query and search Chroma for similar TOPIC + CHUNK nodes."""
    query_embedding = await asyncio.to_thread(encode_single, query)
    vs = VectorStore.get_instance()
    results = await asyncio.to_thread(vs.query, conversation_id, query_embedding, top_k)
    return results
