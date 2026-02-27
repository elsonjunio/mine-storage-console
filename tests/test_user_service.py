import pytest
from mine_backend.services.user_service import UserService
from mine_backend.exceptions.application import (
    InconsistentDataError,
    NotFoundError,
    AlreadyExistsError,
    UnexpectedError,
    PermissionDeniedError,
)


@pytest.fixture
def service(mock_admin):
    return UserService(storage_admin=mock_admin)


class TestUserServiceDelegation:
    def test_list_users_delegates_and_returns_result(self, service, mock_admin):
        mock_admin.list_users.return_value = ['user1', 'user2']
        result = service.list_users()
        mock_admin.list_users.assert_called_once()
        assert result == ['user1', 'user2']

    def test_get_user_delegates_with_username(self, service, mock_admin):
        mock_admin.get_user.return_value = {'username': 'alice'}
        result = service.get_user('alice')
        mock_admin.get_user.assert_called_once_with('alice')
        assert result == {'username': 'alice'}

    def test_create_user_delegates_with_credentials(self, service, mock_admin):
        mock_admin.create_user.return_value = {'created': True}
        result = service.create_user('alice', 'password123')
        mock_admin.create_user.assert_called_once_with('alice', 'password123')
        assert result == {'created': True}

    def test_delete_user_delegates_with_username(self, service, mock_admin):
        service.delete_user('alice')
        mock_admin.delete_user.assert_called_once_with('alice')

    def test_enable_user_delegates_with_username(self, service, mock_admin):
        service.enable_user('alice')
        mock_admin.enable_user.assert_called_once_with('alice')

    def test_disable_user_delegates_with_username(self, service, mock_admin):
        service.disable_user('alice')
        mock_admin.disable_user.assert_called_once_with('alice')


class TestHandleStorageAdminError:
    def test_not_found_message_raises_not_found(self, service):
        with pytest.raises(NotFoundError):
            service._handle_storage_admin_error(RuntimeError('user not found'))

    def test_already_exists_message_raises_already_exists(self, service):
        with pytest.raises(AlreadyExistsError):
            service._handle_storage_admin_error(RuntimeError('user already exists'))

    def test_invalid_message_raises_inconsistent_data(self, service):
        with pytest.raises(InconsistentDataError):
            service._handle_storage_admin_error(RuntimeError('invalid username'))

    def test_denied_message_raises_permission_denied(self, service):
        with pytest.raises(PermissionDeniedError):
            service._handle_storage_admin_error(RuntimeError('access denied'))

    def test_forbidden_message_raises_permission_denied(self, service):
        with pytest.raises(PermissionDeniedError):
            service._handle_storage_admin_error(RuntimeError('forbidden'))

    def test_other_message_raises_unexpected(self, service):
        with pytest.raises(UnexpectedError):
            service._handle_storage_admin_error(RuntimeError('something unexpected'))


class TestUserServiceErrorPropagation:
    def test_list_users_runtime_error_propagates(self, service, mock_admin):
        mock_admin.list_users.side_effect = RuntimeError('not found')
        with pytest.raises(NotFoundError):
            service.list_users()

    def test_get_user_runtime_error_propagates(self, service, mock_admin):
        mock_admin.get_user.side_effect = RuntimeError('user not found')
        with pytest.raises(NotFoundError):
            service.get_user('missing')

    def test_create_user_runtime_error_propagates(self, service, mock_admin):
        mock_admin.create_user.side_effect = RuntimeError('already exists')
        with pytest.raises(AlreadyExistsError):
            service.create_user('alice', 'pw')
