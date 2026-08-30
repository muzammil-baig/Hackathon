from config import (
    TOKEN_BUDGET_SECTION,
    TOKEN_BUDGET_CHUNK,
    SIMILARITY_THRESHOLD,
    FALLBACK_MIN_CANDIDATES,
    MULTIHOP_KEYWORDS,
)


def select_nodes(
    candidates: list[dict], root_node: dict, token_budget: int = 4000
) -> tuple[list[dict], bool]:
    """Token-budget-aware node selection. Returns (selected, is_fallback)."""
    selected = [root_node]
    remaining = token_budget - root_node["token_count"]

    section_candidates = [n for n in candidates if n["level"] in ("SECTION", "TOPIC")]
    chunk_candidates = [n for n in candidates if n["level"] == "CHUNK"]

    # Fill section slot
    section_budget = min(TOKEN_BUDGET_SECTION, remaining)
    section_used = 0
    for node in section_candidates:
        if section_used + node["token_count"] <= section_budget:
            selected.append(node)
            section_used += node["token_count"]
    remaining -= section_used

    # Fill chunk slot — prefer chunks whose parent topic was selected
    chunk_budget = min(TOKEN_BUDGET_CHUNK, remaining)
    chunk_used = 0
    selected_ids = {n["node_id"] for n in selected}
    chunk_candidates.sort(
        key=lambda n: (n.get("parent_id") not in selected_ids, -n["similarity"])
    )
    for node in chunk_candidates:
        if chunk_used + node["token_count"] <= chunk_budget:
            selected.append(node)
            chunk_used += node["token_count"]

    # Fallback check
    high_sim = [c for c in candidates if c["similarity"] > SIMILARITY_THRESHOLD]
    is_fallback = len(high_sim) < FALLBACK_MIN_CANDIDATES

    return selected, is_fallback


def is_multihop_query(query: str) -> bool:
    query_lower = query.lower()
    return any(kw in query_lower for kw in MULTIHOP_KEYWORDS)


def select_multihop(tree, matched_topic_ids: list[str]) -> list[dict]:
    """For multi-hop: return all chunks under matched topics sorted chronologically."""
    nodes = tree.nodes
    chunks = []
    for topic_id in matched_topic_ids:
        topic = nodes.get(topic_id)
        if topic is None:
            continue
        child_ids = (
            topic.children_ids
            if hasattr(topic, "children_ids")
            else topic.get("children_ids", [])
        )
        for cid in child_ids:
            chunk = nodes.get(cid)
            if chunk is None:
                continue
            d = chunk.model_dump() if hasattr(chunk, "model_dump") else dict(chunk)
            d["similarity"] = 1.0
            chunks.append(d)

    chunks.sort(
        key=lambda n: n["line_range"][0] if isinstance(n["line_range"], (list, tuple)) else 0
    )
    return chunks
