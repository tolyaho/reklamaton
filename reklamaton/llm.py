from typing import Iterable, Iterator

from assistant_api import chat_reply, chat_reply_stream, new_conversation_id


def create_conversation() -> str:
    return new_conversation_id()


def chat_sync(instructions: str, history: Iterable, user_msg: str) -> str:
    return chat_reply(instructions, history, user_msg)


def chat_stream(instructions: str, history: Iterable, user_msg: str) -> Iterator[str]:
    return chat_reply_stream(instructions, history, user_msg)
