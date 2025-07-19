import asyncio
import websockets


async def chat():
    uri = "ws://127.0.0.1:8000/ws/assistant/5?persona_id=1"
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
