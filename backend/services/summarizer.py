from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
import torch

_model = None
_tokenizer = None
MODEL_NAME = "google/flan-t5-base"


def load_model():
    global _model, _tokenizer
    if _model is None:
        print(f"[summarizer] Loading {MODEL_NAME}...")
        _tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
        _model = AutoModelForSeq2SeqLM.from_pretrained(MODEL_NAME)
        _model.eval()
        if torch.cuda.is_available():
            _model = _model.cuda()
        print("[summarizer] Model loaded.")


def generate(prompt: str, max_new_tokens: int = 200) -> str:
    load_model()
    device = "cuda" if torch.cuda.is_available() else "cpu"
    inputs = _tokenizer(
        prompt,
        return_tensors="pt",
        truncation=True,
        max_length=512
    ).to(device)

    with torch.no_grad():
        outputs = _model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            do_sample=False
        )

    return _tokenizer.decode(outputs[0], skip_special_tokens=True)


def summarize_paper(text: str) -> dict:
    words = text.split()
    max_words = min(len(words), 3600)
    chunk_size = 600

    chunks = [
        " ".join(words[i:i + chunk_size])
        for i in range(0, max_words, chunk_size)
    ]

    summaries = []
    for chunk in chunks[:4]:
        prompt = f"Summarize the following research paper excerpt in 3-4 clear sentences:\n\n{chunk}"
        result = generate(prompt, max_new_tokens=200)
        summaries.append(result)

    return {
        "full_summary": " ".join(summaries),
        "sections": summaries
    }