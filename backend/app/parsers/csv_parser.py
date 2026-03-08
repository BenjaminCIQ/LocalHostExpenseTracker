import csv
import io
import re
from datetime import date, datetime

from app.parsers.base import BankParser, ParsedTransaction
from app.parsers.merchant_extractor import extract_merchant


_DATE_FORMATS = [
    "%d.%m.%Y",   # DE: 31.12.2025
    "%Y-%m-%d",   # ISO: 2025-12-31
    "%m/%d/%Y",   # US: 12/31/2025
    "%d/%m/%Y",   # UK: 31/12/2025
    "%d.%m.%y",   # DE short: 31.12.25
]


def _parse_date(value: str) -> date:
    value = value.strip().strip('"')
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"Unable to parse date: {value}")


def _parse_amount(value: str) -> float:
    """Handle both comma-decimal (1.234,56) and dot-decimal (1,234.56) formats."""
    value = value.strip().strip('"')
    if re.match(r"^-?[\d.]+,\d{2}$", value):
        value = value.replace(".", "").replace(",", ".")
    elif re.match(r"^-?[\d,]+\.\d{2}$", value):
        value = value.replace(",", "")
    else:
        value = value.replace(",", ".")
    return float(value)


class CSVBankParser(BankParser):
    """Generic CSV bank statement parser.

    Auto-detects delimiter and maps columns by heuristic header matching.
    Designed to handle the most common EU/US bank CSV export formats.
    """

    format_name = "csv"

    # Header keywords mapped to semantic fields (lowercase)
    _DATE_KEYWORDS = {"date", "datum", "buchungstag", "valuta", "booking date", "wertstellung"}
    _AMOUNT_KEYWORDS = {"amount", "betrag", "value", "soll/haben", "umsatz"}
    _DESC_KEYWORDS = {
        "description", "beschreibung", "verwendungszweck", "text",
        "buchungstext", "details", "reference", "purpose", "info",
        "vorgang/verwendungszweck",
    }
    _MERCHANT_KEYWORDS = {
        "merchant", "empfänger", "auftraggeber", "beneficiary",
        "payee", "beguenstigter/zahlungspflichtiger", "name",
        "auftraggeber/empfänger",
    }

    def can_parse(self, file_content: str, filename: str) -> bool:
        return filename.lower().endswith(".csv")

    def parse(self, file_content: str, filename: str) -> list[ParsedTransaction]:
        sample = file_content[:4096]
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=";,\t|")
            reader = csv.reader(io.StringIO(file_content), dialect)
        except csv.Error:
            # Fallback: choose delimiter by frequency across first few lines.
            first_lines = "\n".join(sample.splitlines()[:20])
            candidates = [";", ",", "\t", "|"]
            counts = {d: first_lines.count(d) for d in candidates}
            best = max(counts, key=counts.get)
            reader = csv.reader(io.StringIO(file_content), delimiter=best)

        header = self._find_header(reader)
        if header is None:
            raise ValueError("Could not detect CSV header row")

        col_map = self._map_columns(header)
        if "date" not in col_map or "amount" not in col_map:
            raise ValueError(
                f"CSV must contain date and amount columns. Detected: {col_map}"
            )

        transactions: list[ParsedTransaction] = []
        for row in reader:
            if not row or all(c.strip() == "" for c in row):
                continue
            try:
                txn = self._parse_row(row, col_map)
                if txn is not None:
                    transactions.append(txn)
            except (ValueError, IndexError):
                continue

        return transactions

    def _find_header(self, reader: csv.reader) -> list[str] | None:
        """Skip preamble lines and find the actual header row."""
        for row in reader:
            lower_row = [c.strip().lower().strip('"') for c in row]
            date_match = any(
                any(kw in cell for kw in self._DATE_KEYWORDS) for cell in lower_row
            )
            amount_match = any(
                any(kw in cell for kw in self._AMOUNT_KEYWORDS) for cell in lower_row
            )
            if date_match and amount_match:
                return [c.strip().strip('"') for c in row]
        return None

    def _map_columns(self, header: list[str]) -> dict[str, int]:
        col_map: dict[str, int] = {}
        for idx, col in enumerate(header):
            col_lower = col.lower()
            if any(kw in col_lower for kw in self._DATE_KEYWORDS) and "date" not in col_map:
                col_map["date"] = idx
            elif any(kw in col_lower for kw in self._AMOUNT_KEYWORDS) and "amount" not in col_map:
                col_map["amount"] = idx
            elif any(kw in col_lower for kw in self._DESC_KEYWORDS) and "description" not in col_map:
                col_map["description"] = idx
            elif any(kw in col_lower for kw in self._MERCHANT_KEYWORDS) and "merchant" not in col_map:
                col_map["merchant"] = idx
        return col_map

    def _parse_row(
        self, row: list[str], col_map: dict[str, int]
    ) -> ParsedTransaction | None:
        date_val = _parse_date(row[col_map["date"]])
        amount = _parse_amount(row[col_map["amount"]])

        raw_desc = ""
        if "description" in col_map:
            raw_desc = row[col_map["description"]].strip().strip('"')

        merchant_raw = ""
        if "merchant" in col_map:
            merchant_raw = row[col_map["merchant"]].strip().strip('"')

        full_raw = f"{merchant_raw} {raw_desc}".strip() if merchant_raw else raw_desc
        merchant = extract_merchant(merchant_raw) if merchant_raw else extract_merchant(raw_desc)
        description = full_raw if full_raw else f"Transaction {date_val}"

        return ParsedTransaction(
            date=date_val,
            amount=amount,
            raw_description=full_raw,
            description=description,
            merchant=merchant,
        )
