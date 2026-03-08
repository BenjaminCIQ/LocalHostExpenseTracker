from app.parsers.base import BankParser
from app.parsers.csv_parser import CSVBankParser

_PARSERS: list[BankParser] = [
    CSVBankParser(),
]


def detect_parser(file_content: str, filename: str) -> BankParser | None:
    """Return the first parser that can handle the given file, or None."""
    for parser in _PARSERS:
        if parser.can_parse(file_content, filename):
            return parser
    return None


def get_available_formats() -> list[str]:
    return [p.format_name for p in _PARSERS]
