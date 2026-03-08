"""Seed the database with default categories and a default account."""

from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.category import Category

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


def seed_default_account(db: Session) -> None:
    if db.query(Account).count() > 0:
        return

    account = Account(
        name="Main Account",
        bank_name="",
        account_type="checking",
        currency="EUR",
        owner="",
    )
    db.add(account)
    db.commit()
