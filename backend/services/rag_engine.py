from langchain_community.vectorstores import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from groq import Groq
from dotenv import load_dotenv
import os
from pathlib import Path

_SERVICE_DIR = Path(__file__).resolve().parent
_BACKEND_DIR = _SERVICE_DIR.parent
_ROOT_DIR = _BACKEND_DIR.parent

load_dotenv(_ROOT_DIR / ".env", override=False)
load_dotenv(_BACKEND_DIR / ".env", override=False)

CHROMA_PATH = os.getenv("CHROMA_DB_PATH", "../../storage/chroma_db")

# Embedding model
embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)

MODEL_NAME = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")


def _get_client() -> Groq | None:
    api_key = (os.getenv("GROQ_API_KEY") or os.getenv("GROK_API_KEY") or "").strip()
    if not api_key:
        return None
    return Groq(api_key=api_key)


def _fallback_answer(question: str, context_blocks: list[str]) -> str:
    if not context_blocks:
        return "I could not find enough relevant context in the paper to answer confidently."

    return (
        "Based on the retrieved context from the paper, here is the best available information:\n\n"
        + "\n\n".join(context_blocks)
    )


def generate_answer(question: str, context_blocks: list[str]) -> str:
    if not context_blocks:
        return "I could not find enough relevant context in the paper to answer confidently."

    # Clean and format context with clear numbering
    formatted_context = "\n\n".join(context_blocks)

    client = _get_client()
    if client is None:
        return _fallback_answer(question, context_blocks)

    # Improved System Prompt
    system_prompt = """You are a precise and helpful research assistant specialized in understanding academic papers.

Answer the user's question using ONLY the information provided in the context below. 
Be accurate, clear, and professional.

Important Rules:
- Synthesize the information from the context into a coherent, well-structured answer.
- Always cite the source chunks using [1], [2], [3], etc. when you use information from them.
- If the context fully answers the question, provide a detailed explanation.
- If the context only partially answers the question, clearly state what is covered and what is not mentioned in the provided context.
- Never invent information, assumptions, or knowledge that is not present in the given context.
- Keep the answer concise yet informative. Avoid repetition."""

    try:
        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": f"""CONTEXT:
{formatted_context}

QUESTION:
{question}

Please provide a clear, grounded answer based on the context above. Use citations [1], [2], etc. where appropriate."""
                }
            ],
            temperature=0.15,      # Lower temperature = more consistent & factual
            max_tokens=800,
            top_p=0.95,
        )

        content = response.choices[0].message.content if response.choices else ""
        return (content or "").strip()

    except Exception as e:
        print(f"Groq API error: {e}")
        return _fallback_answer(question, context_blocks)


# Session store: arxiv_id → vectorstore
_sessions = {}


def build_rag(arxiv_id: str, text: str):
    """Build vector store for a paper with improved chunking"""
    # Better chunking for academic papers
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=600,      # Increased from 500
        chunk_overlap=150,   # Increased from 100 - helps connect ideas better
        separators=["\n\n", "\n", ". ", " ", ""]
    )
    
    chunks = splitter.split_text(text)

    persist_dir = f"{CHROMA_PATH}/{arxiv_id.replace('/', '_').replace('.', '_')}"

    vectorstore = Chroma.from_texts(
        texts=chunks,
        embedding=embeddings,
        persist_directory=persist_dir,
        collection_name=f"paper_{arxiv_id.replace('/', '_')}"
    )

    _sessions[arxiv_id] = vectorstore
    print(f"✓ RAG built for {arxiv_id} with {len(chunks)} chunks")
    return True


def ask_question(arxiv_id: str, question: str) -> str:
    if arxiv_id not in _sessions:
        return "Paper not loaded. Please analyze the paper first using /analyze endpoint."

    vectorstore = _sessions[arxiv_id]

    # Retrieve more chunks for better context
    docs = vectorstore.similarity_search(question, k=5)   # Increased from 4 to 5

    # Format with clear chunk IDs
    context_blocks = [f"[{i + 1}] {doc.page_content.strip()}" for i, doc in enumerate(docs)]

    try:
        return generate_answer(question, context_blocks)
    except Exception as exc:
        print(f"Error in ask_question: {exc}")
        return f"I encountered an error while processing your question: {str(exc)}"