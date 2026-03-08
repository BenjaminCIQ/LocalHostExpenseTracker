from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable
import logging

logger = logging.getLogger(__name__)


@dataclass
class Event:
    name: str
    data: dict[str, Any]
    timestamp: datetime = field(default_factory=datetime.utcnow)


def TransactionClassifiedEvent(data: dict[str, Any]) -> Event:
    return Event(name="transaction_classified", data=data)


class EventBus:
    """In-process publish/subscribe event bus.

    Keeps the architectural benefit of decoupling (classification, dataset
    updates, model training, analytics) without requiring an external
    message broker -- appropriate for a local single-user application.
    """

    def __init__(self) -> None:
        self._subscribers: dict[str, list[Callable]] = defaultdict(list)

    def subscribe(self, event_name: str, handler: Callable) -> None:
        self._subscribers[event_name].append(handler)

    def publish(self, event: Event) -> None:
        handlers = self._subscribers.get(event.name, [])
        for handler in handlers:
            try:
                handler(event)
            except Exception:
                logger.exception(
                    "Event handler %s failed for event %s",
                    handler.__name__,
                    event.name,
                )


event_bus = EventBus()
