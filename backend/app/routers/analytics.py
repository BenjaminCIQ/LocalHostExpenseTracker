from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.analytics import (
    CategoryBreakdownResponse,
    MerchantRankingResponse,
    NetWorthResponse,
    OutlierResponse,
    SankeyResponse,
    TimeseriesResponse,
)
from app.services.analytics_service import (
    AnalyticsFilters,
    get_category_breakdown,
    get_merchant_ranking,
    get_net_worth,
    get_sankey_data,
    get_timeseries,
)
from app.services.outlier_service import detect_outliers
from app.services.recurring_service import detect_recurring_transactions

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


def _parse_category_ids(category_ids: str | None) -> list[int] | None:
    if not category_ids:
        return None
    values: list[int] = []
    for part in category_ids.split(","):
        part = part.strip()
        if not part:
            continue
        try:
            values.append(int(part))
        except ValueError:
            continue
    return values or None


@router.get("/timeseries", response_model=TimeseriesResponse)
def timeseries(
    start_date: date | None = None,
    end_date: date | None = None,
    account_id: int | None = None,
    person_id: int | None = None,
    category_ids: str | None = Query(None, description="Comma separated category ids"),
    trip_id: int | None = Query(None, description="Trip id filter with include/exclude overrides"),
    include_transfers: bool | None = Query(None, description="Include internal transfers in aggregates"),
    granularity: str = Query("monthly", pattern="^(daily|weekly|monthly|quarterly|yearly)$"),
    db: Session = Depends(get_db),
):
    filters = AnalyticsFilters(
        start_date=start_date,
        end_date=end_date,
        account_id=account_id,
        person_id=person_id,
        category_ids=_parse_category_ids(category_ids),
        include_transfers=include_transfers if include_transfers is not None else account_id is not None,
        trip_id=trip_id,
    )
    return {"points": get_timeseries(db, filters, granularity=granularity)}


@router.get("/category-breakdown", response_model=CategoryBreakdownResponse)
def category_breakdown(
    start_date: date | None = None,
    end_date: date | None = None,
    account_id: int | None = None,
    person_id: int | None = None,
    category_ids: str | None = Query(None, description="Comma separated category ids"),
    trip_id: int | None = Query(None, description="Trip id filter with include/exclude overrides"),
    include_transfers: bool | None = Query(None, description="Include internal transfers in aggregates"),
    db: Session = Depends(get_db),
):
    filters = AnalyticsFilters(
        start_date=start_date,
        end_date=end_date,
        account_id=account_id,
        person_id=person_id,
        category_ids=_parse_category_ids(category_ids),
        include_transfers=include_transfers if include_transfers is not None else account_id is not None,
        trip_id=trip_id,
    )
    return {"items": get_category_breakdown(db, filters)}


@router.get("/sankey", response_model=SankeyResponse)
def sankey(
    start_date: date | None = None,
    end_date: date | None = None,
    account_id: int | None = None,
    person_id: int | None = None,
    category_ids: str | None = Query(None, description="Comma separated category ids"),
    trip_id: int | None = Query(None, description="Trip id filter with include/exclude overrides"),
    include_transfers: bool | None = Query(None, description="Include internal transfers in aggregates"),
    db: Session = Depends(get_db),
):
    filters = AnalyticsFilters(
        start_date=start_date,
        end_date=end_date,
        account_id=account_id,
        person_id=person_id,
        category_ids=_parse_category_ids(category_ids),
        include_transfers=include_transfers if include_transfers is not None else account_id is not None,
        trip_id=trip_id,
    )
    return get_sankey_data(db, filters)


@router.get("/merchant-ranking", response_model=MerchantRankingResponse)
def merchant_ranking(
    start_date: date | None = None,
    end_date: date | None = None,
    account_id: int | None = None,
    person_id: int | None = None,
    category_ids: str | None = Query(None, description="Comma separated category ids"),
    trip_id: int | None = Query(None, description="Trip id filter with include/exclude overrides"),
    include_transfers: bool | None = Query(None, description="Include internal transfers in aggregates"),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    filters = AnalyticsFilters(
        start_date=start_date,
        end_date=end_date,
        account_id=account_id,
        person_id=person_id,
        category_ids=_parse_category_ids(category_ids),
        include_transfers=include_transfers if include_transfers is not None else account_id is not None,
        trip_id=trip_id,
    )
    return {"items": get_merchant_ranking(db, filters, limit=limit)}


@router.get("/outliers", response_model=OutlierResponse)
def outliers(
    start_date: date | None = None,
    end_date: date | None = None,
    account_id: int | None = None,
    person_id: int | None = None,
    category_ids: str | None = Query(None, description="Comma separated category ids"),
    trip_id: int | None = Query(None, description="Trip id filter with include/exclude overrides"),
    include_transfers: bool | None = Query(None, description="Include internal transfers in aggregates"),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    filters = AnalyticsFilters(
        start_date=start_date,
        end_date=end_date,
        account_id=account_id,
        person_id=person_id,
        category_ids=_parse_category_ids(category_ids),
        include_transfers=include_transfers if include_transfers is not None else account_id is not None,
        trip_id=trip_id,
    )
    return {"items": detect_outliers(db, filters, limit=limit)}


@router.get("/net-worth", response_model=NetWorthResponse)
def net_worth(
    person_id: int | None = None,
    db: Session = Depends(get_db),
):
    return get_net_worth(db, person_id=person_id)


@router.get("/recurring")
def recurring(
    start_date: date | None = None,
    end_date: date | None = None,
    account_id: int | None = None,
    person_id: int | None = None,
    min_occurrences: int = Query(3, ge=2, le=10),
    db: Session = Depends(get_db),
):
    filters = AnalyticsFilters(
        start_date=start_date,
        end_date=end_date,
        account_id=account_id,
        person_id=person_id,
    )
    return {"items": detect_recurring_transactions(db, filters, min_occurrences=min_occurrences)}
