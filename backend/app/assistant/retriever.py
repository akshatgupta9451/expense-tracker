"""In-memory TF-IDF retriever over a user's documents (LangChain BaseRetriever).

Built per request from the user's own data, so there is no vector store to keep in sync and
no embedding API to call; a few hundred short documents index in milliseconds.
"""

from typing import Any

from langchain_core.callbacks import CallbackManagerForRetrieverRun
from langchain_core.documents import Document
from langchain_core.retrievers import BaseRetriever
from pydantic import ConfigDict
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import linear_kernel


class TfidfRetriever(BaseRetriever):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    docs: list[Document]
    vectorizer: Any
    matrix: Any
    k: int = 8

    @classmethod
    def from_documents(cls, docs: list[Document], k: int = 8) -> "TfidfRetriever":
        vectorizer = TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True, stop_words="english")
        matrix = vectorizer.fit_transform(d.page_content for d in docs)
        return cls(docs=docs, vectorizer=vectorizer, matrix=matrix, k=k)

    def _get_relevant_documents(
        self, query: str, *, run_manager: CallbackManagerForRetrieverRun
    ) -> list[Document]:
        scores = linear_kernel(self.vectorizer.transform([query]), self.matrix).ravel()
        ranked = scores.argsort()[::-1][: self.k]
        return [self.docs[i] for i in ranked if scores[i] > 0]
