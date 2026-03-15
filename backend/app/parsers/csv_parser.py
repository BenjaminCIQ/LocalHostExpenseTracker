import csv
import io
import json
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

    def _line_has_date_and_amount_keywords(self, cells: list[str]) -> bool:
        """True if at least one cell has a date keyword and one has an amount keyword (for header detection)."""
        lower_cells = [c.strip().lower().strip('"') for c in cells]
        has_date = any(
            any(kw in cell for kw in self._DATE_KEYWORDS) for cell in lower_cells
        )
        has_amount = any(
            any(kw in cell for kw in self._AMOUNT_KEYWORDS) for cell in lower_cells
        )
        return has_date and has_amount

    def _make_reader(self, file_content: str, delimiter: str | None):
        sample = file_content[:4096]
        if delimiter:
            return csv.reader(io.StringIO(file_content), delimiter=delimiter), delimiter
        # When file has a preamble (e.g. docs example CSVs), Sniffer can pick the wrong delimiter.
        # Find the first line that looks like a header (date + amount keywords) and infer delimiter.
        lines = sample.splitlines()[:25]
        for line in lines:
            for delim in (";", ",", "\t", "|"):
                cells = [c.strip() for c in line.split(delim)]
                if len(cells) >= 2 and self._line_has_date_and_amount_keywords(cells):
                    return csv.reader(io.StringIO(file_content), delimiter=delim), delim
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=";,\t|")
            return csv.reader(io.StringIO(file_content), dialect), dialect.delimiter
        except csv.Error:
            first_lines = "\n".join(lines)
            candidates = [";", ",", "\t", "|"]
            counts = {d: first_lines.count(d) for d in candidates}
            best = max(candidates, key=lambda d: counts.get(d, 0))
            return csv.reader(io.StringIO(file_content), delimiter=best), best

    def _row_to_line(self, row: list[str], delimiter: str) -> str:
        buf = io.StringIO()
        w = csv.writer(buf, delimiter=delimiter)
        w.writerow(row)
        return buf.getvalue().rstrip("\r\n")

    def parse_with_profile(
        self,
        file_content: str,
        filename: str,
        *,
        delimiter: str | None,
        date_column: str,
        amount_column: str,
        currency_column: str | None,
        merchant_columns: list[str],
        description_columns: list[str],
    ) -> list[ParsedTransaction]:
        reader, active_delim = self._make_reader(file_content, delimiter)
        header = self._find_header(reader)
        if header is None:
            raise ValueError("Could not detect CSV header row")

        header_clean = [c.strip().strip('"') for c in header]
        header_to_idx = {h: i for i, h in enumerate(header_clean)}

        if date_column not in header_to_idx or amount_column not in header_to_idx:
            raise ValueError("Import profile columns not found in CSV header")

        wanted_cols = set([date_column, amount_column])
        if currency_column:
            wanted_cols.add(currency_column)
        wanted_cols.update([c for c in merchant_columns if c])
        wanted_cols.update([c for c in description_columns if c])

        transactions: list[ParsedTransaction] = []
        for row in reader:
            if not row or all(c.strip() == "" for c in row):
                continue

            row_values: dict[str, str] = {}
            for col in wanted_cols:
                idx = header_to_idx.get(col)
                if idx is None or idx >= len(row):
                    row_values[col] = ""
                else:
                    row_values[col] = row[idx].strip().strip('"')

            try:
                date_val = _parse_date(row_values[date_column])
                amount = _parse_amount(row_values[amount_column])
            except ValueError:
                continue

            currency = "EUR"
            if currency_column:
                currency = (row_values.get(currency_column) or "EUR").strip().strip('"') or "EUR"

            combined_parts: list[str] = []
            for col in merchant_columns:
                v = row_values.get(col, "").strip()
                if v:
                    combined_parts.append(v)
            for col in description_columns:
                v = row_values.get(col, "").strip()
                if v:
                    combined_parts.append(v)
            combined_text = " ".join(combined_parts).strip()

            merchant = extract_merchant(combined_text) if combined_text else ""
            description = combined_text if combined_text else f"Transaction {date_val}"

            raw_row_json = json.dumps(
                {h: (row[i] if i < len(row) else "") for i, h in enumerate(header_clean)},
                ensure_ascii=False,
            )
            raw_row_line = self._row_to_line(row, active_delim)

            transactions.append(
                ParsedTransaction(
                    date=date_val,
                    amount=amount,
                    raw_description=combined_text,
                    description=description,
                    merchant=merchant,
                    currency=currency,
                    raw_row_json=raw_row_json,
                    raw_row_line=raw_row_line,
                )
            )

        return transactions

    def parse(self, file_content: str, filename: str) -> list[ParsedTransaction]:
        reader, active_delim = self._make_reader(file_content, delimiter=None)

        header = self._find_header(reader)
        if header is None:
            raise ValueError("Could not detect CSV header row")

        header_clean = [c.strip().strip('"') for c in header]
        col_map = self._map_columns(header_clean)
        if "date" not in col_map or "amount" not in col_map:
            raise ValueError(
                f"CSV must contain date and amount columns. Detected: {col_map}"
            )

        transactions: list[ParsedTransaction] = []
        for row in reader:
            if not row or all(c.strip() == "" for c in row):
                continue
            try:
                raw_row_json = json.dumps(
                    {
                        h: (row[i] if i < len(row) else "")
                        for i, h in enumerate(header_clean)
                    },
                    ensure_ascii=False,
                )
                raw_row_line = self._row_to_line(row, active_delim)

                txn = self._parse_row(
                    row,
                    col_map,
                    raw_row_json=raw_row_json,
                    raw_row_line=raw_row_line,
                )
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
        self,
        row: list[str],
        col_map: dict[str, int],
        *,
        raw_row_json: str | None = None,
        raw_row_line: str | None = None,
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
            raw_row_json=raw_row_json,
            raw_row_line=raw_row_line,
        )
