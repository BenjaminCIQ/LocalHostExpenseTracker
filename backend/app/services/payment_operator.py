from __future__ import annotations

import re


_OPERATORS: list[tuple[str, str]] = [
    ("paypal", "PAYPAL"),
    ("stripe", "STRIPE"),
    ("sumup", "SUMUP"),
    ("square", "SQUARE"),
    ("adyen", "ADYEN"),
    ("klarna", "KLARNA"),
    ("mollie", "MOLLIE"),
    ("worldline", "WORLDLINE"),
    ("nets", "NETS"),
    ("payone", "PAYONE"),
]


def detect_payment_operator(*parts: str | None) -> str | None:
    """Detect a payment operator token from merchant/description/raw strings."""
    text = " ".join([p for p in parts if p])
    norm = re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()
    if not norm:
        return None
    for needle, token in _OPERATORS:
        if needle in norm:
            return token
    return None


def is_payment_operator_merchant(merchant: str | None) -> bool:
    if not merchant:
        return False
    return detect_payment_operator(merchant) is not None

