import hashlib
import logging
from config import CHROMA_DIR

logger = logging.getLogger(__name__)


class VectorStore:
    _instance = None

    def __init__(self):
        import chromadb
        from pathlib import Path
        Path(CHROMA_DIR).mkdir(parents=True, exist_ok=True)
        self.client = chromadb.PersistentClient(path=CHROMA_DIR)
        logger.info(f"ChromaDB initialized at {CHROMA_DIR}")

    @classmethod
    def get_instance(cls) -> "VectorStore":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _col_name(self, conversation_id: str) -> str:
        h = hashlib.md5(conversation_id.encode()).hexdigest()[:20]
        return f"c_{h}"

    def upsert_nodes(self, conversation_id: str, nodes: list[dict]):
        """Store TOPIC and CHUNK nodes (not ROOT) in vector DB."""
        col_name = self._col_name(conversation_id)
        collection = self.client.get_or_create_collection(name=col_name)

        ids, embeddings, documents, metadatas = [], [], [], []
        for node in nodes:
            if node.get("level") == "ROOT":
                continue  # ROOT is always retrieved directly
            if not node.get("embedding"):
                continue

            lr = node.get("line_range", (0, 0))
            ids.append(node["node_id"])
            embeddings.append(node["embedding"])
            documents.append(node["text"][:500])
            metadatas.append({
                "conversation_id": conversation_id,
                "node_id": node["node_id"],
                "level": node["level"],
                "token_count": node.get("token_count", 100),
                "line_range_start": int(lr[0]) if isinstance(lr, (list, tuple)) else 0,
                "line_range_end": int(lr[1]) if isinstance(lr, (list, tuple)) else 0,
                "parent_id": node.get("parent_id") or "",
                "topic_label": node.get("topic_label", ""),
            })

        if ids:
            collection.upsert(ids=ids, embeddings=embeddings, documents=documents, metadatas=metadatas)
            logger.info(f"Upserted {len(ids)} nodes for {conversation_id}")

    def query(self, conversation_id: str, query_embedding: list[float], top_k: int = 20) -> list[dict]:
        col_name = self._col_name(conversation_id)
        try:
            collection = self.client.get_collection(name=col_name)
        except Exception:
            return []

        count = collection.count()
        if count == 0:
            return []

        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=min(top_k, count),
            include=["distances", "metadatas", "documents"],
        )

        candidates = []
        if results and results["ids"] and results["ids"][0]:
            for i, node_id in enumerate(results["ids"][0]):
                meta = results["metadatas"][0][i]
                distance = results["distances"][0][i]
                similarity = max(0.0, 1.0 - distance)
                candidates.append({
                    "node_id": node_id,
                    "level": meta.get("level", "CHUNK"),
                    "text": (results["documents"][0][i] if results.get("documents") else ""),
                    "token_count": meta.get("token_count", 100),
                    "line_range": (meta.get("line_range_start", 0), meta.get("line_range_end", 0)),
                    "parent_id": meta.get("parent_id") or None,
                    "topic_label": meta.get("topic_label", ""),
                    "similarity": similarity,
                })
        return candidates

    def delete_conversation(self, conversation_id: str):
        col_name = self._col_name(conversation_id)
        try:
            self.client.delete_collection(col_name)
            logger.info(f"Deleted Chroma collection for {conversation_id}")
        except Exception:
            pass
