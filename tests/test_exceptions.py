from mine_backend.exceptions.base import AppException
from mine_backend.exceptions.application import (
    InvalidTokenError,
    STSCredentialsNotFoundError,
    PermissionDeniedError,
    InconsistentDataError,
    NotFoundError,
    AlreadyExistsError,
    UnexpectedError,
    ServiceUnavailableError,
)


class TestAppException:
    def test_stores_message_and_code(self):
        exc = AppException('test message', 'TEST_CODE')
        assert exc.message == 'test message'
        assert exc.code == 'TEST_CODE'

    def test_passes_message_to_super(self):
        exc = AppException('test message', 'TEST_CODE')
        assert str(exc) == 'test message'

    def test_is_exception(self):
        exc = AppException('msg', 'CODE')
        assert isinstance(exc, Exception)


class TestConcreteExceptions:
    def test_invalid_token_error_default(self):
        exc = InvalidTokenError()
        assert exc.code == 'INVALID_TOKEN'
        assert exc.message

    def test_invalid_token_error_custom_message(self):
        exc = InvalidTokenError('custom message')
        assert exc.message == 'custom message'
        assert exc.code == 'INVALID_TOKEN'

    def test_sts_credentials_not_found_error_default(self):
        exc = STSCredentialsNotFoundError()
        assert exc.code == 'STS_CREDENTIALS_NOT_FOUND'
        assert exc.message

    def test_sts_credentials_not_found_error_custom_message(self):
        exc = STSCredentialsNotFoundError('no sts')
        assert exc.message == 'no sts'
        assert exc.code == 'STS_CREDENTIALS_NOT_FOUND'

    def test_permission_denied_error_default(self):
        exc = PermissionDeniedError()
        assert exc.code == 'PERMISSION_DENIED'
        assert exc.message

    def test_permission_denied_custom_message(self):
        exc = PermissionDeniedError('you shall not pass')
        assert exc.message == 'you shall not pass'

    def test_inconsistent_data_error_default(self):
        exc = InconsistentDataError()
        assert exc.code == 'INCONSISTENT_DATA'
        assert exc.message

    def test_inconsistent_data_custom_message(self):
        exc = InconsistentDataError('bad data')
        assert exc.message == 'bad data'

    def test_not_found_error_default(self):
        exc = NotFoundError()
        assert exc.code == 'NOT_FOUND'
        assert exc.message

    def test_not_found_custom_message(self):
        exc = NotFoundError('item missing')
        assert exc.message == 'item missing'

    def test_already_exists_error_default(self):
        exc = AlreadyExistsError()
        assert exc.code == 'ALREADY_EXISTS'
        assert exc.message

    def test_already_exists_custom_message(self):
        exc = AlreadyExistsError('already there')
        assert exc.message == 'already there'

    def test_unexpected_error_default(self):
        exc = UnexpectedError()
        assert exc.code == 'UNEXPECTED_ERROR'
        assert exc.message

    def test_unexpected_error_custom_message(self):
        exc = UnexpectedError('something went wrong')
        assert exc.message == 'something went wrong'

    def test_service_unavailable_error_default(self):
        exc = ServiceUnavailableError()
        assert exc.code == 'UNAVAILABLE_ERROR'
        assert exc.message

    def test_service_unavailable_custom_message(self):
        exc = ServiceUnavailableError('service down')
        assert exc.message == 'service down'
