from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date


@dataclass
class ParsedTransaction:
    """Normalized transaction produced by any bank parser."""

    date: date
    amount: float
    raw_description: str
    description: str
    merchant: str
    currency: str = "EUR"


class BankParser(ABC):
    """Base interface for bank-specific file parsers."""

    @abstractmethod
    def can_parse(self, file_content: str, filename: str) -> bool:
        """Return True if this parser can handle the given file."""
        ...

    @abstractmethod
    def parse(self, file_content: str, filename: str) -> list[ParsedTransaction]:
        """Parse file content into normalized transactions."""
        ...

    @property
    @abstractmethod
    def format_name(self) -> str:
        ...
