import uuid
import time
import logging
from config import get_api_key, QA_MODEL
from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = "You are an expert assistant with access to this user's conversation history."

QA_TEMPLATE = """Answer the question below using only the provided context.
- Be clear and concise
- Cite conversation sections when relevant ("Earlier, you mentioned…", "In the section about X…")
- Focus on the evolution of ideas and decisions over time
- If context is insufficient, say so and explain what's missing

Context:
{context_text}

Question: {query}

Answer:"""


async def answer_question(query: str, context_text: str, model: str = None) -> tuple[str, int]:
    """Returns (answer_text, latency_ms)."""
    model = model or QA_MODEL
    api_key = get_api_key()
    if not api_key:
        raise RuntimeError("No API key configured. Add ANTHROPIC_API_KEY in Settings.")

    chat = LlmChat(
        api_key=api_key,
        session_id=str(uuid.uuid4()),
        system_message=SYSTEM_PROMPT,
    ).with_model("anthropic", model)

    user_msg = QA_TEMPLATE.format(context_text=context_text, query=query)

    start = time.time()
    parts = []
    async for event in chat.stream_message(UserMessage(text=user_msg)):
        if isinstance(event, TextDelta):
            parts.append(event.content)
        elif isinstance(event, StreamDone):
            break

    latency_ms = int((time.time() - start) * 1000)
    return "".join(parts).strip(), latency_ms
