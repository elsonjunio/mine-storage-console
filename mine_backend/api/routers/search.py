from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from mine_backend.api.dependencies.auth import get_current_user
from mine_backend.api.dependencies.authorization import is_admin
from mine_backend.api.schemas.response import StandardResponse
from mine_backend.api.utils.response import success_response
from mine_backend.config import get_admin, get_s3_client
from mine_backend.core.security import extract_sts_credentials
from mine_backend.services.search_service import SearchService


router = APIRouter(prefix='/search', tags=['search'])


def get_search_service(
    session: dict = Depends(get_current_user),
) -> SearchService:
    sts = extract_sts_credentials(session)
    s3_client = get_s3_client(sts)
    storage_admin = get_admin()
    admin = is_admin(session)
    return SearchService(s3_client, storage_admin, admin)


class SearchRequest(BaseModel):
    query: str


class SearchCreatedResponse(BaseModel):
    search_id: str


@router.post('', response_model=StandardResponse[SearchCreatedResponse])
async def create_search(
    body: SearchRequest,
    service: SearchService = Depends(get_search_service),
):
    search_id = await service.create_session(body.query)
    return success_response({'search_id': search_id})


@router.get('/{search_id}/stream')
async def stream_search(
    search_id: str,
    service: SearchService = Depends(get_search_service),
):
    async def event_generator():
        async for chunk in service.stream_results(search_id):
            yield chunk

    return StreamingResponse(
        event_generator(),
        media_type='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
            'Connection': 'keep-alive',
        },
    )


@router.delete('/{search_id}', response_model=StandardResponse[dict])
async def cancel_search(
    search_id: str,
    service: SearchService = Depends(get_search_service),
):
    await service.cancel_session(search_id)
    return success_response({'cancelled': True})
