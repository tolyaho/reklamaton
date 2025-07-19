import os, time
from openai import OpenAI
from models import Avatar
from typing import Iterator

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
ASSISTANT_ID = os.getenv("ASSISTANT_ID")
SYSTEM_TMPL = "{prompt}"


def _ensure_assistant() -> str:
    global ASSISTANT_ID
    if ASSISTANT_ID:
        return ASSISTANT_ID
    assistant = client.beta.assistants.create(
        name="AI Character Avatar",
        instructions="Generic container; avatar prompt is added per thread.",
        model="gpt-4o",
    )
    ASSISTANT_ID = assistant.id
    return ASSISTANT_ID


def assistant_chat_sync(thread_id: str, avatar: Avatar, user_msg: str) -> str:
    assistant_id = _ensure_assistant()
    client.beta.threads.messages.create(thread_id=thread_id, role="user", content=user_msg)
    run = client.beta.threads.runs.create(
        thread_id=thread_id,
        assistant_id=assistant_id,
        instructions=avatar.prompt,
    )
    while run.status not in {"completed", "failed"}:
        time.sleep(0.4)
        run = client.beta.threads.runs.retrieve(run.id, thread_id=thread_id)
    if run.status == "failed":
        raise RuntimeError(run.last_error)
    msgs = client.beta.threads.messages.list(thread_id=thread_id, order="desc", limit=1)
    return msgs.data[0].content[0].text.value.strip()


def assistant_chat_stream(thread_id: str, avatar: Avatar, user_msg: str) -> Iterator[str]:
    """
    Stream the assistant's reply token-by-token for a given OpenAI thread.

    Args:
        thread_id: Existing OpenAI Thread ID (one per ChatSession row).
        avatar:    Avatar instance whose `prompt` supplies the system instructions.
        user_msg:  The latest user message content.

    Yields:
        Incremental text chunks (tokens / fragments) from the assistant response.
    """
    assistant_id = _ensure_assistant()

    # 1. Append the user's new message to the thread
    client.beta.threads.messages.create(
        thread_id=thread_id,
        role="user",
        content=user_msg,
    )

    # 2. Kick off a streaming run with the avatar's prompt as instructions
    stream = client.beta.threads.runs.create(
        thread_id=thread_id,
        assistant_id=assistant_id,
        stream=True,
        instructions=SYSTEM_TMPL.format(prompt=avatar.prompt),
    )

    # 3. Iterate over streaming events
    try:
        for event in stream:
            etype = getattr(event, "event", None)

            # Incremental text deltas
            if etype == "thread.message.delta":
                # Guard against empty / non-text deltas
                try:
                    parts = event.data.delta.content
                    if parts and parts[0].type == "output_text":
                        delta = parts[0].text.value
                        if delta:
                            yield delta
                except Exception:
                    # Silently skip malformed delta events
                    continue

            # Some SDK versions emit a consolidated final message event
            elif etype == "thread.message.completed":
                try:
                    full_parts = event.data.content
                    if full_parts and full_parts[0].type == "output_text":
                        text_val = full_parts[0].text.value
                        if text_val:
                            # You may *optionally* yield any tail portion not already sent.
                            # (If deltas covered everything, this may duplicate; skip if not needed)
                            pass
                except Exception:
                    continue

            # If a tool call streaming occurs, you could handle it here:
            # elif etype.startswith("thread.run.step"):
            #     ...

            # Detect failure
            elif etype == "thread.run.failed":
                err = getattr(event.data, "last_error", None)
                msg = getattr(err, "message", "Run failed")
                raise RuntimeError(f"Assistant run failed: {msg}")

            # Completed run (no more deltas expected)
            elif etype == "thread.run.completed":
                break

    finally:
        # (Optional) any cleanup if needed
        pass


def create_new_thread(avatar: Avatar) -> str:
    return client.beta.threads.create().id
