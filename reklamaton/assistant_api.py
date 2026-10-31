"""Sales-chat replies through the OpenAI Responses API.

Chat used to run on the Assistants API (threads + runs). OpenAI removed that API on 2026-08-26,
so replies now come from `client.responses.create`. The conversation history is the app's own
`Message` table: every turn sends the persona/sales instructions plus the most recent messages,
with `store=False`, so nothing about the conversation is kept on OpenAI's side by this call.
"""
import os
import uuid
from typing import Any, Iterable, Iterator, Optional

from openai import OpenAI

# NOTE: do NOT call load_dotenv() here; main.py already does it.
# Keep this module import-safe even when OPENAI_API_KEY is missing.


class OpenAIConfigError(RuntimeError):
    pass


def _env(name: str, default: Optional[str] = None) -> Optional[str]:
    v = os.getenv(name)
    return v if v not in (None, "") else default


# The old variable names still work, so an existing .env keeps its model choice.
CHAT_MODEL = _env("OPENAI_CHAT_MODEL", _env("OPENAI_ASSISTANT_MODEL", "gpt-5-mini"))
CHAT_FALLBACK_MODEL = _env("OPENAI_CHAT_FALLBACK_MODEL", _env("OPENAI_ASSISTANT_FALLBACK_MODEL", "gpt-4o"))

# Upper bound on the history sent with each turn: keeps the cost of one request bounded.
HISTORY_LIMIT = int(_env("CHAT_HISTORY_LIMIT", "20"))

_client: Optional[OpenAI] = None


def llm_configured() -> bool:
    return _env("OPENAI_API_KEY") is not None


def _get_client() -> OpenAI:
    global _client
    if _client is not None:
        return _client
    key = _env("OPENAI_API_KEY")
    if not key:
        raise OpenAIConfigError("OPENAI_API_KEY is not set")
    _client = OpenAI(api_key=key)
    return _client


def new_conversation_id() -> str:
    """Local id stored in ChatSession.thread_id. Refuses up front when chat cannot work."""
    if not llm_configured():
        raise OpenAIConfigError("OPENAI_API_KEY is not set")
    return f"local-{uuid.uuid4().hex}"


def build_input(history: Iterable[Any], user_msg: str) -> list[dict]:
    """Recent chat messages (oldest first) plus the new user message, as Responses API input items."""
    items: list[dict] = []
    for m in history:
        role = getattr(m, "role", None)
        content = getattr(m, "content", None)
        if role in ("user", "assistant") and content:
            items.append({"role": role, "content": str(content)})
    items = items[-HISTORY_LIMIT:] if HISTORY_LIMIT > 0 else []
    items.append({"role": "user", "content": user_msg})
    return items


def _output_text(resp: Any) -> str:
    text = getattr(resp, "output_text", None)
    if text:
        return str(text).strip()
    chunks: list[str] = []
    for item in getattr(resp, "output", None) or []:
        for part in getattr(item, "content", None) or []:
            t = getattr(part, "text", None)
            if t:
                chunks.append(str(t))
    return "".join(chunks).strip()


def chat_reply(instructions: str, history: Iterable[Any], user_msg: str) -> str:
    """Blocking reply. Tries the configured model, then the fallback model."""
    c = _get_client()
    items = build_input(history, user_msg)
    last_error: Optional[Exception] = None
    for model in dict.fromkeys((CHAT_MODEL, CHAT_FALLBACK_MODEL)):
        try:
            resp = c.responses.create(model=model, instructions=instructions, input=items, store=False)
        except Exception as e:  # unsupported model, rate limit, network: try the next model
            last_error = e
            continue
        text = _output_text(resp)
        if text:
            return text
        last_error = RuntimeError("empty reply")
    raise RuntimeError("chat model call failed") from last_error


def chat_reply_stream(instructions: str, history: Iterable[Any], user_msg: str) -> Iterator[str]:
    """Streaming reply: yields text deltas. Raises if the model reports a failure."""
    c = _get_client()
    items = build_input(history, user_msg)
    stream = c.responses.create(model=CHAT_MODEL, instructions=instructions, input=items, store=False, stream=True)
    for event in stream:
        etype = getattr(event, "type", None)
        if etype == "response.output_text.delta":
            delta = getattr(event, "delta", "")
            if delta:
                yield delta
        elif etype in ("response.failed", "error"):
            raise RuntimeError("chat model call failed")
        elif etype == "response.completed":
            break
