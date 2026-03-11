import arxiv
import fitz
import os
from dotenv import load_dotenv
from utils.text_cleaner import clean_paper_text

load_dotenv()
PDF_PATH = os.getenv("PDF_STORAGE_PATH", "../../storage/pdfs")

def fetch_paper(arxiv_id: str) -> dict:
    os.makedirs(PDF_PATH, exist_ok=True)
    
    search = arxiv.Search(id_list=[arxiv_id])
    paper = next(search.results())
    
    pdf_path = f"{PDF_PATH}/{arxiv_id.replace('/', '_')}.pdf"
    paper.download_pdf(filename=pdf_path)
    
    doc = fitz.open(pdf_path)
    raw_text = "\n".join([page.get_text() for page in doc])
    cleaned_text = clean_paper_text(raw_text)
    
    return {
        "text": cleaned_text,
        "raw_text": raw_text,
        "title": paper.title,
        "authors": [str(a) for a in paper.authors],
        "abstract": paper.summary,
        "published": str(paper.published),
        "arxiv_id": arxiv_id
    }