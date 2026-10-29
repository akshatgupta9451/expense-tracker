from enum import StrEnum

from app.schemas.transaction import TransactionFilters


class ExportFormat(StrEnum):
    CSV = "csv"
    XLSX = "xlsx"
    PDF = "pdf"


class ExportQuery(TransactionFilters):
    """Same filters and sort as GET /transactions (paging is ignored), plus the file format."""

    format: ExportFormat = ExportFormat.CSV
