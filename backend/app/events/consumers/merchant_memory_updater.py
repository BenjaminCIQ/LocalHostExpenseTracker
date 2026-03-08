import logging

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.events.bus import Event
from app.models.merchant_memory import MerchantCategoryStats

logger = logging.getLogger(__name__)


def handle_transaction_classified(event: Event) -> None:
    """Update merchant → category frequency stats."""
    data = event.data
    merchant = data.get("merchant", "").strip()
    if not merchant:
        return

    category_id = data["category_id"]
    db: Session = SessionLocal()
    try:
        stat = (
            db.query(MerchantCategoryStats)
            .filter(
                MerchantCategoryStats.merchant == merchant,
                MerchantCategoryStats.category_id == category_id,
            )
            .first()
        )
        if stat:
            stat.count += 1
        else:
            stat = MerchantCategoryStats(
                merchant=merchant,
                category_id=category_id,
                count=1,
                confidence=0.0,
            )
            db.add(stat)

        _recalculate_confidence(db, merchant)
        db.commit()
        logger.info("Merchant memory updated: %s", merchant)
    except Exception:
        db.rollback()
        logger.exception("Failed to update merchant memory")
    finally:
        db.close()


def _recalculate_confidence(db: Session, merchant: str) -> None:
    """Set confidence = count / total_count for each category of this merchant."""
    stats = (
        db.query(MerchantCategoryStats)
        .filter(MerchantCategoryStats.merchant == merchant)
        .all()
    )
    total = sum(s.count for s in stats)
    if total == 0:
        return
    for s in stats:
        s.confidence = s.count / total
