import re


_NOISE_PATTERNS = [
    # Structured identifiers should be stripped BEFORE generic number stripping
    # (otherwise the generic rule will break the structure and prevent matching).
    r"\bDE\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{2}\b",  # IBAN
    r"\bBIC[:\s]*\S+",
    r"\bMANDAT[:\s]*\S+",
    r"\bKREF[:\s]*\S+",
    r"\bMREF[:\s]*\S+",
    r"\bEREF[:\s]*\S+",
    r"\bGLÄUBIGER[-\s]?ID[:\s]*\S+",

    r"\b\d{4,}\b",                      # long numeric sequences (terminal IDs, refs)
    r"\bPOS\b",
    r"\bSEPA[-\s]?(LASTSCHRIFT|ÜBERWEISUNG|GUTSCHRIFT)\b",
    r"\bELV\b",
    r"\bEC\b",
    r"\bKARTENZAHLUNG\b",
    r"\bLASTSCHRIFT\b",
    r"\bDAUERAUFTRAG\b",
    r"\bÜBERWEISUNG\b",
    r"\bGUTSCHRIFT\b",
    r"\bABBUCHUNG\b",
    r"\bONLINE\s*BANKING\b",
    r"\bSVWZ[:\s]*",
    r"\bABWA[:\s]*",
    r"\b\d{2}\.\d{2}\.\d{2,4}\b",       # dates
    r"//.*",                              # everything after //
    r"/\s",
]

_COMPILED_NOISE = [re.compile(p, re.IGNORECASE) for p in _NOISE_PATTERNS]


def extract_merchant(raw_description: str) -> str:
    """Extract a cleaned merchant name from a raw bank transaction description.

    Uses heuristic regex patterns to strip common SEPA/POS noise, reference
    numbers, IBANs, and dates.  The result is a best-effort guess that the
    user can correct during manual classification.
    """
    text = raw_description.strip()
    for pattern in _COMPILED_NOISE:
        text = pattern.sub(" ", text)

    text = re.sub(r"\s{2,}", " ", text).strip()
    text = text.strip("+-., /")

    if not text:
        return raw_description.strip()[:80]

    return text[:80]
