from typing import Annotated

from fastapi import APIRouter, Query, Response

from app.authentication.dependencies import CurrentUser, DbSession
from app.schemas.export import ExportQuery
from app.services import export_service

router = APIRouter(prefix="/exports", tags=["exports"])


@router.get(
    "/transactions",
    response_class=Response,
    responses={
        200: {
            "description": "The report file",
            "content": {media: {} for media in export_service.MEDIA_TYPES.values()},
        },
        400: {"description": "Too many transactions to export at once"},
    },
)
async def export_transactions(
    user: CurrentUser, db: DbSession, query: Annotated[ExportQuery, Query()]
):
    """Download transactions as CSV, Excel or PDF.

    Accepts the same filters and sort as `GET /transactions` (paging is ignored), so the file
    matches what the list shows.
    """
    file = await export_service.export_transactions(db, user, query)
    return Response(
        content=file.content,
        media_type=file.media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{file.filename}"',
            "Cache-Control": "no-store",  # financial data: don't keep copies in caches
        },
    )
