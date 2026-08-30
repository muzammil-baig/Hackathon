import uuid
import tiktoken
from models import Chunk, ConversationMessage
from config import CHUNK_MAX_TOKENS, TIKTOKEN_ENCODING

_encoder = None

def get_encoder():
    global _encoder
    if _encoder is None:
        _encoder = tiktoken.get_encoding(TIKTOKEN_ENCODING)
    return _encoder


def count_tokens(text: str) -> int:
    return len(get_encoder().encode(text))


def chunk_messages(messages: list[ConversationMessage], conversation_id: str) -> list[Chunk]:
    """Group conversation messages into token-bounded chunks."""
    chunks = []
    current_msgs = []
    current_tokens = 0
    start_idx = 0

    for i, msg in enumerate(messages):
        msg_text = f"{msg.role.upper()}: {msg.text}"
        msg_tokens = count_tokens(msg_text)

        if current_tokens + msg_tokens > CHUNK_MAX_TOKENS and current_msgs:
            chunk_text = "\n\n".join(f"{m.role.upper()}: {m.text}" for m in current_msgs)
            chunks.append(Chunk(
                node_id=str(uuid.uuid4()),
                conversation_id=conversation_id,
                text=chunk_text,
                token_count=current_tokens,
                line_range=(start_idx, i - 1),
            ))
            current_msgs = [msg]
            current_tokens = msg_tokens
            start_idx = i
        else:
            current_msgs.append(msg)
            current_tokens += msg_tokens

    if current_msgs:
        chunk_text = "\n\n".join(f"{m.role.upper()}: {m.text}" for m in current_msgs)
        chunks.append(Chunk(
            node_id=str(uuid.uuid4()),
            conversation_id=conversation_id,
            text=chunk_text,
            token_count=current_tokens,
            line_range=(start_idx, len(messages) - 1),
        ))

    # Fallback: at least 1 chunk
    if not chunks and messages:
        all_text = "\n\n".join(f"{m.role.upper()}: {m.text}" for m in messages)
        chunks.append(Chunk(
            node_id=str(uuid.uuid4()),
            conversation_id=conversation_id,
            text=all_text,
            token_count=count_tokens(all_text),
            line_range=(0, len(messages) - 1),
        ))

    return chunks
