import asyncio
from functools import lru_cache
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel
import traceback

from services.paper_fetcher import fetch_paper
from services.summarizer import summarize_paper
from services.rag_engine import build_rag, ask_question
from services.citation_graph import build_citation_graph

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Simple in-memory cache for analyzed papers
analyzed_cache: dict = {}

class AnalyzeRequest(BaseModel):
    arxiv_id: str

class ChatRequest(BaseModel):
    arxiv_id: str
    question: str

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/analyze")
async def analyze(req: AnalyzeRequest):
    # Return cached result immediately if already analyzed
    if req.arxiv_id in analyzed_cache:
        return analyzed_cache[req.arxiv_id]

    try:
        # Step 1: fetch paper (needed by others, so do first)
        paper = await run_in_threadpool(fetch_paper, req.arxiv_id)

        # Step 2: run summary, citation graph, and RAG build IN PARALLEL
        summary, graph, _ = await asyncio.gather(
            run_in_threadpool(summarize_paper, paper["text"]),
            run_in_threadpool(build_citation_graph, req.arxiv_id),
            run_in_threadpool(build_rag, req.arxiv_id, paper["text"]),
        )

        result = {
            "title": paper["title"],
            "authors": paper["authors"],
            "published": paper["published"],
            "abstract": paper["abstract"],
            "summary": summary,
            "graph": graph,
        }

        # Cache the result so repeat calls are instant
        analyzed_cache[req.arxiv_id] = result
        return result

    except Exception as e:
        print("ERROR:", traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat")
async def chat(req: ChatRequest):
    answer = await run_in_threadpool(ask_question, req.arxiv_id, req.question)
    return {"answer": answer}

@app.get("/health")
def health():
    return {"status": "ok"}