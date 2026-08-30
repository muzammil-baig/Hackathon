import uuid
import asyncio
import logging
from models import Chunk, SummaryNode, RAPTORTree, ConversationMessage
from ingestion.chunker import chunk_messages, count_tokens
from ingestion.embedder import encode_batch
from ingestion.clusterer import cluster_embeddings
from ingestion.summarizer import summarize_cluster, summarize_topics

logger = logging.getLogger(__name__)


async def build_tree(messages: list[ConversationMessage], conversation_id: str) -> RAPTORTree:
    logger.info(f"Building RAPTOR tree for {conversation_id} ({len(messages)} messages)")

    # Step 1: Chunk messages
    chunks = chunk_messages(messages, conversation_id)
    logger.info(f"Created {len(chunks)} chunks")

    # Step 2: Embed chunks (thread to avoid blocking event loop)
    chunk_texts = [c.text for c in chunks]
    embeddings = await asyncio.to_thread(encode_batch, chunk_texts)
    for i, chunk in enumerate(chunks):
        chunk.embedding = embeddings[i]

    # Step 3: Cluster
    labels = await asyncio.to_thread(cluster_embeddings, embeddings)

    cluster_groups: dict[int, list[Chunk]] = {}
    for chunk, label in zip(chunks, labels):
        cluster_groups.setdefault(label, []).append(chunk)

    logger.info(f"Created {len(cluster_groups)} clusters")

    # Step 4: Summarize each cluster concurrently → TOPIC nodes
    cluster_items = sorted(cluster_groups.items())
    summary_tasks = [
        summarize_cluster("\n\n".join(c.text for c in grp), max_tokens=200)
        for _, grp in cluster_items
    ]
    summaries = await asyncio.gather(*summary_tasks)

    topic_nodes: list[SummaryNode] = []
    for (label, cluster_chunks), summary in zip(cluster_items, summaries):
        line_ranges = [c.line_range for c in cluster_chunks]
        min_line = min(r[0] for r in line_ranges)
        max_line = max(r[1] for r in line_ranges)

        topic_node = SummaryNode(
            node_id=str(uuid.uuid4()),
            conversation_id=conversation_id,
            level="TOPIC",
            text=summary,
            token_count=count_tokens(summary),
            line_range=(min_line, max_line),
            children_ids=[c.node_id for c in cluster_chunks],
            topic_label=f"Topic {label + 1}",
        )

        # Embed topic node
        topic_emb = await asyncio.to_thread(encode_batch, [summary])
        topic_node.embedding = topic_emb[0]

        # Set parent_id on chunks
        for chunk in cluster_chunks:
            chunk.parent_id = topic_node.node_id

        topic_nodes.append(topic_node)

    # Step 5: Create ROOT node
    topics_text = "\n\n".join(
        f"=== {t.topic_label} ===\n{t.text}" for t in topic_nodes
    )
    root_summary = await summarize_topics(topics_text, max_tokens=400)

    root_node = SummaryNode(
        node_id=str(uuid.uuid4()),
        conversation_id=conversation_id,
        level="ROOT",
        text=root_summary,
        token_count=count_tokens(root_summary),
        line_range=(0, len(messages) - 1),
        parent_id=None,
        children_ids=[t.node_id for t in topic_nodes],
        topic_label="ROOT",
    )
    root_emb = await asyncio.to_thread(encode_batch, [root_summary])
    root_node.embedding = root_emb[0]

    # Step 6: Assemble tree
    nodes: dict = {}
    nodes[root_node.node_id] = root_node
    for topic in topic_nodes:
        nodes[topic.node_id] = topic
    for chunk in chunks:
        nodes[chunk.node_id] = chunk

    estimated_raw_tokens = sum(c.token_count for c in chunks)

    tree = RAPTORTree(
        conversation_id=conversation_id,
        root_id=root_node.node_id,
        nodes=nodes,
        stats={
            "total_messages": len(messages),
            "total_chunks": len(chunks),
            "total_topics": len(topic_nodes),
            "total_nodes": len(nodes),
            "estimated_raw_tokens": estimated_raw_tokens,
            "root_tokens": root_node.token_count,
        },
    )

    logger.info(
        f"RAPTOR tree built: {len(nodes)} nodes, "
        f"{estimated_raw_tokens} raw tokens, {len(topic_nodes)} topics"
    )
    return tree
