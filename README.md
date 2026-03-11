# ⬡ ArXiv Lens

> AI-powered research tool that summarizes ArXiv papers, builds citation knowledge graphs, and lets you chat with any paper using RAG.

![Python](https://img.shields.io/badge/Python-3.10+-blue?style=flat-square&logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-green?style=flat-square&logo=fastapi)
![React](https://img.shields.io/badge/React-18+-61DAFB?style=flat-square&logo=react)
![HuggingFace](https://img.shields.io/badge/HuggingFace-Transformers-yellow?style=flat-square&logo=huggingface)
![License](https://img.shields.io/badge/License-MIT-lightgrey?style=flat-square)

---

## What It Does

Paste any ArXiv paper ID and ArXiv Lens will:

1. **Download & parse** the PDF automatically
2. **Summarize** the paper section by section using a local LLM
3. **Build a citation graph** by querying the Semantic Scholar API
4. **Index the full paper** into a vector database for semantic search
5. **Let you chat** with the paper — ask any question, get grounded answers

---

## Demo

```
Input:  1706.03762
Output: Summary of "Attention Is All You Need"
        Citation graph with 25 related papers
        Chat: "What attention mechanism did they propose?" → detailed answer
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python, FastAPI |
| PDF Parsing | PyMuPDF (`fitz`) |
| Summarization | `google/flan-t5-base` via HuggingFace |
| Embeddings | `sentence-transformers/all-MiniLM-L6-v2` |
| Vector Store | ChromaDB |
| RAG Chain | LangChain |
| Citation Graph | Semantic Scholar API + NetworkX |
| Frontend | React + Vite |
| Graph Visualization | HTML5 Canvas (custom force simulation) |

---

## Project Structure

```
arxiv-lens/
│
├── backend/
│   ├── main.py                  # FastAPI entry point
│   ├── requirements.txt
│   │
│   ├── services/
│   │   ├── paper_fetcher.py     # ArXiv download + PDF parsing
│   │   ├── summarizer.py        # HuggingFace summarization
│   │   ├── rag_engine.py        # Embeddings + ChromaDB + Q&A
│   │   └── citation_graph.py   # Semantic Scholar + NetworkX
│   │
│   ├── models/
│   │   └── schemas.py           # Pydantic request/response models
│   │
│   └── utils/
│       └── text_cleaner.py      # PDF noise removal + chunking
│
├── frontend/
│   └── src/
│       └── App.jsx              # Full React UI (3-panel layout)
│
├── storage/
│   ├── pdfs/                    # Cached downloaded PDFs
│   └── chroma_db/               # ChromaDB vector store
│
├── .env
└── README.md
```

---

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- A free [HuggingFace account](https://huggingface.co/settings/tokens) for the API token

---

### 1. Clone the repo

```bash
git clone https://github.com/your-username/arxiv-lens.git
cd arxiv-lens
```

### 2. Backend setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

pip install -r requirements.txt
```

Create a `.env` file in the project root:

```env
HF_TOKEN=hf_your_token_here
CHROMA_DB_PATH=./storage/chroma_db
PDF_STORAGE_PATH=./storage/pdfs
```

Start the backend:

```bash
uvicorn main:app --reload --port 8000
```

### 3. Frontend setup

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Usage

1. Enter an ArXiv paper ID in the search bar (e.g. `1706.03762`)
2. Click **ANALYZE →** or press `Enter`
3. Wait for the model to process (~30–60s on CPU, ~5s with Groq)
4. Read the AI summary, explore the citation graph, ask questions in the chat

### Example ArXiv IDs to try

| ID | Paper |
|---|---|
| `1706.03762` | Attention Is All You Need (Transformer) |
| `2310.06825` | Mistral 7B |
| `2005.11401` | RAG — Retrieval Augmented Generation |
| `1810.04805` | BERT |

---

## Performance

By default the project runs fully locally on CPU, which is slow for large models. To speed things up:

**Option A — Use a smaller model (quick fix)**

In `summarizer.py` and `rag_engine.py`, change:
```python
model="google/flan-t5-base"   # instead of flan-t5-large
```

**Option B — Use Groq (recommended, free)**

Groq provides free hosted LLaMA 3 inference that is ~100x faster than local CPU.

1. Get a free API key at [console.groq.com](https://console.groq.com)
2. Add to `.env`: `GROQ_API_KEY=your_key_here`
3. Replace HuggingFace pipeline calls with the Groq client

See [GROQ_SETUP.md](./GROQ_SETUP.md) for the full migration guide.

---

## API Reference

### `POST /analyze`

Fetches, parses, summarizes, and indexes a paper.

```json
// Request
{ "arxiv_id": "1706.03762" }

// Response
{
  "title": "Attention Is All You Need",
  "authors": ["Vaswani, Ashish", "..."],
  "published": "2017-06-12",
  "abstract": "...",
  "summary": {
    "full_summary": "...",
    "sections": ["...", "..."]
  },
  "graph": {
    "nodes": [{ "id": "...", "title": "...", "type": "main" }],
    "links": [{ "source": "...", "target": "..." }]
  }
}
```

### `POST /chat`

Ask a question about an already-analyzed paper.

```json
// Request
{ "arxiv_id": "1706.03762", "question": "What dataset was used?" }

// Response
{ "answer": "The model was evaluated on WMT 2014 English-German and English-French translation tasks." }
```

### `GET /health`

```json
{ "status": "ok" }
```

---

## How RAG Works Here

```
User question
     ↓
Embed question → all-MiniLM-L6-v2
     ↓
Similarity search in ChromaDB (top 3 chunks)
     ↓
Inject chunks as context into prompt
     ↓
FLAN-T5 / Groq generates grounded answer
     ↓
Return answer to user
```

The paper is never sent entirely to the LLM — only the 3 most relevant chunks are retrieved per question, keeping inference fast and answers grounded.

---

## Known Limitations

- **CPU inference is slow** — use Groq for production-level speed
- **FLAN-T5 summaries are basic** — upgrading to LLaMA 3 via Groq gives much better quality
- **Citation graph depth is 1** — only direct references are shown, not recursive citations
- **Session memory is in-process** — restarting the server clears loaded papers from RAM (ChromaDB persists on disk)

---

## Roadmap

- [ ] Groq / OpenAI LLM backend option
- [ ] Multi-paper comparison mode
- [ ] Recursive citation graph (depth 2+)
- [ ] PDF upload support (not just ArXiv)
- [ ] Export summary as PDF / Markdown
- [ ] Persistent user sessions

---

## License

MIT — free to use, modify, and build on.

---

## Acknowledgements

- [ArXiv](https://arxiv.org/) for open access to research
- [Semantic Scholar API](https://api.semanticscholar.org/) for citation data
- [HuggingFace](https://huggingface.co/) for open-source models
- [LangChain](https://langchain.com/) for RAG tooling
- [ChromaDB](https://www.trychroma.com/) for the vector store
