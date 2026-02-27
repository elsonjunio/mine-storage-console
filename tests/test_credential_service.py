import pytest
from mine_backend.services.credential_service import CredentialService
from mine_backend.exceptions.application import InconsistentDataError


@pytest.fixture
def service(mock_admin):
    return CredentialService(storage_admin=mock_admin)


class TestListCredentials:
    def test_delegates_to_list_service_accounts(self, service, mock_admin):
        mock_admin.list_service_accounts.return_value = ['cred1', 'cred2']
        result = service.list_credentials('alice')
        mock_admin.list_service_accounts.assert_called_once_with('alice')
        assert result == ['cred1', 'cred2']

    def test_runtime_error_raises_inconsistent_data(self, service, mock_admin):
        mock_admin.list_service_accounts.side_effect = RuntimeError('fail')
        with pytest.raises(InconsistentDataError):
            service.list_credentials('alice')


class TestCreateCredential:
    def test_without_policy_calls_create_service_account_with_none_path(self, service, mock_admin):
        mock_admin.create_service_account.return_value = {'access_key': 'AK'}
        result = service.create_credential('alice', None, '2025-01-01')
        mock_admin.create_service_account.assert_called_once_with('alice', None, '2025-01-01')
        assert result == {'access_key': 'AK'}

    def test_without_policy_no_expiration(self, service, mock_admin):
        service.create_credential('alice')
        mock_admin.create_service_account.assert_called_once_with('alice', None, None)

    def test_with_policy_calls_create_service_account_with_json_file_path(self, service, mock_admin):
        mock_admin.create_service_account.return_value = {'access_key': 'AK'}
        policy = {'Version': '2012-10-17', 'Statement': []}

        service.create_credential('alice', policy, '2025-01-01')

        mock_admin.create_service_account.assert_called_once()
        args = mock_admin.create_service_account.call_args[0]
        assert args[0] == 'alice'
        assert args[1] is not None
        assert isinstance(args[1], str)
        assert args[1].endswith('.json')
        assert args[2] == '2025-01-01'

    def test_runtime_error_raises_inconsistent_data(self, service, mock_admin):
        mock_admin.create_service_account.side_effect = RuntimeError('fail')
        with pytest.raises(InconsistentDataError):
            service.create_credential('alice')


class TestDeleteCredential:
    def test_delegates_to_delete_service_account(self, service, mock_admin):
        service.delete_credential('ACCESS_KEY_123')
        mock_admin.delete_service_account.assert_called_once_with('ACCESS_KEY_123')

    def test_runtime_error_raises_inconsistent_data(self, service, mock_admin):
        mock_admin.delete_service_account.side_effect = RuntimeError('fail')
        with pytest.raises(InconsistentDataError):
            service.delete_credential('ACCESS_KEY_123')
