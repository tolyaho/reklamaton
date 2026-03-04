import os
import time
from typing import Iterator, Optional, Any

from openai import OpenAI

# NOTE: do NOT call load_dotenv() here; main.py already does it.
# Keep this module import-safe even when OPENAI_API_KEY is missing.


class OpenAIConfigError(RuntimeError):
    pass


def _env(name: str, default: Optional[str] = None) -> Optional[str]:
    v = os.getenv(name)
    return v if v not in (None, "") else default


# If you set ASSISTANT_ID in env, it will be used; otherwise we create one lazily.
ASSISTANT_ID: Optional[str] = _env("ASSISTANT_ID")

# Recommended defaults for roleplay/chat:
# - try gpt-5-mini first (good quality/cost)
# - fallback to gpt-4o if the model is not supported by Assistants in your account
ASSISTANT_MODEL = _env("OPENAI_ASSISTANT_MODEL", "gpt-5-mini")
ASSISTANT_FALLBACK_MODEL = _env("OPENAI_ASSISTANT_FALLBACK_MODEL", "gpt-4o")

POLL_DELAY_SEC = float(_env("OPENAI_RUN_POLL_DELAY", "0.4"))
RUN_POLL_TIMEOUT_SEC = float(_env("OPENAI_RUN_POLL_TIMEOUT", "90"))  # safety


_client: Optional[OpenAI] = None


def _get_client() -> OpenAI:
    global _client
    if _client is not None:
        return _client
    key = _env("OPENAI_API_KEY")
    if not key:
        raise OpenAIConfigError("OPENAI_API_KEY is not set")
    _client = OpenAI(api_key=key)
    return _client


def _extract_text_from_message(msg: Any) -> str:
    """
    Assistants message content is a list of parts.
    We try to pull the first text-ish part safely.
    """
    try:
        parts = getattr(msg, "content", None) or []
        for p in parts:
            ptype = getattr(p, "type", None)
            if ptype == "text":
                t = getattr(p, "text", None)
                v = getattr(t, "value", None)
                if v:
                    return str(v).strip()
            if ptype == "output_text":  # some event payloads use this
                t = getattr(p, "text", None)
                v = getattr(t, "value", None)
                if v:
                    return str(v).strip()
    except Exception:
        pass
    # fallback: stringify
    return str(msg).strip()


def _ensure_assistant() -> str:
    """
    Lazily get/create an assistant. If model is unsupported, retry with fallback.
    """
    global ASSISTANT_ID
    if ASSISTANT_ID:
        return ASSISTANT_ID

    c = _get_client()
    try:
        a = c.beta.assistants.create(
            name="AI Character Avatar",
            instructions="Generic container; avatar prompt is added per run instructions.",
            model=ASSISTANT_MODEL,
        )
    except Exception:
        a = c.beta.assistants.create(
            name="AI Character Avatar",
            instructions="Generic container; avatar prompt is added per run instructions.",
            model=ASSISTANT_FALLBACK_MODEL,
        )

    ASSISTANT_ID = a.id
    return ASSISTANT_ID


def create_new_thread() -> str:
    c = _get_client()
    return c.beta.threads.create().id


def assistant_chat_sync(thread_id: str, avatar: Any, user_msg: str) -> str:
    """
    Blocking assistant call using Assistants API (thread + run).
    """
    c = _get_client()
    assistant_id = _ensure_assistant()

    c.beta.threads.messages.create(thread_id=thread_id, role="user", content=user_msg)

    run = c.beta.threads.runs.create(
        thread_id=thread_id,
        assistant_id=assistant_id,
        instructions=str(getattr(avatar, "prompt", "")),
    )

    t0 = time.time()
    while run.status not in ("completed", "failed", "cancelled", "expired"):
        if time.time() - t0 > RUN_POLL_TIMEOUT_SEC:
            raise RuntimeError("Run polling timeout")
        time.sleep(POLL_DELAY_SEC)
        run = c.beta.threads.runs.retrieve(thread_id=thread_id, run_id=run.id)

    if run.status != "completed":
        err = getattr(run, "last_error", None)
        raise RuntimeError(getattr(err, "message", f"Run failed with status={run.status}"))

    msgs = c.beta.threads.messages.list(thread_id=thread_id, order="desc", limit=5)
    for m in msgs.data:
        if getattr(m, "role", None) == "assistant":
            return _extract_text_from_message(m)
    return _extract_text_from_message(msgs.data[0]) if msgs.data else ""


def assistant_chat_stream(thread_id: str, avatar: Any, user_msg: str) -> Iterator[str]:
    """
    Streaming assistant reply as deltas.
    Yields text chunks.
    """
    c = _get_client()
    assistant_id = _ensure_assistant()

    c.beta.threads.messages.create(thread_id=thread_id, role="user", content=user_msg)

    stream = c.beta.threads.runs.create(
        thread_id=thread_id,
        assistant_id=assistant_id,
        stream=True,
        instructions=str(getattr(avatar, "prompt", "")),
    )

    for event in stream:
        etype = getattr(event, "event", None)

        if etype == "thread.message.delta":
            try:
                parts = event.data.delta.content
                if parts and parts[0].type == "output_text":
                    delta = parts[0].text.value
                    if delta:
                        yield delta
            except Exception:
                continue

        elif etype == "thread.run.failed":
            err = getattr(event.data, "last_error", None)
            raise RuntimeError(getattr(err, "message", "Run failed"))

        elif etype == "thread.run.completed":
            break
