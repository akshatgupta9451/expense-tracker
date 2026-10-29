import pytest

from app.ml import categorizer
from app.ml.training_data import TRAINING_DATA
from app.seed import DEFAULT_CATEGORIES, EXPENSE


def test_labels_match_seeded_expense_categories():
    seeded = {name for name, type_, *_ in DEFAULT_CATEGORIES if type_ == EXPENSE}
    assert set(TRAINING_DATA) == seeded


def test_normalize_joins_possessives_and_drops_noise():
    assert (
        categorizer.normalize("Bought burger from McDonald's!! #2")
        == "bought burger from mcdonalds"
    )


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("Bought burger from McDonald's", "Food & Dining"),
        ("Uber to the office", "Transport"),
        ("paid electricity bill", "Utilities"),
        ("Netflix monthly", "Subscriptions"),
        ("flight to Mumbai", "Travel"),
        ("rent for october", "Housing & Rent"),
        ("medicines from pharmacy", "Health"),
        ("weekly groceries from DMart", "Groceries"),
    ],
)
def test_predicts_common_expenses(text, expected):
    assert categorizer.predict(text).category == expected


def test_gibberish_and_empty_fall_back():
    assert categorizer.predict("!!! 123").category == categorizer.FALLBACK_CATEGORY
    assert categorizer.predict("!!! 123").confidence == 0.0
    unsure = categorizer.predict("qwzx")
    assert unsure.category == categorizer.FALLBACK_CATEGORY
    assert categorizer.FALLBACK_CATEGORY not in [name for name, _ in unsure.alternatives]


def test_prediction_shape():
    p = categorizer.predict("pizza from Domino's")
    assert 0 < p.confidence <= 1
    assert len(p.alternatives) == 2
    assert all(c <= p.confidence for _, c in p.alternatives)
