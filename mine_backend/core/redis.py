from redis.asyncio import Redis
from mine_backend.config import settings

redis = (
    Redis(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        db=settings.REDIS_DB,
    )
    if settings.REDIS_HOST
    else None
)
