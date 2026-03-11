import re
from typing import List


def clean_paper_text(text: str) -> str:
    """
    Full cleaning pipeline for raw PDF-extracted text.
    Removes noise common in ArXiv papers before summarization or RAG.
    """
    text = _remove_references_section(text)
    text = _fix_hyphenated_linebreaks(text)
    text = _remove_urls(text)
    text = _remove_emails(text)
    text = _remove_page_numbers(text)
    text = _remove_latex_commands(text)
    text = _remove_figure_table_captions(text)
    text = _normalize_whitespace(text)
    return text.strip()


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 100) -> List[str]:
    """
    Splits cleaned text into overlapping word-level chunks for RAG ingestion.
    """
    words = text.split()
    chunks = []
    step = chunk_size - overlap

    for i in range(0, len(words), step):
        chunk = " ".join(words[i:i + chunk_size])
        if chunk:
            chunks.append(chunk)

    return chunks


def truncate_for_summarizer(text: str, max_words: int = 4000) -> str:
    """
    Keeps only the first N words — enough for intro + methods,
    which is what summarizers care about most.
    """
    words = text.split()
    return " ".join(words[:max_words])


def extract_sections(text: str) -> dict:
    """
    Attempts to extract named sections (Abstract, Introduction, etc.)
    Returns a dict of section_name → section_text.
    Falls back gracefully if sections aren't clearly delimited.
    """
    section_headers = [
        "abstract", "introduction", "related work", "background",
        "methodology", "method", "approach", "experiment", "experiments",
        "results", "discussion", "conclusion", "conclusions",
        "limitations", "future work", "references"
    ]

    pattern = r'(?i)(?:^|\n)(' + '|'.join(section_headers) + r')[\s\n:]*'
    splits = re.split(pattern, text)

    sections = {}
    i = 1
    while i < len(splits) - 1:
        header = splits[i].strip().lower()
        body = splits[i + 1].strip() if i + 1 < len(splits) else ""
        if header and body:
            sections[header] = _normalize_whitespace(body)
        i += 2

    return sections


# ─── Private Helpers ───────────────────────────────────────────

def _remove_references_section(text: str) -> str:
    """Strips everything from 'References' heading onward."""
    match = re.search(r'\n\s*references\s*\n', text, re.IGNORECASE)
    if match:
        return text[:match.start()]
    return text


def _fix_hyphenated_linebreaks(text: str) -> str:
    """Joins words broken across lines with a hyphen (common in PDFs)."""
    return re.sub(r'(\w)-\n(\w)', r'\1\2', text)


def _remove_urls(text: str) -> str:
    return re.sub(r'https?://\S+|www\.\S+', '', text)


def _remove_emails(text: str) -> str:
    return re.sub(r'\S+@\S+\.\S+', '', text)


def _remove_page_numbers(text: str) -> str:
    """Removes standalone page numbers on their own line."""
    return re.sub(r'^\s*\d+\s*$', '', text, flags=re.MULTILINE)


def _remove_latex_commands(text: str) -> str:
    """Removes common LaTeX artifacts that slip through PDF extraction."""
    text = re.sub(r'\\[a-zA-Z]+\{[^}]*\}', '', text)   # \command{arg}
    text = re.sub(r'\\[a-zA-Z]+', '', text)              # \command
    text = re.sub(r'\$[^$]*\$', '[FORMULA]', text)       # inline math $...$
    text = re.sub(r'\$\$[^$]*\$\$', '[FORMULA]', text)   # block math $$...$$
    return text


def _remove_figure_table_captions(text: str) -> str:
    """Removes Figure/Table caption lines."""
    text = re.sub(r'(?i)^(figure|fig\.|table)\s+\d+[^\n]*\n', '', text, flags=re.MULTILINE)
    return text


def _normalize_whitespace(text: str) -> str:
    """Collapses multiple blank lines and strips trailing spaces."""
    text = re.sub(r'[ \t]+', ' ', text)         # multiple spaces → one
    text = re.sub(r'\n{3,}', '\n\n', text)      # 3+ newlines → double
    return text