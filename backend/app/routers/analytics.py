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
    SpendingHabitsResponse,
)
from app.services.analytics_service import (
    AnalyticsFilters,
    get_category_breakdown,
    get_merchant_ranking,
    get_net_worth,
    get_sankey_data,
    get_timeseries,
    get_spending_habits,
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


def _parse_int_list(values: str | None) -> list[int] | None:
    if not values:
        return None
    out: list[int] = []
    for part in values.split(","):
        part = part.strip()
        if not part:
            continue
        try:
            out.append(int(part))
        except ValueError:
            continue
    return out or None


def _parse_string_list(values: str | None) -> list[str] | None:
    if not values:
        return None
    out = [part.strip() for part in values.split(",") if part.strip()]
    return out or None


@router.get("/timeseries", response_model=TimeseriesResponse)
def timeseries(
    start_date: date | None = None,
    end_date: date | None = None,
    account_id: int | None = None,
    person_id: int | None = None,
    category_ids: str | None = Query(None, description="Comma separated category ids"),
    merchant_names: str | None = Query(None, description="Comma separated merchant names"),
    trip_id: int | None = Query(None, description="Trip id filter with include/exclude overrides"),
    exclude_trip_included: bool = Query(False, description="Exclude transactions manually marked include on trip tool"),
    excluded_trip_ids: str | None = Query(None, description="Comma separated trip ids to scope exclusion"),
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
        merchant_names=_parse_string_list(merchant_names),
        include_transfers=include_transfers if include_transfers is not None else False,
        trip_id=trip_id,
        exclude_trip_included=exclude_trip_included,
        excluded_trip_ids=_parse_int_list(excluded_trip_ids),
    )
    return {"points": get_timeseries(db, filters, granularity=granularity)}


@router.get("/category-breakdown", response_model=CategoryBreakdownResponse)
def category_breakdown(
    start_date: date | None = None,
    end_date: date | None = None,
    account_id: int | None = None,
    person_id: int | None = None,
    category_ids: str | None = Query(None, description="Comma separated category ids"),
    merchant_names: str | None = Query(None, description="Comma separated merchant names"),
    trip_id: int | None = Query(None, description="Trip id filter with include/exclude overrides"),
    exclude_trip_included: bool = Query(False, description="Exclude transactions manually marked include on trip tool"),
    excluded_trip_ids: str | None = Query(None, description="Comma separated trip ids to scope exclusion"),
    include_transfers: bool | None = Query(None, description="Include internal transfers in aggregates"),
    db: Session = Depends(get_db),
):
    filters = AnalyticsFilters(
        start_date=start_date,
        end_date=end_date,
        account_id=account_id,
        person_id=person_id,
        category_ids=_parse_category_ids(category_ids),
        merchant_names=_parse_string_list(merchant_names),
        include_transfers=include_transfers if include_transfers is not None else False,
        trip_id=trip_id,
        exclude_trip_included=exclude_trip_included,
        excluded_trip_ids=_parse_int_list(excluded_trip_ids),
    )
    return {"items": get_category_breakdown(db, filters)}


@router.get("/sankey", response_model=SankeyResponse)
def sankey(
    start_date: date | None = None,
    end_date: date | None = None,
    account_id: int | None = None,
    person_id: int | None = None,
    category_ids: str | None = Query(None, description="Comma separated category ids"),
    merchant_names: str | None = Query(None, description="Comma separated merchant names"),
    trip_id: int | None = Query(None, description="Trip id filter with include/exclude overrides"),
    exclude_trip_included: bool = Query(False, description="Exclude transactions manually marked include on trip tool"),
    excluded_trip_ids: str | None = Query(None, description="Comma separated trip ids to scope exclusion"),
    include_transfers: bool | None = Query(None, description="Include internal transfers in aggregates"),
    db: Session = Depends(get_db),
):
    filters = AnalyticsFilters(
        start_date=start_date,
        end_date=end_date,
        account_id=account_id,
        person_id=person_id,
        category_ids=_parse_category_ids(category_ids),
        merchant_names=_parse_string_list(merchant_names),
        include_transfers=include_transfers if include_transfers is not None else False,
        trip_id=trip_id,
        exclude_trip_included=exclude_trip_included,
        excluded_trip_ids=_parse_int_list(excluded_trip_ids),
    )
    return get_sankey_data(db, filters)


@router.get("/merchant-ranking", response_model=MerchantRankingResponse)
def merchant_ranking(
    start_date: date | None = None,
    end_date: date | None = None,
    account_id: int | None = None,
    person_id: int | None = None,
    category_ids: str | None = Query(None, description="Comma separated category ids"),
    merchant_names: str | None = Query(None, description="Comma separated merchant names"),
    trip_id: int | None = Query(None, description="Trip id filter with include/exclude overrides"),
    exclude_trip_included: bool = Query(False, description="Exclude transactions manually marked include on trip tool"),
    excluded_trip_ids: str | None = Query(None, description="Comma separated trip ids to scope exclusion"),
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
        merchant_names=_parse_string_list(merchant_names),
        include_transfers=include_transfers if include_transfers is not None else False,
        trip_id=trip_id,
        exclude_trip_included=exclude_trip_included,
        excluded_trip_ids=_parse_int_list(excluded_trip_ids),
    )
    return {"items": get_merchant_ranking(db, filters, limit=limit)}


@router.get("/outliers", response_model=OutlierResponse)
def outliers(
    start_date: date | None = None,
    end_date: date | None = None,
    account_id: int | None = None,
    person_id: int | None = None,
    category_ids: str | None = Query(None, description="Comma separated category ids"),
    merchant_names: str | None = Query(None, description="Comma separated merchant names"),
    trip_id: int | None = Query(None, description="Trip id filter with include/exclude overrides"),
    exclude_trip_included: bool = Query(False, description="Exclude transactions manually marked include on trip tool"),
    excluded_trip_ids: str | None = Query(None, description="Comma separated trip ids to scope exclusion"),
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
        merchant_names=_parse_string_list(merchant_names),
        include_transfers=include_transfers if include_transfers is not None else False,
        trip_id=trip_id,
        exclude_trip_included=exclude_trip_included,
        excluded_trip_ids=_parse_int_list(excluded_trip_ids),
    )
    return {"items": detect_outliers(db, filters, limit=limit)}



@router.get("/spending-habits", response_model=SpendingHabitsResponse)
def spending_habits(
    start_date: date | None = None,
    end_date: date | None = None,
    account_id: int | None = None,
    person_id: int | None = None,
    category_ids: str | None = Query(None, description="Comma separated category ids"),
    merchant_names: str | None = Query(None, description="Comma separated merchant names"),
    trip_id: int | None = Query(None, description="Trip id filter with include/exclude overrides"),
    exclude_trip_included: bool = Query(False, description="Exclude transactions manually marked include on trip tool"),
    excluded_trip_ids: str | None = Query(None, description="Comma separated trip ids to scope exclusion"),
    include_transfers: bool | None = Query(None, description="Include internal transfers in aggregates"),
    db: Session = Depends(get_db),
):
    filters = AnalyticsFilters(
        start_date=start_date,
        end_date=end_date,
        account_id=account_id,
        person_id=person_id,
        category_ids=_parse_category_ids(category_ids),
        merchant_names=_parse_string_list(merchant_names),
        include_transfers=include_transfers if include_transfers is not None else False,
        trip_id=trip_id,
        exclude_trip_included=exclude_trip_included,
        excluded_trip_ids=_parse_int_list(excluded_trip_ids),
    )
    return get_spending_habits(db, filters)

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
        include_transfers=False,
    )
    return {"items": detect_recurring_transactions(db, filters, min_occurrences=min_occurrences)}


