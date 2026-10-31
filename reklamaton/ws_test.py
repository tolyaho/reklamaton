import asyncio
import websockets


async def chat():
    # Manual check: needs a running server, an existing chat id and OPENAI_API_KEY on the server.
    uri = "ws://127.0.0.1:8000/ws/assistant/5?avatar_id=1&user_id=1"
    async with websockets.connect(uri) as ws:
        # send your user message
        await ws.send("Hey there, how do you do?")
        # receive until the socket closes
        print("Reply:", end=" ", flush=True)
        try:
            async for msg in ws:
                print(msg, end="", flush=True)
        except websockets.ConnectionClosedOK:
            pass
        print()


if __name__ == "__main__":
    asyncio.run(chat())
