import re
import unicodedata


def preprocess_text(text: str) -> str:
    """Normalize and clean transaction text for ML feature extraction.

    Steps:
    1. Lowercase
    2. Normalize unicode (ä→a, ö→o, etc.) for consistent vectorization
    3. Strip digits (account numbers, refs add noise, not signal)
    4. Collapse whitespace
    """
    text = text.lower()
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"\d+", " ", text)
    text = re.sub(r"[^\w\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def build_features(description: str, merchant: str) -> str:
    """Combine description and merchant into a single feature string."""
    parts = []
    if merchant:
        parts.append(preprocess_text(merchant))
    if description:
        parts.append(preprocess_text(description))
    return " ".join(parts)
