from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from services.paper_fetcher import fetch_paper
from services.summarizer import summarize_paper
from services.rag_engine import build_rag, ask_question
from services.citation_graph import build_citation_graph

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"]
)

class AnalyzeRequest(BaseModel):
    arxiv_id: str  # e.g. "2310.06825"

class ChatRequest(BaseModel):
    arxiv_id: str
    question: str

import traceback

@app.post("/analyze")
async def analyze(req: AnalyzeRequest):
    try:
        paper = fetch_paper(req.arxiv_id)
        summary = summarize_paper(paper["text"])
        graph = build_citation_graph(req.arxiv_id)
        build_rag(req.arxiv_id, paper["text"])
        return {
            "title": paper["title"],
            "authors": paper["authors"],
            "published": paper["published"],
            "abstract": paper["abstract"],
            "summary": summary,
            "graph": graph
        }
    except Exception as e:
        print("ERROR:", traceback.format_exc())  # ← prints full trace to terminal
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat")
async def chat(req: ChatRequest):
    answer = ask_question(req.arxiv_id, req.question)
    return {"answer": answer}

@app.get("/health")
def health():
    return {"status": "ok"}