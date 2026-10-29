"""Expense categorization: TF-IDF features + logistic regression.

The model is small enough to train in well under a second, so it is trained from
app/ml/training_data.py on first use instead of being shipped as a pickled artifact.
"""

import re
from dataclasses import dataclass
from functools import lru_cache

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import FeatureUnion, Pipeline

from app.ml.training_data import TRAINING_DATA

FALLBACK_CATEGORY = "Other Expense"
# Below this probability the top guess is not trusted and the fallback is returned instead.
MIN_CONFIDENCE = 0.15

_APOSTROPHE = re.compile(r"['’`]")
_NON_ALPHA = re.compile(r"[^a-z&+]+")


def normalize(text: str) -> str:
    """Lowercase, join possessives ("McDonald's" -> "mcdonalds"), drop digits and punctuation."""
    text = _APOSTROPHE.sub("", text.lower())
    return _NON_ALPHA.sub(" ", text).strip()


@dataclass(frozen=True)
class Prediction:
    category: str
    confidence: float
    alternatives: list[tuple[str, float]]


def build_pipeline() -> Pipeline:
    features = FeatureUnion(
        [
            # Whole words and word pairs: "movie tickets", "electricity bill".
            ("words", TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True)),
            # Character n-grams inside words: copes with typos, plurals and unseen brand spellings.
            (
                "chars",
                TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), sublinear_tf=True),
            ),
        ]
    )
    return Pipeline(
        [
            ("tfidf", features),
            ("clf", LogisticRegression(C=10.0, max_iter=2000, class_weight="balanced")),
        ]
    )


@lru_cache(maxsize=1)
def get_model() -> Pipeline:
    texts, labels = [], []
    for label, examples in TRAINING_DATA.items():
        texts += [normalize(e) for e in examples]
        labels += [label] * len(examples)
    return build_pipeline().fit(texts, labels)


def predict(text: str, top_k: int = 3) -> Prediction:
    cleaned = normalize(text)
    if not cleaned:
        return Prediction(FALLBACK_CATEGORY, 0.0, [])

    model = get_model()
    probabilities = model.predict_proba([cleaned])[0]
    ranked = sorted(zip(model.classes_, probabilities, strict=True), key=lambda p: -p[1])
    ranked = [(str(label), round(float(p), 4)) for label, p in ranked[:top_k]]

    best, confidence = ranked[0]
    if confidence < MIN_CONFIDENCE:
        # Too unsure: fall back, and offer the model's guesses as alternatives.
        alternatives = [p for p in ranked if p[0] != FALLBACK_CATEGORY]
        return Prediction(FALLBACK_CATEGORY, confidence, alternatives)
    return Prediction(best, confidence, ranked[1:])
