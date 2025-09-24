from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import requests
import json

app = FastAPI()



import os
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")


# enable cors on all sites
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Hello World"}


def ask_openrouter(question: str):
    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": "x-ai/grok-4-fast:free",
        "messages": [{"role": "user", "content": question}],
        "stream": True,
    }

    buffer = ""

    with requests.post(url, headers=headers, json=payload, stream=True) as r:
        for chunk in r.iter_content(chunk_size=1024, decode_unicode=True):
            buffer += chunk
            while True:
                try:
                    # Find the next complete SSE line
                    line_end = buffer.find("\n")
                    if line_end == -1:
                        break
                    line = buffer[:line_end].strip()
                    buffer = buffer[line_end + 1:]
                    if line.startswith("data: "):
                        data = line[6:]
                        if data == "[DONE]":
                            break
                        try:
                            data_obj = json.loads(data)
                            content = data_obj["choices"][0]["delta"].get("content")
                            if content:
                                yield f"{content}"
                                print(content, end="", flush=True)
                        except json.JSONDecodeError:
                            pass
                except Exception:
                    break


@app.post("/chat", response_class=StreamingResponse)
async def chat(question: str):
    def event_generator():
        yield from ask_openrouter(question)

    return StreamingResponse(event_generator(), media_type="text/event-stream")
