import json
import logging
import os
from pathlib import Path
from models import RAPTORTree, Chunk, SummaryNode
from config import INDEX_STORE_FILE, DATA_DIR

logger = logging.getLogger(__name__)
_trees: dict[str, RAPTORTree] = {}


def _ensure_dir():
    Path(DATA_DIR).mkdir(parents=True, exist_ok=True)


def save():
    _ensure_dir()
    data = {}
    for conv_id, tree in _trees.items():
        nodes_dict = {}
        for node_id, node in tree.nodes.items():
            d = node.model_dump() if hasattr(node, "model_dump") else dict(node)
            nodes_dict[node_id] = d
        data[conv_id] = {
            "conversation_id": tree.conversation_id,
            "root_id": tree.root_id,
            "nodes": nodes_dict,
            "stats": tree.stats,
        }
    with open(INDEX_STORE_FILE, "w") as f:
        json.dump(data, f)
    logger.info(f"Saved {len(data)} trees to index store")


def load():
    global _trees
    if not os.path.exists(INDEX_STORE_FILE):
        return
    try:
        with open(INDEX_STORE_FILE, "r") as f:
            data = json.load(f)

        for conv_id, tree_dict in data.items():
            nodes = {}
            for node_id, nd in tree_dict.get("nodes", {}).items():
                if nd.get("level") == "CHUNK":
                    nodes[node_id] = Chunk(**nd)
                else:
                    nodes[node_id] = SummaryNode(**nd)
            _trees[conv_id] = RAPTORTree(
                conversation_id=tree_dict["conversation_id"],
                root_id=tree_dict["root_id"],
                nodes=nodes,
                stats=tree_dict.get("stats", {}),
            )
        logger.info(f"Loaded {len(_trees)} trees from index store")
    except Exception as e:
        logger.error(f"Failed to load index store: {e}")


def get(conversation_id: str) -> RAPTORTree | None:
    return _trees.get(conversation_id)


def set_tree(conversation_id: str, tree: RAPTORTree):
    _trees[conversation_id] = tree
    save()


def delete(conversation_id: str):
    _trees.pop(conversation_id, None)
    save()


def list_all() -> list[str]:
    return list(_trees.keys())


def get_all_stats() -> list[dict]:
    return [
        {"conversation_id": cid, "stats": tree.stats}
        for cid, tree in _trees.items()
    ]
