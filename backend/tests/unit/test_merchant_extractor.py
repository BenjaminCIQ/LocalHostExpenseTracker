from app.parsers.merchant_extractor import extract_merchant


def test_strips_sepa_noise():
    raw = "SEPA-LASTSCHRIFT Spotify AB 4829174"
    merchant = extract_merchant(raw)
    assert "SEPA" not in merchant.upper()
    assert "SPOTIFY" in merchant.upper()


def test_strips_pos_and_long_numbers():
    raw = "POS 123456 REWE SAGT DANKE//KOELN/DE"
    merchant = extract_merchant(raw)
    assert "POS" not in merchant.upper()
    assert "123456" not in merchant
    assert "REWE" in merchant.upper()
    assert "//" not in merchant


def test_strips_iban_and_bic():
    raw = "UEBERWEISUNG DE12 3456 7890 1234 5678 90 BIC: ABCDDEFFXXX Amazon"
    merchant = extract_merchant(raw)
    assert "DE12" not in merchant
    assert "BIC" not in merchant.upper()
    assert "AMAZON" in merchant.upper()


def test_strips_dates():
    raw = "PAYMENT 31.12.2025 NETFLIX"
    merchant = extract_merchant(raw)
    assert "31.12.2025" not in merchant
    assert "NETFLIX" in merchant.upper()


def test_fallback_when_everything_removed():
    raw = "123456 789012 345678"
    merchant = extract_merchant(raw)
    assert merchant != ""
    assert len(merchant) <= 80


def test_empty_string():
    assert extract_merchant("   ") == ""

