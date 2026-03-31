import os
import re
from groq import Groq
from dotenv import load_dotenv
from pathlib import Path

_SERVICE_DIR = Path(__file__).resolve().parent
_BACKEND_DIR = _SERVICE_DIR.parent
_ROOT_DIR = _BACKEND_DIR.parent
load_dotenv(_ROOT_DIR / ".env", override=False)
load_dotenv(_BACKEND_DIR / ".env", override=False)

MODEL_NAME = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")


def _get_client() -> Groq | None:
    api_key = (os.getenv("GROQ_API_KEY") or os.getenv("GROK_API_KEY") or "").strip()
    if not api_key:
        return None
    return Groq(api_key=api_key)


def _fallback_summary(chunk: str) -> str:
    # Keep service available even when remote generation is not configured.
    sentences = re.split(r"(?<=[.!?])\s+", chunk.strip())
    return " ".join(sentences[:4]).strip() or "Summary unavailable for this section."


def _generate_summary(client: Groq, chunk: str) -> str:
    response = client.chat.completions.create(
        model=MODEL_NAME,
        messages=[
            {
                "role": "system",
                "content": (
                    "You summarize research papers for technical audiences. "
                    "Write 3-6 concise, accurate sentences highlighting methods, results, "
                    "and limitations where possible."
                )
            },
            {
                "role": "user",
                "content": f"Summarize this paper excerpt:\n\n{chunk}"
            }
        ],
        temperature=0.25,
        max_tokens=150,
    )

    content = response.choices[0].message.content if response.choices else ""
    return (content or "").strip() or "Summary unavailable for this section."


def summarize_paper(text: str) -> dict:
    words = text.split()
    max_words = min(len(words), 4800)
    chunk_size = 700

    chunks = [
        " ".join(words[i:i + chunk_size])
        for i in range(0, max_words, chunk_size)
    ]

    client = _get_client()
    summaries = []
    for chunk in chunks[:4]:
        try:
            result = _generate_summary(client, chunk) if client else _fallback_summary(chunk)
        except Exception:
            result = _fallback_summary(chunk)
        summaries.append(result)

    if not summaries:
        summaries = ["Summary unavailable for this paper."]

    return {
        "full_summary": " ".join(summaries),
        "sections": summaries
    }