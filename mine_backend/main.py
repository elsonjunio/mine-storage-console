from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mine_backend.api.router import api_router
from contextlib import asynccontextmanager
from mine_backend.core.logging_config import setup_logger
from mine_backend.config import get_admin, settings

from mine_backend.api.exception_handlers import (
    app_exception_handler,
    unhandled_exception_handler,
)
from mine_backend.exceptions.base import AppException

from mine_backend.mcp.server import mcp

import logging

setup_logger('DEBUG')

storage_admin = get_admin()


@asynccontextmanager
async def lifespan(app: FastAPI):
    storage_admin.setup()
    #mcp.session_manager.run()
    async with mcp.session_manager.run():
        yield
    logging.info('shutdown')


app = FastAPI(title='Mine Backend', lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.add_exception_handler(AppException, app_exception_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)

app.include_router(api_router)

mcp_app = mcp.streamable_http_app()

app.add_route("/mcp", mcp_app, methods=["GET", "POST"])
app.add_route("/mcp/", mcp_app, methods=["GET", "POST"])

