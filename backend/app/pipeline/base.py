from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class ClassificationResult:
    category_id: int | None = None
    confidence: float = 0.0
    source: str = ""
    stage_name: str = ""

    @property
    def is_classified(self) -> bool:
        return self.category_id is not None


@dataclass
class TransactionContext:
    """All data available to pipeline stages for classification."""

    transaction_id: int
    description: str
    raw_description: str
    merchant: str
    amount: float
    date: str


class PipelineStage(ABC):
    """Base interface for all classification pipeline stages.

    Each stage inspects the transaction and either returns a confident
    ClassificationResult or returns None to pass to the next stage.
    """

    @property
    @abstractmethod
    def name(self) -> str:
        ...

    @property
    @abstractmethod
    def enabled(self) -> bool:
        ...

    @abstractmethod
    def classify(self, ctx: TransactionContext) -> ClassificationResult | None:
        ...
