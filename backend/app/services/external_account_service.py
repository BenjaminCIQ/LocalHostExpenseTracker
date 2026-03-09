from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.external_account import (
    ExternalAccount,
    ExternalFundingLink,
    ExternalValuationSnapshot,
)


def get_latest_snapshot_value(db: Session, external_account_id: int) -> float | None:
    latest = (
        db.query(ExternalValuationSnapshot)
        .filter(ExternalValuationSnapshot.external_account_id == external_account_id)
        .order_by(
            ExternalValuationSnapshot.snapshot_date.desc(),
            ExternalValuationSnapshot.id.desc(),
        )
        .first()
    )
    return float(latest.value) if latest else None


def get_external_reconciliation(db: Session, external_account_id: int) -> dict:
    linked_total = (
        db.query(func.coalesce(func.sum(ExternalFundingLink.linked_amount), 0.0))
        .filter(ExternalFundingLink.external_account_id == external_account_id)
        .scalar()
    )
    links_count = (
        db.query(func.count(ExternalFundingLink.id))
        .filter(ExternalFundingLink.external_account_id == external_account_id)
        .scalar()
    )
    latest_value = get_latest_snapshot_value(db, external_account_id)
    unlinked_component = (
        round(float(latest_value) - float(linked_total or 0.0), 2)
        if latest_value is not None
        else None
    )
    return {
        "external_account_id": external_account_id,
        "latest_value": round(float(latest_value), 2) if latest_value is not None else None,
        "linked_funding_total": round(float(linked_total or 0.0), 2),
        "unlinked_component": unlinked_component,
        "links_count": int(links_count or 0),
    }


def get_external_account_summary(db: Session, person_id: int | None = None) -> dict:
    query = db.query(ExternalAccount)
    if person_id is not None:
        query = query.filter(ExternalAccount.person_id == person_id)
    accounts = query.all()
    items: list[dict] = []
    totals_by_group: dict[str, float] = {}
    linked_total = 0.0
    latest_value_total = 0.0
    for account in accounts:
        rec = get_external_reconciliation(db, account.id)
        latest_value = rec["latest_value"] or 0.0
        linked = rec["linked_funding_total"]
        latest_value_total += latest_value
        linked_total += linked
        group = account.account_group or "asset"
        signed_value = latest_value if group != "liability" else -abs(latest_value)
        totals_by_group[group] = round(totals_by_group.get(group, 0.0) + signed_value, 2)
        items.append(
            {
                "external_account_id": account.id,
                "account_name": account.name,
                "account_group": group,
                "latest_value": round(float(latest_value), 2),
                "linked_funding_total": round(float(linked), 2),
                "unlinked_component": rec["unlinked_component"],
            }
        )
    return {
        "items": items,
        "totals_by_group": totals_by_group,
        "reconciliation_summary": {
            "linked_total": round(linked_total, 2),
            "latest_value_total": round(latest_value_total, 2),
            "unlinked_total": round(latest_value_total - linked_total, 2),
        },
    }
