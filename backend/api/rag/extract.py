"""Bounded extraction, run in a disposable child process by the worker."""
import json
import re
import sys

MAX_TEXT = 150_000


def extract(path, kind):
    if kind == "TXT":
        with open(path, "rb") as stream:
            raw = stream.read(MAX_TEXT * 4 + 1)
        if len(raw) > MAX_TEXT * 4:
            raise ValueError("Text is too long; split the document.")
        pages = [("Text", raw.decode("utf-8-sig"))]
    elif kind == "PDF":
        from pypdf import PdfReader
        reader = PdfReader(path)
        if reader.is_encrypted:
            raise ValueError("Encrypted PDFs are not supported. Upload an unlocked copy.")
        if len(reader.pages) > 100:
            raise ValueError("Use PDFs with at most 100 pages.")
        pages = []
        total = 0
        for index, page in enumerate(reader.pages):
            text = page.extract_text() or ""
            total += len(text)
            if total > MAX_TEXT:
                raise ValueError("Extracted text is too long; split the document.")
            pages.append((f"Page {index + 1}", text))
    else:
        raise ValueError("Upload a text-based PDF or UTF-8 TXT file.")
    cleaned = [(location, re.sub(r"[^\S\n]+", " ", text).replace("\x00", "").strip()) for location, text in pages]
    length = sum(len(text) for _, text in cleaned)
    if length < 80:
        raise ValueError("Too little readable text. Upload a text-based PDF or TXT; scanned PDFs need OCR first.")
    if length > MAX_TEXT:
        raise ValueError("Extracted text is too long; split the document.")
    return cleaned


def chunks(pages):
    """Character-bounded paragraphs; conservative size for the embedding context."""
    result = []
    for location, text in pages:
        start = 0
        while start < len(text):
            end = min(start + 1200, len(text))
            if end < len(text):
                boundary = max(text.rfind("\n", start + 600, end), text.rfind(". ", start + 600, end))
                if boundary > start:
                    end = boundary + 1
            part = text[start:end].strip()
            if part:
                result.append((location, part))
            if end == len(text):
                break
            start = end - 120
    if len(result) > 200:
        raise ValueError("Document has too many chunks; split it into smaller files.")
    return result


if __name__ == "__main__":
    import resource
    resource.setrlimit(resource.RLIMIT_CPU, (25, 25))
    # File parsing runs with a memory cap on Linux. macOS does not reliably enforce RLIMIT_AS.
    if sys.platform.startswith("linux"):
        resource.setrlimit(resource.RLIMIT_AS, (1024**3, 1024**3))
    try:
        print(json.dumps({"chunks": chunks(extract(sys.argv[1], sys.argv[2]))}))
    except (ValueError, UnicodeError) as exc:
        print(json.dumps({"error": str(exc)[:250]}))
    except Exception:
        print(json.dumps({"error": "Could not parse this document. Try an unencrypted PDF or UTF-8 TXT."}))
