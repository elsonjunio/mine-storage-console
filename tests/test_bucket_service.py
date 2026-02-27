import pytest
from unittest.mock import MagicMock
from botocore.exceptions import ClientError

from mine_backend.services.bucket_service import BucketService
from mine_backend.exceptions.application import (
    InconsistentDataError,
    NotFoundError,
    AlreadyExistsError,
    UnexpectedError,
    PermissionDeniedError,
)


def make_client_error(code):
    return ClientError(
        {'Error': {'Code': code, 'Message': 'test error'}},
        'TestOperation',
    )


@pytest.fixture
def service(mock_s3, mock_admin):
    return BucketService(s3_client=mock_s3, storage_admin=mock_admin)


class TestBucketNameValidation:
    def test_create_bucket_too_short(self, service):
        with pytest.raises(InconsistentDataError):
            service.create_bucket('ab')

    def test_create_bucket_bad_chars_uppercase(self, service):
        with pytest.raises(InconsistentDataError):
            service.create_bucket('UPPERCASE')

    def test_create_bucket_starts_with_hyphen(self, service):
        with pytest.raises(InconsistentDataError):
            service.create_bucket('-invalid')

    def test_delete_bucket_invalid_name(self, service):
        with pytest.raises(InconsistentDataError):
            service.delete_bucket('ab')


class TestListBuckets:
    def test_returns_list_of_dicts_with_name_and_creation_date(self, service, mock_s3):
        bucket1 = MagicMock()
        bucket1.name = 'bucket-one'
        bucket1.creation_date = '2024-01-01'
        bucket2 = MagicMock()
        bucket2.name = 'bucket-two'
        bucket2.creation_date = '2024-01-02'
        mock_s3.list_buckets.return_value = [bucket1, bucket2]

        result = service.list_buckets()

        assert len(result) == 2
        assert result[0] == {'name': 'bucket-one', 'creation_date': '2024-01-01'}
        assert result[1] == {'name': 'bucket-two', 'creation_date': '2024-01-02'}

    def test_returns_empty_list_when_no_buckets(self, service, mock_s3):
        mock_s3.list_buckets.return_value = []
        result = service.list_buckets()
        assert result == []


class TestCreateBucket:
    def test_valid_name_calls_s3_create_bucket(self, service, mock_s3):
        service.create_bucket('my-bucket')
        mock_s3.create_bucket.assert_called_once_with('my-bucket')

    def test_valid_name_returns_message_dict(self, service, mock_s3):
        result = service.create_bucket('my-bucket')
        assert result['name'] == 'my-bucket'
        assert 'message' in result

    def test_invalid_name_raises_inconsistent_data(self, service):
        with pytest.raises(InconsistentDataError):
            service.create_bucket('INVALID')


class TestDeleteBucket:
    def test_valid_name_delegates_to_s3(self, service, mock_s3):
        service.delete_bucket('my-bucket')
        mock_s3.delete_bucket.assert_called_once_with('my-bucket')

    def test_valid_name_returns_message_dict(self, service, mock_s3):
        result = service.delete_bucket('my-bucket')
        assert result['name'] == 'my-bucket'
        assert 'message' in result

    def test_invalid_name_raises(self, service):
        with pytest.raises(InconsistentDataError):
            service.delete_bucket('ab')


class TestSetVersioning:
    def test_enabled_returns_enabled_string(self, service, mock_s3):
        result = service.set_versioning('my-bucket', True)
        assert result['versioning'] == 'enabled'
        assert result['bucket'] == 'my-bucket'

    def test_suspended_returns_suspended_string(self, service, mock_s3):
        result = service.set_versioning('my-bucket', False)
        assert result['versioning'] == 'suspended'

    def test_invalid_name_raises(self, service):
        with pytest.raises(InconsistentDataError):
            service.set_versioning('AB', True)


class TestGetUsage:
    def test_returns_usage_dict_with_objects_and_size(self, service, mock_s3):
        usage = MagicMock()
        usage.objects = 42
        usage.size_bytes = 1024
        mock_s3.get_bucket_usage.return_value = usage

        result = service.get_usage('my-bucket')

        assert result['objects'] == 42
        assert result['size_bytes'] == 1024
        assert result['bucket'] == 'my-bucket'

    def test_invalid_name_raises(self, service):
        with pytest.raises(InconsistentDataError):
            service.get_usage('AB')


class TestSetQuota:
    def test_quota_zero_raises_inconsistent_data(self, service):
        with pytest.raises(InconsistentDataError):
            service.set_quota('my-bucket', 0)

    def test_quota_negative_raises_inconsistent_data(self, service):
        with pytest.raises(InconsistentDataError):
            service.set_quota('my-bucket', -100)

    def test_valid_quota_converts_bytes_to_gib_string(self, service, mock_admin):
        service.set_quota('my-bucket', 1024 ** 3)
        mock_admin.set_bucket_quota.assert_called_once_with('my-bucket', '1.00GiB')

    def test_valid_quota_2_gib(self, service, mock_admin):
        service.set_quota('my-bucket', 2 * 1024 ** 3)
        mock_admin.set_bucket_quota.assert_called_once_with('my-bucket', '2.00GiB')


