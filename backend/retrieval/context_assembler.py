def assemble_context(selected_nodes: list[dict]) -> str:
    """Assemble structured context string from selected RAPTOR nodes."""
    root_nodes = [n for n in selected_nodes if n["level"] == "ROOT"]
    section_nodes = [n for n in selected_nodes if n["level"] in ("SECTION", "TOPIC")]
    chunk_nodes = [n for n in selected_nodes if n["level"] == "CHUNK"]

    parts = []

    if root_nodes:
        parts.append("=== CONVERSATION OVERVIEW ===")
        parts.append(root_nodes[0]["text"])

    if section_nodes:
        parts.append("\n=== RELEVANT SECTIONS ===")
        for sec in section_nodes:
            lr = sec.get("line_range", [0, 0])
            label = sec.get("topic_label", "Section")
            if isinstance(lr, (list, tuple)) and len(lr) >= 2:
                parts.append(f"--- {label} (Lines {lr[0]}–{lr[1]}) ---")
            else:
                parts.append(f"--- {label} ---")
            parts.append(sec["text"])

    if chunk_nodes:
        parts.append("\n=== RELEVANT DETAILS ===")
        for chunk in chunk_nodes:
            lr = chunk.get("line_range", [0, 0])
            if isinstance(lr, (list, tuple)) and len(lr) >= 2:
                parts.append(f"--- Lines {lr[0]}–{lr[1]} ---")
            parts.append(chunk["text"])

    return "\n".join(parts)
