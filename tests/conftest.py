import os

# Set required env vars before any mine_backend imports happen.
# pydantic-settings prioritises env vars over .env file, so these
# override whatever the project's .env contains.
os.environ['S3_REGION'] = 'us-east-1'
os.environ['S3_ENDPOINT'] = 'localhost:9000'
os.environ['S3_ACCESS_KEY'] = 'test-access-key'
os.environ['S3_SECRET_KEY'] = 'test-secret-key'
os.environ['KEYCLOAK_URL'] = 'http://localhost:8080'
os.environ['KEYCLOAK_REALM'] = 'test-realm'
os.environ['KEYCLOAK_CLIENT_ID'] = 'test-client'
os.environ['KEYCLOAK_CLIENT_SECRET'] = 'test-client-secret'
os.environ['ADMIN_ROLE'] = 'admin'
os.environ['INTERNAL_TOKEN_SECRET'] = 'test-internal-secret'
os.environ['INTERNAL_TOKEN_EXP_MINUTES'] = '60'
os.environ['ADMIN_PATH'] = 'mine_backend'
os.environ['S3_CLIENT_PATH'] = 'mine_backend'
os.environ['OPENID_ROLE_CLAIM'] = 'realm_access.roles'

import pytest
from unittest.mock import MagicMock


@pytest.fixture
def mock_s3():
    return MagicMock()


@pytest.fixture
def mock_admin():
    return MagicMock()
