"""Seed the database with default categories and a default import profile for docs demo CSVs. No default person or account; first user is created via signup."""

import json
from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.import_profile import ImportProfile

DEFAULT_CATEGORIES = [
    # (name, parent_name_or_None, is_income, sort_order)
    ("Income", None, True, 0),
    ("Salary", "Income", True, 1),
    ("Freelance", "Income", True, 2),
    ("Investments", "Income", True, 3),
    ("Other Income", "Income", True, 4),

    ("Housing", None, False, 10),
    ("Rent", "Housing", False, 11),
    ("Mortgage", "Housing", False, 12),
    ("Utilities", "Housing", False, 13),
    ("Internet & Phone", "Housing", False, 14),
    ("Insurance", "Housing", False, 15),

    ("Food & Drink", None, False, 20),
    ("Groceries", "Food & Drink", False, 21),
    ("Restaurants", "Food & Drink", False, 22),
    ("Coffee", "Food & Drink", False, 23),
    ("Takeaway", "Food & Drink", False, 24),

    ("Transport", None, False, 30),
    ("Public Transit", "Transport", False, 31),
    ("Fuel", "Transport", False, 32),
    ("Parking", "Transport", False, 33),
    ("Taxi & Rideshare", "Transport", False, 34),
    ("Car Insurance", "Transport", False, 35),
    ("Car Maintenance", "Transport", False, 36),

    ("Shopping", None, False, 40),
    ("Clothing", "Shopping", False, 41),
    ("Electronics", "Shopping", False, 42),
    ("Home & Garden", "Shopping", False, 43),
    ("Online Shopping", "Shopping", False, 44),

    ("Health", None, False, 50),
    ("Pharmacy", "Health", False, 51),
    ("Doctor", "Health", False, 52),
    ("Gym & Fitness", "Health", False, 53),

    ("Entertainment", None, False, 60),
    ("Subscriptions", "Entertainment", False, 61),
    ("Streaming", "Entertainment", False, 62),
    ("Hobbies", "Entertainment", False, 63),
    ("Events & Tickets", "Entertainment", False, 64),

    ("Travel", None, False, 70),
    ("Flights", "Travel", False, 71),
    ("Hotels", "Travel", False, 72),
    ("Vacation", "Travel", False, 73),

    ("Education", None, False, 80),
    ("Books", "Education", False, 81),
    ("Courses", "Education", False, 82),

    ("Financial", None, False, 90),
    ("Bank Fees", "Financial", False, 91),
    ("Taxes", "Financial", False, 92),
    ("Savings Transfer", "Financial", False, 93),
    ("Investment Transfer", "Financial", False, 94),

    ("Other", None, False, 100),
    ("Cash Withdrawal", "Other", False, 101),
    ("Gifts", "Other", False, 102),
    ("Donations", "Other", False, 103),
    ("Uncategorized", "Other", False, 999),
]


def seed_categories(db: Session) -> None:
    if db.query(Category).count() > 0:
        return

    name_to_id: dict[str, int] = {}

    for name, parent_name, is_income, sort_order in DEFAULT_CATEGORIES:
        parent_id = name_to_id.get(parent_name) if parent_name else None
        cat = Category(
            name=name,
            parent_id=parent_id,
            is_income=is_income,
            sort_order=sort_order,
        )
        db.add(cat)
        db.flush()
        name_to_id[name] = cat.id

    db.commit()


# Matches docs/example_MainAcc_mt940.csv and docs/example_savings.csv (Datum;Betrag;Beschreibung;Auftraggeber/Empfänger)
DEFAULT_IMPORT_PROFILE_NAME = "Docs demo (German CSV)"


def seed_default_import_profile(db: Session) -> None:
    if db.query(ImportProfile).filter(ImportProfile.name == DEFAULT_IMPORT_PROFILE_NAME).first():
        return
    profile = ImportProfile(
        name=DEFAULT_IMPORT_PROFILE_NAME,
        format="csv",
        delimiter=";",
        date_column="Datum",
        amount_column="Betrag",
        currency_column=None,
        merchant_columns_json=json.dumps(["Auftraggeber/Empfänger"]),
        description_columns_json=json.dumps(["Beschreibung", "Auftraggeber/Empfänger"]),
        enabled=True,
    )
    db.add(profile)
    db.commit()
