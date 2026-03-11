from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

# ─── Request Schemas ───────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    arxiv_id: str = Field(
        ...,
        example="2310.06825",
        description="ArXiv paper ID, e.g. '2310.06825' or '2310.06825v1'"
    )

class ChatRequest(BaseModel):
    arxiv_id: str = Field(..., description="ArXiv ID of the already-analyzed paper")
    question: str = Field(..., min_length=3, max_length=500, description="Question to ask about the paper")


# ─── Sub-models ────────────────────────────────────────────────

class SummaryResult(BaseModel):
    full_summary: str
    sections: List[str]

class GraphNode(BaseModel):
    id: str
    title: str
    type: str  # "main" or "reference"

class GraphLink(BaseModel):
    source: str
    target: str

class CitationGraph(BaseModel):
    nodes: List[Dict[str, Any]]
    links: List[Dict[str, Any]]


# ─── Response Schemas ──────────────────────────────────────────

class AnalyzeResponse(BaseModel):
    title: str
    authors: List[str]
    published: str
    abstract: str
    summary: SummaryResult
    graph: CitationGraph

class ChatResponse(BaseModel):
    answer: str

class HealthResponse(BaseModel):
    status: str