# 🔬 Research Tool - Intelligent Paper Analysis System

> AI-powered research companion that analyzes arXiv papers with contextual summaries, builds citation networks, and enables intelligent Q&A through Retrieval-Augmented Generation (RAG).

![Python](https://img.shields.io/badge/Python-3.8+-blue?style=flat-square&logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-Modern-green?style=flat-square&logo=fastapi)
![React](https://img.shields.io/badge/React-19.2-61DAFB?style=flat-square&logo=react)
![Chroma](https://img.shields.io/badge/Chroma-VectorDB-orange?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-lightgrey?style=flat-square)

---

## 📖 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running Locally](#running-locally)
- [API Documentation](#api-documentation)
- [Project Structure](#project-structure)
- [Service Details](#service-details)
- [Docker Deployment](#docker-deployment)
- [CI/CD Pipeline](#cicd-pipeline)
- [Development Guide](#development-guide)
- [Troubleshooting](#troubleshooting)
- [Performance Optimization](#performance-optimization)
- [Security](#security)
- [Contributing](#contributing)
- [Roadmap](#roadmap)

---

## 🎯 Overview

Research Tool transforms how you interact with academic papers. Input any arXiv paper ID and the system automatically:

1. **Fetches & Parses** — Downloads PDF from arXiv, extracts and cleans text
2. **Summarizes** — Generates concise summaries using FLAN-T5 transformer
3. **Analyzes Citations** — Builds knowledge graph via Semantic Scholar API
4. **Indexes for Search** — Creates vector embeddings in Chroma DB
5. **Enables Q&A** — Answer paper-specific questions using RAG
6. **Caches Results** — Rapid access for repeated queries

**Example Workflow:**
```
Input:  arxiv_id: "2310.06825" (Mistral 7B paper)
        
Process: 1. Download PDF from arXiv
         2. Extract 12000+ words, clean formatting
         3. Generate 150-word summary
         4. Find 45 cited papers, build network
         5. Create 300 vector embeddings (chunks)
         6. Store in Chroma DB for semantic search
         
Output: {
  "title": "Mistral 7B",
  "summary": "High-quality language model optimized for efficiency...",
  "graph": { nodes: [...], edges: [...] },
  "ready_for_chat": true
}

Then ask: "What techniques reduce inference latency?"
Answer: "The paper uses... [grounded in document]"
```

---

## ✨ Features

### Core Capabilities
- ✅ **Automatic Paper Fetching** — Direct integration with arXiv API
- ✅ **Intelligent Summarization** — FLAN-T5 with GPU acceleration support
- ✅ **Citation Graphs** — Visual relationship networks via Semantic Scholar
- ✅ **RAG-Powered Q&A** — Semantic search + context-aware generation
- ✅ **Vector Storage** — Persistent Chroma DB for fast retrieval
- ✅ **Smart Caching** — In-memory cache for instant paper access
- ✅ **Parallel Processing** — Async/await for concurrent operations
- ✅ **Health Monitoring** — Deployment-ready health check endpoint

### Frontend Features
- 🎨 **Modern React UI** — Built with React 19 and Vite
- ✨ **Animated Background** — Canvas-based particle field visualization
- 💬 **Real-Time Chat** — Conversation interface with paper context
- 📊 **Citation Visualization** — Interactive network graph display
- 🎯 **Responsive Design** — Works on desktop and tablet
- ⚡ **Hot Module Reloading** — Instant feedback during development

---

## 🏗️ Architecture

### System Diagram
```
┌────────────────────────────────────────────────────────────────┐
│                    FRONTEND LAYER                              │
│  React 19 / Vite (Port 5173)                                   │
│  - Paper Input Form                                             │
│  - Animated Particle Field                                      │
│  - Chat Interface                                               │
│  - Citation Graph Visualization                                 │
└────────────────────────┬─────────────────────────────────────┘
                         │ HTTP/JSON
                         ▼
┌────────────────────────────────────────────────────────────────┐
│                  BACKEND API LAYER                              │
│  FastAPI (Port 8000)                                           │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Routes:                                                    │ │
│  │  POST /analyze    — Fetch, process, cache paper          │ │
│  │  POST /chat       — Query RAG for answer                 │ │
│  │  GET  /health     — Deployment health check              │ │
│  └──────────────────────────────────────────────────────────┘ │
└────────────────────────┬─────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┬──────────────┐
         ▼               ▼               ▼              ▼
    ┌─────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
    │  arXiv  │   │ Semantic │   │  Chroma  │   │HuggingFace
    │   API   │   │ Scholar  │   │   DB     │   │ Models
    │         │   │   API    │   │ (Vector  │   │
    │  Download   │          │   │  Store)  │   │FLAN-T5
    │   PDF   │   │ Citation │   │          │   │Embeddings
    │         │   │  Graph   │   │Semantic  │   │Tokenizers
    └─────────┘   └──────────┘   │  Search  │   └──────────┘
                                  └──────────┘
```

### Data Flow for /analyze Endpoint
```
User Input: {arxiv_id: "2310.06825"}
  │
  ▼
Check Cache → Found? → Return immediately
  │ (No)
  ▼
[PARALLEL EXECUTION - asyncio.gather()]
  ├─ fetch_paper()
  │   ├─ Query arXiv API
  │   ├─ Download PDF
  │   ├─ Extract text (PyMuPDF)
  │   └─ Clean & tokenize
  │
  ├─ summarize_paper()
  │   ├─ Load FLAN-T5 model
  │   ├─ Tokenize input
  │   ├─ Generate summary (GPU if available)
  │   └─ Return ~200 tokens
  │
  ├─ build_citation_graph()
  │   ├─ Extract references from text
  │   ├─ Query Semantic Scholar API
  │   ├─ Build directed graph (NetworkX)
  │   └─ Return nodes + edges
  │
  └─ build_rag()
      ├─ Split text into chunks
      ├─ Generate embeddings (Sentence Transformers)
      └─ Store in Chroma DB
  │
  ▼
Combine results + Cache
  │
  ▼
Return to user: {title, authors, summary, graph, abstract}
```

### Data Flow for /chat Endpoint
```
User Input: {arxiv_id: "2310.06825", question: "What is the main innovation?"}
  │
  ▼
Retrieve from Chroma DB: Get embeddings for paper
  │
  ▼
Embed question using same encoder (all-MiniLM-L6-v2)
  │
  ▼
Semantic similarity search: Find top-3 matching chunks
  │
  ▼
Construct prompt: "Context: [chunks]\n\nQuestion: {question}\n\nAnswer:"
  │
  ▼
Feed to FLAN-T5 model
  │
  ▼
Generate answer (~150 tokens)
  │
  ▼
Return: {answer: "The main innovation is..."}
```

---

## 🛠️ Tech Stack

### Backend Stack
| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Web Framework** | FastAPI | Modern async Python API |
| **Server** | Uvicorn | ASGI application server |
| **Async** | asyncio | Parallel task execution |
| **Paper Fetching** | arxiv, PyMuPDF | arXiv integration, PDF parsing |
| **Text Processing** | Transformers, Sentence Transformers | NLP models |
| **Summarization** | FLAN-T5-base | Google's instruction-tuned T5 |
| **Embeddings** | all-MiniLM-L6-v2 | Semantic text embeddings |
| **Vector DB** | Chroma | Vector storage & search |
| **RAG Framework** | LangChain | Orchestration |
| **Citation Graph** | NetworkX, Semantic Scholar API | Network analysis |
| **Utilities** | python-dotenv, requests, numpy | Configuration, HTTP, numerics |
| **ML Framework** | PyTorch | Model inference |

### Frontend Stack
| Component | Technology | Version |
|-----------|-----------|---------|
| **Framework** | React | 19.2.0 |
| **Build Tool** | Vite | 7.3.1 |
| **Styling** | CSS3 + Canvas | Modern web APIs |
| **Development** | ESLint | Code quality |

### DevOps & Deployment
| Component | Technology |
|-----------|-----------|
| **Containerization** | Docker |
| **Orchestration** | Docker Compose (optional) |
| **CI/CD** | GitHub Actions |
| **Version Control** | Git |

---

## 📋 Prerequisites

### System Requirements
- **OS:** Linux (recommended), macOS, or Windows (with WSL2)
- **Python:** 3.8 or higher
- **Node.js:** 16+ with npm
- **RAM:** 4GB minimum (8GB+ recommended for models)
- **Disk:** 5GB free (for models and cached papers)
- **Internet:** Required (arXiv API, Semantic Scholar API, model downloads)

### Optional
- **GPU:** NVIDIA GPU with CUDA 11.8+ for faster inference
- **Docker:** For containerized deployment
- **Docker Compose:** For multi-container orchestration

### Verification
```bash
# Check Python
python3 --version          # Should be 3.8+

# Check Node
node --version            # Should be 16+
npm --version

# Verify internet
curl https://arxiv.org/api/query?id_list=2310.06825
```

---

## 🚀 Installation

### Step 1: Clone Repository
```bash
git clone <your-repo-url>
cd research-tool
```

### Step 2: Backend Setup

#### Create Virtual Environment
```bash
python3 -m venv .venv
source .venv/bin/activate     # Linux/macOS
# OR
.venv\Scripts\activate        # Windows
```

#### Install Dependencies
```bash
cd backend
pip install --upgrade pip
pip install -r requirements.txt
```

**Expected Installation Time:** 5-15 minutes (depending on PyTorch CUDA)

#### Resolve Merge Conflicts in requirements.txt
If you see merge conflict markers (`<<<<`, `====`, `>>>>`):

```bash
# Fix manually by keeping both torch and openai/requests
# OR reset to clean state:
git checkout --ours requirements.txt
pip install torch openai requests
```

#### Verify Installation
```bash
python3 -c "
import torch
import transformers
import chromadb
print('✓ PyTorch:', torch.__version__)
print('✓ Transformers:', transformers.__version__)
print('✓ Chroma:', chromadb.__version__)
print('✓ CUDA Available:', torch.cuda.is_available())
"
```

### Step 3: Frontend Setup

```bash
cd ../frontend
npm install

# Verify Vite is installed
npx vite --version
```

### Step 4: Initialize Storage Directories
```bash
mkdir -p storage/pdfs
mkdir -p storage/chroma_db
chmod -R 755 storage
```

---

## ⚙️ Configuration

### Backend Configuration (.env)

Create `backend/.env`:

```env
# Storage paths (relative to backend/ directory)
PDF_STORAGE_PATH=../storage/pdfs
CHROMA_DB_PATH=../storage/chroma_db

# Optional: CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# Optional: Model selection
SUMMARIZATION_MODEL=google/flan-t5-base
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2

# Optional: Performance
DEVICE=auto  # 'cpu', 'cuda', or 'auto'
NUM_WORKERS=1
```

### Environment Variables Reference

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `PDF_STORAGE_PATH` | str | `../storage/pdfs` | Directory for downloaded PDFs |
| `CHROMA_DB_PATH` | str | `../storage/chroma_db` | Chroma vector store location |
| `CORS_ORIGINS` | str | `http://localhost:5173` | Allowed frontend origins |
| `DEVICE` | str | `auto` | `cpu`, `cuda`, or `auto` |
| `NUM_WORKERS` | int | `1` | Parallel processing workers |

---

## 🏃 Running Locally

### Development Mode (Recommended)

#### Terminal 1: Start Backend API

```bash
cd backend
source .venv/bin/activate    # Or your activation command
uvicorn main:app --reload --port 8000
```

**Expected Output:**
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete
```

**Access Swagger UI:** http://localhost:8000/docs

#### Terminal 2: Start Frontend Dev Server

```bash
cd frontend
npm run dev
```

**Expected Output:**
```
  VITE v7.3.1  ready in 234 ms

  ➜  Local:   http://localhost:5173
  ➜  press h to show help
```

#### Test the Application

Open http://localhost:5173 in your browser. Test with:

```bash
# Example arXiv ID
2310.06825
```

### Production Mode

#### Build Frontend
```bash
cd frontend
npm run build          # Creates dist/ with optimized build
```

#### Start Production Backend
```bash
cd backend
source .venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

---

## 📡 API Documentation

### 1. POST /analyze

**Analyze a new paper from arXiv**

**Request:**
```bash
curl -X POST "http://localhost:8000/analyze" \
  -H "Content-Type: application/json" \
  -d '{"arxiv_id": "2310.06825"}'
```

**Request Body:**
```json
{
  "arxiv_id": "2310.06825"
}
```

**Response (200 OK):**
```json
{
  "title": "Mistral 7B",
  "authors": ["Albert Q. Jiang", "Alexandre Saulnier", "..."],
  "published": "2023-10-10T15:30:00",
  "abstract": "Mistral 7B is a...",
  "summary": "This paper presents Mistral 7B, a language model...",
  "graph": {
    "nodes": [
      {"id": "node_1", "title": "Attention Is All You Need", "type": "main"},
      {"id": "node_2", "title": "LLaMA: Open and Efficient...", "type": "reference"}
    ],
    "edges": [
      {"source": "node_1", "target": "node_2"}
    ]
  }
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Paper title from arXiv |
| `authors` | array | List of author names |
| `published` | string | Publication date (ISO 8601) |
| `abstract` | string | Official paper abstract |
| `summary` | string | AI-generated summary (~200 tokens) |
| `graph` | object | Citation network (nodes/edges) |

**Error Responses:**
```json
// 400 Bad Request - Invalid arXiv ID
{
  "detail": "Invalid arXiv ID format"
}

// 500 Internal Server Error
{
  "detail": "Failed to fetch paper: [error message]"
}
```

**Performance Notes:**
- First request: 30-60s on CPU, 5-10s with GPU
- Subsequent requests (cached): <100ms
- Summary generation: 15-30s on CPU, 2-5s with GPU

### 2. POST /chat

**Ask a question about an analyzed paper**

**Request:**
```bash
curl -X POST "http://localhost:8000/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "arxiv_id": "2310.06825",
    "question": "What inference optimizations were used?"
  }'
```

**Request Body:**
```json
{
  "arxiv_id": "2310.06825",
  "question": "What key techniques are mentioned?"
}
```

**Response (200 OK):**
```json
{
  "answer": "The paper mentions several key techniques including sliding window attention for efficient inference, grouped query attention to reduce memory usage, and flash attention for faster computation. These innovations reduced the model size while maintaining quality."
}
```

**Requirements:**
- Paper must be analyzed first (via `/analyze`)
- Question length: 10-500 characters recommended

**Error Responses:**
```json
// 404 Not Found - Paper not analyzed
{
  "detail": "Paper not found in database"
}

// 500 Internal Server Error
{
  "detail": "Failed to generate answer: [error]"
}
```

**RAG Process Details:**
1. Embed question with Sentence Transformers encoder
2. Search Chroma DB for 3 most similar text chunks
3. Use chunks as context for FLAN-T5
4. Generate answer with document grounding

### 3. GET /health

**Health check for deployment**

**Request:**
```bash
curl "http://localhost:8000/health"
```

**Response (200 OK):**
```json
{
  "status": "ok"
}
```

**Usage:**
- Load balancer health checks
- CI/CD pipeline validation
- Readiness probes in Kubernetes

---

## 📁 Project Structure

```
research-tool/
│
├── 📄 README.md                    # This file
├── 📄 LICENSE                      # MIT License
├── 📄 .github/
│   └── workflows/
│       └── deploy.yml              # GitHub Actions CI/CD pipeline
│
├── 📁 backend/                     # FastAPI application
│   ├── 📄 main.py                  # Entry point, route handlers
│   ├── 📄 requirements.txt          # Python dependencies
│   ├── 📄 test.py                  # Test utilities
│   ├── 📄 .env                     # Environment variables
│   ├── 📄 Dockerfile               # Docker image blueprint
│   │
│   ├── 📁 models/
│   │   └── 📄 schemas.py           # Pydantic models (AnalyzeRequest, ChatRequest)
│   │
│   ├── 📁 services/                # Business logic
│   │   ├── 📄 __init__.py
│   │   ├── 📄 paper_fetcher.py     # arXiv API integration + PDF parsing
│   │   ├── 📄 summarizer.py        # FLAN-T5 summarization
│   │   ├── 📄 rag_engine.py        # Chroma DB + embeddings + Q&A
│   │   ├── 📄 citation_graph.py    # Semantic Scholar API + NetworkX
│   │   └── 📁 __pycache__/
│   │
│   ├── 📁 utils/
│   │   ├── 📄 text_cleaner.py      # PDF text preprocessing
│   │   └── 📁 __pycache__/
│   │
│   ├── 📁 storage/                 # Data persistence
│   │   ├── 📁 chroma_db/           # Vector store (created at runtime)
│   │   │   ├── <paper_id>/
│   │   │   │   ├── chroma.sqlite3
│   │   │   │   └── <uuid>/         # Embedding chunks
│   │   │   └── ...
│   │   └── 📁 pdfs/                # Downloaded PDFs (created at runtime)
│   │       ├── 2310.06825.pdf
│   │       └── ...
│   │
│   └── 📁 __pycache__/
│
├── 📁 frontend/                    # React + Vite application
│   ├── 📄 index.html               # HTML entry point
│   ├── 📄 package.json             # Node.js dependencies
│   ├── 📄 package-lock.json        # Dependency lock file
│   ├── 📄 vite.config.js           # Vite build configuration
│   ├── 📄 eslint.config.js         # Linting rules
│   ├── 📄 Dockerfile               # Docker image blueprint
│   ├── 📄 README.md                # Frontend documentation
│   │
│   ├── 📁 src/
│   │   ├── 📄 main.jsx             # React app entry point
│   │   ├── 📄 App.jsx              # Main component (UI logic)
│   │   ├── 📄 App.css              # Component styles
│   │   ├── 📄 index.css            # Global styles
│   │   └── 📁 assets/              # Images, fonts, etc.
│   │
│   ├── 📁 public/                  # Static assets
│   └── 📁 node_modules/            # npm packages (created at runtime)
│
├── 📁 storage/                     # Shared persistent storage
│   ├── 📁 chroma_db/               # Vector database (persistent)
│   └── 📁 pdfs/                    # Paper PDFs (persistent)
│
└── 📁 .github/
    └── workflows/
        └── deploy.yml              # GitHub Actions workflow
```

### Key Files at a Glance

| File | Lines | Purpose |
|------|-------|---------|
| `backend/main.py` | ~100 | API routes, request handling |
| `backend/services/paper_fetcher.py` | ~40 | Download + parse papers |
| `backend/services/summarizer.py` | ~50 | FLAN-T5 summarization |
| `backend/services/rag_engine.py` | ~120 | Vector DB + Q&A |
| `backend/services/citation_graph.py` | ~60 | Citation network |
| `frontend/src/App.jsx` | ~250 | React UI, API calls |
| `.github/workflows/deploy.yml` | ~50 | CI/CD automation |

---

## 📚 Service Details

### Paper Fetcher Service

**File:** `backend/services/paper_fetcher.py`

**Function:** `fetch_paper(arxiv_id: str) -> dict`

**Process:**
1. Query arXiv API with paper ID
2. Download PDF to `storage/pdfs/`
3. Parse PDF using PyMuPDF (fitz)
4. Extract all text from all pages
5. Clean text using `text_cleaner.py` utility
6. Return structured metadata

**Returns:**
```python
{
    "text": "Cleaned paper text...",
    "raw_text": "Original extracted text...",
    "title": "Paper Title",
    "authors": ["Author 1", "Author 2"],
    "abstract": "Paper abstract...",
    "published": "2023-10-10T00:00:00",
    "arxiv_id": "2310.06825"
}
```

**Error Handling:**
- Invalid arXiv ID → HTTPException (400)
- Network failure → HTTPException (500)
- PDF parsing failure → Logs error, returns raw_text

**Performance:**
- Network I/O: 5-10 seconds
- PDF parsing: 1-5 seconds depending on length

---

### Summarizer Service

**File:** `backend/services/summarizer.py`

**Model:** Google's FLAN-T5-base
- Instruction-tuned T5 model
- 250M parameters
- Supports diverse summarization styles

**Process:**
1. Load FLAN-T5 model (lazy loading, cached in memory)
2. Tokenize input text (max 512 tokens)
3. Generate summary tokens (max 200)
4. Decode to readable text

**Returns:**
```python
{
    "summary": "Short summary of the key findings...",
    "tokens_used": 187
}
```

**Configuration:**
```python
# In summarizer.py
MODEL_NAME = "google/flan-t5-base"  # Can change to flan-t5-large
MAX_NEW_TOKENS = 200                # Summary length
```

**Performance:**
- CPU: 15-30 seconds per paper
- GPU (NVIDIA): 2-5 seconds per paper
- Memory: ~900MB CPU, ~2GB GPU

---

### RAG Engine Service

**File:** `backend/services/rag_engine.py`

**Architecture:**
```
┌─────────────────────────────────────┐
│  Paper Text (2000-15000 words)      │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ Text Splitter (1000 chars / chunk)  │
│ Overlap: 200 chars                  │
└──────────────┬──────────────────────┘
               │
               ▼
        150-300 chunks
               │
               ▼
┌─────────────────────────────────────┐
│ Sentence Transformers Encoder       │
│ Model: all-MiniLM-L6-v2             │
│ Output: 384-dim vectors             │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ Chroma Vector Database              │
│ Storage: SQLite + vectors           │
│ Location: storage/chroma_db/        │
└──────────────┬──────────────────────┘
               │
               ▼
        Ready for semantic search
```

**On Query:**
1. Embed question (384-dim vector)
2. Search Chroma DB with cosine similarity
3. Retrieve top-3 most similar chunks
4. Pass chunks + question to FLAN-T5
5. Model generates grounded answer

**Key Functions:**

```python
# Build RAG
build_rag(arxiv_id: str, text: str) -> None
# Splits text, creates embeddings, stores in Chroma

# Ask Question
ask_question(arxiv_id: str, question: str) -> str
# Returns answer grounded in paper content
```

**Vector Database Details:**
- **Format:** Chroma DB (open-source vector store)
- **Persistence:** SQLite + vector data
- **Path:** `storage/chroma_db/<arxiv_id>/`
- **Embedding Dim:** 384
- **Distance Metric:** Cosine similarity

**Performance:**
- Vectorization: 5-15 seconds per paper
- Storage: ~500KB per paper
- Query time: <100ms for top-3 retrieval
- Answer generation: 5-10 seconds (GPU), 15-30 seconds (CPU)

---

### Citation Graph Service

**File:** `backend/services/citation_graph.py`

**Data Source:** Semantic Scholar API (free, no credentials needed)

**Process:**
1. Search Semantic Scholar for paper by arXiv ID
2. Retrieve cited papers (references)
3. Build directed graph: Main paper → Cited papers
4. Return nodes (papers) and edges (citations)

**Returns:**
```python
{
    "nodes": [
        {"id": "arxiv:2310.06825", "title": "Mistral 7B", "type": "main"},
        {"id": "arxiv:1706.03762", "title": "Attention Is All You Need", "type": "reference"},
        ...  # 20-100 more nodes
    ],
    "edges": [
        {"source": "arxiv:2310.06825", "target": "arxiv:1706.03762"},
        ...
    ]
}
```

**Performance:**
- API call: 2-5 seconds
- Graph construction: <1 second
- Typical graph size: 30-150 nodes

**Limitations:**
- Depth: 1 (direct references only, not recursive)
- Coverage: ~70% of papers (not all have Semantic Scholar data)
- Rate limiting: 100 requests per 5 minutes

---

### Text Cleaner Utility

**File:** `backend/utils/text_cleaner.py`

**Cleaning Steps:**
1. Remove page headers/footers
2. Fix common OCR artifacts
3. Normalize whitespace
4. Remove URLs and email addresses
5. Deduplicate lines
6. Fix common formatting issues

**Input:** Raw PyMuPDF-extracted text
**Output:** Clean, readable text suitable for NLP models

---

## 🐳 Docker Deployment

### Quick Start with Docker

#### Build Images

```bash
# Backend image
docker build -t research-tool-backend ./backend

# Frontend image
docker build -t research-tool-frontend ./frontend
```

#### Run Containers

```bash
# Start backend
docker run -d \
  --name research-backend \
  -p 8000:8000 \
  -v $(pwd)/storage:/app/storage \
  -e PDF_STORAGE_PATH=/app/storage/pdfs \
  -e CHROMA_DB_PATH=/app/storage/chroma_db \
  research-tool-backend

# Start frontend
docker run -d \
  --name research-frontend \
  -p 5173:5173 \
  research-tool-frontend
```

#### Verify Containers

```bash
docker ps
docker logs research-backend
curl http://localhost:8000/health
```

### Docker Compose (Multi-Container)

**File:** `docker-compose.yml`

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    volumes:
      - ./storage:/app/storage
    environment:
      PDF_STORAGE_PATH: /app/storage/pdfs
      CHROMA_DB_PATH: /app/storage/chroma_db
    command: uvicorn main:app --host 0.0.0.0 --port 8000

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    depends_on:
      - backend
    environment:
      VITE_API_URL: http://localhost:8000
```

**Deploy:**
```bash
docker-compose up -d
```

---

## 🔄 CI/CD Pipeline

**File:** `.github/workflows/deploy.yml`

### Workflow Stages

1. **Health Check**
   - Starts backend server
   - Calls `/health` endpoint
   - Verifies response: `{"status": "ok"}`

2. **Validation**
   - Parses JSON response
   - Confirms status field = "ok"

3. **Deployment**
   - Pushes to repository if health check passes
   - Configured with git user "GitHub Action"

### Triggering Deployment

```bash
git push origin main  # Automatically triggers deploy.yml workflow
```

### Viewing Workflow Results

1. Go to GitHub repository
2. Click **Actions** tab
3. Select workflow run
4. Check logs for each step

### Workflow Status Check

```bash
# View recent commits and build status
git log --oneline -10
```

---

## 👨‍💻 Development Guide

### Project Setup for Developers

```bash
# Clone and setup
git clone <repo>
cd research-tool

# Backend setup
python3 -m venv .venv && source .venv/bin/activate
cd backend && pip install -r requirements.txt
cd ..

# Frontend setup
cd frontend && npm install
cd ..

# Create storage dirs
mkdir -p storage/{pdfs,chroma_db}
```

### Hot Reloading

**Backend (Uvicorn --reload):**
```bash
cd backend
uvicorn main:app --reload --port 8000
# Auto-restarts on file changes
```

**Frontend (Vite HMR):**
```bash
cd frontend
npm run dev
# Hot module replacement, instant updates
```

### Adding a New Service

**Example: Add paper classification service**

1. **Create file:** `backend/services/classifier.py`

```python
from transformers import pipeline

def classify_paper(text: str) -> dict:
    """Classify paper into research category."""
    classifier = pipeline("zero-shot-classification")
    categories = ["ML", "NLP", "CV", "Theory", "Other"]
    result = classifier(text, categories)
    return result
```

2. **Import in main.py:**

```python
from services.classifier import classify_paper
```

3. **Add route:**

```python
@app.post("/classify")
async def classify(req: AnalyzeRequest):
    result = await run_in_threadpool(classify_paper, text)
    return result
```

4. **Update README** with new endpoint documentation

### Code Quality

**Frontend Linting:**
```bash
cd frontend
npm run lint           # Code quality check
npm run lint -- --fix # Auto-fix issues
```

**Backend (PEP 8):**
```bash
pip install flake8 black
flake8 backend/          # Check style
black backend/           # Auto-format
```

### Testing

**Run existing tests:**
```bash
cd backend
python test.py
```

**Manual testing with curl:**
```bash
# Test /analyze
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{"arxiv_id": "2310.06825"}'

# Test /chat  
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"arxiv_id": "2310.06825", "question": "What is the main contribution?"}'

# Test /health
curl http://localhost:8000/health
```

---

## 🐛 Troubleshooting

### Common Issues & Solutions

#### Issue 1: Port Already in Use

**Error:** `Address already in use (:8000)`

**Solution:**
```bash
# Find process using port 8000
lsof -i :8000

# Kill the process
kill -9 <PID>

# Or use different port
uvicorn main:app --port 8001
```

#### Issue 2: Module Not Found Errors

**Error:** `ModuleNotFoundError: No module named 'transformers'`

**Solution:**
```bash
# Activate virtual environment
source .venv/bin/activate  # or .venv\Scripts\activate on Windows

# Reinstall dependencies
pip install -r requirements.txt --force-reinstall
```

#### Issue 3: CUDA Not Available

**Error:** `torch.cuda.is_available() returns False`

**Check CUDA installation:**
```bash
python -c "import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name())"
```

**If GPU not detected:**
- Install NVIDIA CUDA Toolkit 11.8+
- Install cuDNN for CUDA
- Reinstall PyTorch with CUDA support

**Fallback to CPU:**
```python
# In .env
DEVICE=cpu
```

#### Issue 4: OutOfMemory (OOM) Errors

**Error:** `CUDA out of memory` or `RuntimeError: CUDA out of memory`

**Solutions:**
```python
# Use smaller models - Edit rag_engine.py:
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"  # Smaller
# Instead of:
# EMBEDDING_MODEL = "sentence-transformers/all-mpnet-base-v2"

# Reduce batch size
# In summarizer.py, add:
torch.cuda.set_per_process_memory_fraction(0.5)  # Use only 50% of VRAM
```

**Or clear GPU memory:**
```bash
python -c "import torch; torch.cuda.empty_cache()"
```

#### Issue 5: PDF Parsing Errors

**Error:** `Failed to extract text from PDF`

**Cause:** Corrupted or unusual PDF format

**Solutions:**
```bash
# Check PDF integrity
python -c "import fitz; doc = fitz.open('path/to/pdf.pdf'); print(len(doc))"

# Verify PDF is valid
file <pdf_file>  # Should say "PDF document"

# Clear download cache and retry
rm storage/pdfs/<arxiv_id>.pdf
```

#### Issue 6: Chroma DB Connection Issues

**Error:** `chromadb.errors.InvalidCollectionException`

**Solution:**
```bash
# Reset vector database
rm -rf storage/chroma_db/

# Restart application
# Database will recreate on next analysis
```

#### Issue 7: CORS Errors in Frontend

**Error:** `Access to XMLHttpRequest blocked by CORS policy`

**Fix** (in `backend/main.py`):
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```

#### Issue 8: arXiv Rate Limiting

**Error:** `HTTP 429 Too Many Requests`

**Cause:** >20 requests per 120 seconds to arXiv API

**Solution:**
```python
# Add rate limiting in paper_fetcher.py:
import time
time.sleep(1)  # Wait 1 second between requests
```

---

## ⚡ Performance Optimization

### Inference Speed Improvements

#### 1. GPU Acceleration

**Enable CUDA (if available):**
```python
# In rag_engine.py
if torch.cuda.is_available():
    model = model.cuda()  # Move model to GPU
```

**Expected Speedup:** 5-10x faster

#### 2. Model Quantization (INT8)

**Reduce precision to save memory:**
```python
# In rag_engine.py, load with quantization:
from bitsandbytes import Int8Module
model = T5ForConditionalGeneration.from_pretrained(
    "google/flan-t5-base",
    load_in_8bit=True  # 8-bit quantization
)
```

**Trade-off:** ~5% accuracy loss, 4x memory savings

#### 3. Batch Processing

**Process multiple papers in parallel:**
```python
# In main.py:
async def analyze_batch(arxiv_ids: list):
    results = await asyncio.gather(*[
        analyze(AnalyzeRequest(arxiv_id=id))
        for id in arxiv_ids
    ])
    return results
```

#### 4. Caching Strategy

**Current:** In-memory Python dict

**Upgrade to Redis (multi-process):**
```bash
# Install Redis
pip install redis

# Create Redis cache wrapper
python
>>> import redis
>>> cache = redis.Redis(host='localhost', port=6379)
>>> cache.setex('paper:2310.06825', 86400, json_data)  # 24h TTL
```

### Memory Management

**Monitor memory usage:**
```bash
# Terminal 1: Run backend
watch -n 1 'ps aux | grep python'  # Check RSS column

# Terminal 2: Monitor GPU
nvidia-smi -l 1  # Update every 1 second
```

**Memory Profiling:**
```python
# Add to main.py:
import tracemalloc
tracemalloc.start()

# ... API call ...

current, peak = tracemalloc.get_traced_memory()
print(f"Current: {current/1e6} MB; Peak: {peak/1e6} MB")
```

### Database Optimization

**Chroma DB tuning:**
```python
# Limit vector search results
results = db.query(
    query_embeddings=embeddings,
    n_results=3,  # Only retrieve top-3
    where={"arxiv_id": arxiv_id}
)
```

---

## 🔐 Security

### Production Checklist

- [ ] Change CORS origins from localhost
- [ ] Enable HTTPS/TLS
- [ ] Add request rate limiting
- [ ] Implement input validation
- [ ] Use environment variables for secrets
- [ ] Add authentication/authorization
- [ ] Log security events
- [ ] Regular dependency updates

### Input Validation

```python
# Validate arXiv ID format
import re
def validate_arxiv_id(arxiv_id: str) -> bool:
    pattern = r'^\d{4}\.\d{5}(v\d+)?$'
    return bool(re.match(pattern, arxiv_id))
```

### Secure Config Management

```python
# Use environment variables, never hardcode
from os import getenv

PDF_PATH = getenv("PDF_STORAGE_PATH", "storage/pdfs")
ALLOWED_ORIGINS = getenv("CORS_ORIGINS", "localhost:5173").split(",")
```

---

## 🤝 Contributing

### Development Workflow

1. **Create feature branch:**
   ```bash
   git checkout -b feature/your-feature
   ```

2. **Make changes and test:**
   ```bash
   npm run lint  # Frontend
   # OR
   flake8 backend/  # Backend
   ```

3. **Commit with clear messages:**
   ```bash
   git commit -am "Add feature: description"
   ```

4. **Push and create PR:**
   ```bash
   git push origin feature/your-feature
   ```

### Code Style

- **Frontend:** ESLint config in `eslint.config.js`
- **Backend:** PEP 8 (check with flake8)
- **Comments:** Docstrings for functions (NumPy style)

### Pull Request Guidelines

- Describe changes clearly
- Include test results
- Link related issues
- Keep commits atomic

---

## 🗺️ Roadmap

### Short Term (1-2 months)
- [ ] Database persistence (MongoDB/PostgreSQL)
- [ ] PDF upload support (alternative to arXiv)
- [ ] Advanced semantic search
- [ ] Export summaries to PDF/Markdown

### Medium Term (3-6 months)
- [ ] User authentication & saved papers collection
- [ ] Paper comparison tool
- [ ] Multi-language support
- [ ] Recursive citation graphs (depth 2+)
- [ ] Integration with Zotero/Mendeley

### Long Term (6+ months)
- [ ] Mobile app (React Native)
- [ ] Offline mode with sync
- [ ] Custom training on user papers
- [ ] Collaborative features
- [ ] Advanced filtering and tagging

---

## 📖 Resources & References

### Official Documentation
- [FastAPI](https://fastapi.tiangolo.com/)  — Web framework
- [React](https://react.dev/) — UI library
- [Vite](https://vitejs.dev/) — Build tool
- [LangChain](https://python.langchain.com/) — RAG framework
- [Chroma DB](https://docs.trychroma.com/) — Vector store
- [Hugging Face](https://huggingface.co/) — Model hub

### Key Papers
- [FLAN-T5: Instruction-Tuned Text-to-Text Transformers](https://arxiv.org/abs/2210.11416)
- [Sentence-BERT: Semantic Textual Similarity](https://www.sbert.net/)
- [Attention Is All You Need (Transformer)](https://arxiv.org/abs/1706.03762)
- [RAG: Retrieval-Augmented Generation](https://arxiv.org/abs/2005.11401)

### External APIs
- [arXiv API](https://arxiv.org/help/api/) — Paper metadata + PDFs
- [Semantic Scholar API](https://api.semanticscholar.org/) — Citation data

---

## 📄 License

This project is licensed under the **MIT License** — see [LICENSE](LICENSE) file for details.

**Summary:** Free to use, modify, and distribute with attribution.

---

## 🙏 Acknowledgments

- [arXiv](https://arxiv.org/) for providing open access to research papers
- [Semantic Scholar](https://www.semanticscholar.org/) for citation data
- [Hugging Face](https://huggingface.co/) for hosting open-source models
- [OpenAI](https://openai.com/) for transformer architecture inspiration
- [PyMuPDF](https://pymupdf.readthedocs.io/) for PDF parsing

---

## 📞 Support

**Having issues?**

1. Check [Troubleshooting](#troubleshooting) section
2. Search GitHub Issues
3. Create new issue with:
   - Error message
   - Steps to reproduce
   - System info (OS, Python version, etc.)
   - Logs from backend/frontend

---

**Last Updated:** March 2026  
**Version:** 1.0.0  
**Maintainers:** [Your Name/Organization]
