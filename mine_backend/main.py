from fastapi import FastAPI
from mine_backend.api.router import api_router
from contextlib import asynccontextmanager
from mine_backend.core.logging_config import setup_logger
from mine_backend.config import get_admin

from mine_backend.api.exception_handlers import (
    app_exception_handler,
    unhandled_exception_handler,
)
from mine_backend.exceptions.base import AppException

import logging

setup_logger('DEBUG')

storage_admin = get_admin()


@asynccontextmanager
async def lifespan(app: FastAPI):
    storage_admin.setup()
    yield
    logging.info('shutdown')


app = FastAPI(title='Mine Backend', lifespan=lifespan)

app.add_exception_handler(AppException, app_exception_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)

app.include_router(api_router)
