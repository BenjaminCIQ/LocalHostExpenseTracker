import pytest

from app.parsers.csv_parser import CSVBankParser


def test_parses_german_semicolon_csv(sample_csv: str):
    parser = CSVBankParser()
    txns = parser.parse(sample_csv, "export.csv")
    assert len(txns) == 3

    t0 = txns[0]
    assert str(t0.date) == "2026-01-02"
    assert t0.amount == pytest.approx(-42.50)
    assert "REWE" in t0.raw_description.upper()
    assert t0.merchant != ""

    t2 = txns[2]
    assert t2.amount == pytest.approx(2500.00)


def test_parses_english_comma_csv():
    content = "\n".join(
        [
            "Date,Amount,Description,Merchant",
            "2026-01-02,-12.34,Coffee Shop,Starbucks",
        ]
    )
    parser = CSVBankParser()
    txns = parser.parse(content, "transactions.csv")
    assert len(txns) == 1
    assert str(txns[0].date) == "2026-01-02"
    assert txns[0].amount == pytest.approx(-12.34)
    assert "starbucks" in txns[0].merchant.lower()


def test_header_detection_skips_preamble():
    content = "\n".join(
        [
            "Some preamble line",
            "Another line",
            "Datum;Betrag;Beschreibung",
            "01.01.2026;-1,00;Test",
        ]
    )
    parser = CSVBankParser()
    txns = parser.parse(content, "x.csv")
    assert len(txns) == 1


def test_missing_date_or_amount_raises():
    content = "\n".join(["Description;Merchant", "Test;X"])
    parser = CSVBankParser()
    with pytest.raises(ValueError):
        parser.parse(content, "bad.csv")

