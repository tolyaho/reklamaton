from dataclasses import dataclass
from typing import Iterator

from assistant_api import assistant_chat_stream, assistant_chat_sync, create_new_thread


@dataclass
class _PromptCarrier:
    prompt: str


def create_conversation() -> str:
    return create_new_thread()


def chat_sync(conversation_id: str, instructions: str, user_msg: str) -> str:
    return assistant_chat_sync(conversation_id, _PromptCarrier(prompt=instructions), user_msg)


def chat_stream(conversation_id: str, instructions: str, user_msg: str) -> Iterator[str]:
    return assistant_chat_stream(conversation_id, _PromptCarrier(prompt=instructions), user_msg)
