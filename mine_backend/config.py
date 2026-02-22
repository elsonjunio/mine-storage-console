from pydantic_settings import BaseSettings
import importlib
from functools import lru_cache


class Settings(BaseSettings, extra='allow'):
    S3_REGION: str
    S3_ENDPOINT: str
    S3_ACCESS_KEY: str
    S3_SECRET_KEY: str
    S3_SECURE: bool = False

    KEYCLOAK_URL: str
    KEYCLOAK_REALM: str
    KEYCLOAK_CLIENT_ID: str
    KEYCLOAK_CLIENT_SECRET: str

    OPENID_ROLE_CLAIM: str = 'policy'
    ADMIN_ROLE: str

    INTERNAL_TOKEN_SECRET: str
    INTERNAL_TOKEN_EXP_MINUTES: int

    ADMIN_PATH: str
    S3_CLIENT_PATH: str

    class Config:
        env_file = '.env'
        env_file_encoding = 'utf-8'

    # model_config = ConfigDict(extra="allow")


settings = Settings()


@lru_cache
def get_admin():
    """
    Carrega dinamicamente o admin driver definido em ADMIN_PATH.
    Espera que o módulo tenha uma função get_admin_client().
    """

    module = importlib.import_module(settings.ADMIN_PATH)

    if not hasattr(module, 'get_admin_client'):
        raise RuntimeError(
            f"Module '{settings.ADMIN_PATH}' must define get_admin_client()"
        )

    return module.get_admin_client()


def get_s3_client(sts_credentials: dict):

    """
    Carrega dinamicamente o s3_client driver definido em S3_CLIENT_PATH.
    Espera que o módulo tenha uma função get_s3_client(sts).
    """

    module = importlib.import_module(settings.S3_CLIENT_PATH)

    if not hasattr(module, 'get_s3_client'):
        raise RuntimeError(
            f"Module '{settings.S3_CLIENT_PATH}' must define get_s3_client()"
        )

    return module.get_s3_client(sts_credentials)