class TestHandleS3Error:
    def test_invalid_bucket_name_raises_inconsistent_data(self, service):
        with pytest.raises(InconsistentDataError):
            service._handle_s3_error(make_client_error('InvalidBucketName'))

    def test_bucket_already_exists_raises_already_exists(self, service):
        with pytest.raises(AlreadyExistsError):
            service._handle_s3_error(make_client_error('BucketAlreadyExists'))

    def test_bucket_already_owned_by_you_raises_already_exists(self, service):
        with pytest.raises(AlreadyExistsError):
            service._handle_s3_error(make_client_error('BucketAlreadyOwnedByYou'))

    def test_access_denied_raises_permission_denied(self, service):
        with pytest.raises(PermissionDeniedError):
            service._handle_s3_error(make_client_error('AccessDenied'))

    def test_unknown_error_raises_unexpected(self, service):
        with pytest.raises(UnexpectedError):
            service._handle_s3_error(make_client_error('SomeUnknownError'))


class TestHandleStorageAdminError:
    def test_not_found_message(self, service):
        with pytest.raises(NotFoundError):
            service._handle_storage_admin_error(RuntimeError('Resource not found'))

    def test_already_exists_message(self, service):
        with pytest.raises(AlreadyExistsError):
            service._handle_storage_admin_error(RuntimeError('already exists'))

    def test_invalid_message(self, service):
        with pytest.raises(InconsistentDataError):
            service._handle_storage_admin_error(RuntimeError('invalid parameter'))

    def test_denied_message(self, service):
        with pytest.raises(PermissionDeniedError):
            service._handle_storage_admin_error(RuntimeError('access denied'))

    def test_forbidden_message(self, service):
        with pytest.raises(PermissionDeniedError):
            service._handle_storage_admin_error(RuntimeError('forbidden action'))

    def test_other_message_raises_unexpected(self, service):
        with pytest.raises(UnexpectedError):
            service._handle_storage_admin_error(RuntimeError('something else'))


class TestBucketPolicy:
    def test_get_bucket_policy_invalid_name_raises(self, service):
        with pytest.raises(InconsistentDataError):
            service.get_bucket_policy('AB')

    def test_get_bucket_policy_delegates_and_returns_dict(self, service, mock_s3):
        mock_s3.get_bucket_policy.return_value = {'Statement': []}
        result = service.get_bucket_policy('my-bucket')
        mock_s3.get_bucket_policy.assert_called_once_with('my-bucket')
        assert result['bucket'] == 'my-bucket'
        assert 'policy' in result

    def test_put_bucket_policy_invalid_name_raises(self, service):
        with pytest.raises(InconsistentDataError):
            service.put_bucket_policy('AB', {})

    def test_put_bucket_policy_delegates_and_returns_message(self, service, mock_s3):
        result = service.put_bucket_policy('my-bucket', {'Statement': []})
        mock_s3.put_bucket_policy.assert_called_once()
        assert 'message' in result

    def test_delete_bucket_policy_invalid_name_raises(self, service):
        with pytest.raises(InconsistentDataError):
            service.delete_bucket_policy('AB')

    def test_delete_bucket_policy_delegates(self, service, mock_s3):
        result = service.delete_bucket_policy('my-bucket')
        mock_s3.delete_bucket_policy.assert_called_once_with('my-bucket')
        assert 'message' in result


class TestBucketLifecycle:
    def test_get_bucket_lifecycle_invalid_name_raises(self, service):
        with pytest.raises(InconsistentDataError):
            service.get_bucket_lifecycle('AB')

    def test_get_bucket_lifecycle_delegates(self, service, mock_s3):
        mock_s3.get_bucket_lifecycle.return_value = {}
        result = service.get_bucket_lifecycle('my-bucket')
        assert result['bucket'] == 'my-bucket'
        assert 'lifecycle' in result

    def test_put_bucket_lifecycle_delegates(self, service, mock_s3):
        result = service.put_bucket_lifecycle('my-bucket', {'Rules': []})
        mock_s3.put_bucket_lifecycle.assert_called_once()
        assert 'message' in result

    def test_delete_bucket_lifecycle_delegates(self, service, mock_s3):
        result = service.delete_bucket_lifecycle('my-bucket')
        mock_s3.delete_bucket_lifecycle.assert_called_once_with('my-bucket')
        assert 'message' in result


class TestBucketEvents:
    def test_get_bucket_events_invalid_name_raises(self, service):
        with pytest.raises(InconsistentDataError):
            service.get_bucket_events('AB')

    def test_get_bucket_events_delegates(self, service, mock_s3):
        mock_s3.get_bucket_events.return_value = {}
        result = service.get_bucket_events('my-bucket')
        assert result['bucket'] == 'my-bucket'
        assert 'events' in result

    def test_put_bucket_events_delegates(self, service, mock_s3):
        result = service.put_bucket_events('my-bucket', {'configurations': []})
        mock_s3.put_bucket_events.assert_called_once()
        assert 'message' in result

    def test_delete_bucket_events_delegates(self, service, mock_s3):
        result = service.delete_bucket_events('my-bucket')
        mock_s3.delete_bucket_events.assert_called_once_with('my-bucket')
        assert 'message' in result
