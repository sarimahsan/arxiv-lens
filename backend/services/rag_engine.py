from langchain_community.vectorstores import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from transformers import T5ForConditionalGeneration, T5Tokenizer
import torch
import os

CHROMA_PATH = os.getenv("CHROMA_DB_PATH", "../../storage/chroma_db")

# Free embedding model
embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)

# Load FLAN-T5 directly (bypasses pipeline task registry)
_model = None
_tokenizer = None

def get_model():
    global _model, _tokenizer
    if _model is None:
        print("[rag_engine] Loading google/flan-t5-large...")
        _tokenizer = T5Tokenizer.from_pretrained("google/flan-t5-large")
        _model = T5ForConditionalGeneration.from_pretrained("google/flan-t5-large")
        _model.eval()
        if torch.cuda.is_available():
            _model = _model.cuda()
        print("[rag_engine] Model loaded.")
    return _model, _tokenizer


def generate_answer(prompt: str) -> str:
    model, tokenizer = get_model()
    inputs = tokenizer(
        prompt,
        return_tensors="pt",
        max_length=512,
        truncation=True
    )
    if torch.cuda.is_available():
        inputs = {k: v.cuda() for k, v in inputs.items()}

    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=256,
            num_beams=4,
            early_stopping=True
        )
    return tokenizer.decode(outputs[0], skip_special_tokens=True)


# Session store: arxiv_id → vectorstore
_sessions = {}


def build_rag(arxiv_id: str, text: str):
    splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=100)
    chunks = splitter.split_text(text)

    persist_dir = f"{CHROMA_PATH}/{arxiv_id.replace('/', '_')}"
    vectorstore = Chroma.from_texts(
        chunks,
        embedding=embeddings,
        persist_directory=persist_dir
    )

    _sessions[arxiv_id] = vectorstore
    # Preload model at build time so first question is fast
    get_model()
    return True


def ask_question(arxiv_id: str, question: str) -> str:
    if arxiv_id not in _sessions:
        return "Paper not loaded. Please analyze it first."

    vectorstore = _sessions[arxiv_id]
    docs = vectorstore.similarity_search(question, k=3)
    context = "\n\n".join([doc.page_content for doc in docs])

    prompt = f"""Answer the question based on the research paper context below.

Context:
{context}

Question: {question}

Answer:"""

    return generate_answer(prompt)