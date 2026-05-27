from fastapi import FastAPI
from pydantic import BaseModel
import requests
from fastapi.middleware.cors import CORSMiddleware
# from openai import OpenAI
# import os

app = FastAPI()

# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],  # 개발 중엔 *로, 나중엔 특정 origin만
#     allow_credentials=False,
#     allow_methods=["*"],c
#     allow_headers=["*"],
# )

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatReq(BaseModel):
    prompt: str
    model: str = "llava:latest"

@app.post("/chat")
def chat(req: ChatReq):
    try:
        r = requests.post(
            "http://127.0.0.1:11434/api/generate",
            json={"model": req.model, "prompt": req.prompt, "stream": False},
            timeout=(5, 1200),
        )
        r.raise_for_status()
        print("STATUS:", r.status_code)
        print("TEXT:", r.text)
        
        return {"text": r.json().get("response", ""), "model": req.model}
    except requests.exceptions.ReadTimeout:
        raise HTTPException(status_code=504, detail="Ollama timed out (generation too slow).")
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Ollama request failed: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {e}")


# openai = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

# @app.post("/api/chatkit/session")
# def create_chatkit_session():
#     session = openai.chatkit.sessions.create({
#       # ...
#     })
#     return { client_secret: session.client_secret }
