import re
import unicodedata

from app.services.payment_operator import detect_payment_operator, is_payment_operator_merchant


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
    merchant_is_operator = bool(merchant and is_payment_operator_merchant(merchant))
    if merchant and not merchant_is_operator:
        parts.append(preprocess_text(merchant))
    if description:
        desc = preprocess_text(description)
        if merchant_is_operator:
            op = detect_payment_operator(merchant)
            if op:
                desc = re.sub(rf"\b{re.escape(op.lower())}\b", " ", desc).strip()
                desc = re.sub(r"\s+", " ", desc).strip()
        if desc:
            parts.append(desc)
    return " ".join(parts)
