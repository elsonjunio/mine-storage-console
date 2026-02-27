import pytest
from unittest.mock import MagicMock
from botocore.exceptions import ClientError

from mine_backend.services.object_service import ObjectService
from mine_backend.exceptions.application import (
    InconsistentDataError,
    NotFoundError,
    UnexpectedError,
    PermissionDeniedError,
)


def make_client_error(code):
    return ClientError(
        {'Error': {'Code': code, 'Message': 'test error'}},
        'TestOperation',
    )


def make_list_result(objects=None):
    result = MagicMock()
    result.objects = objects or []
    result.is_truncated = False
    result.next_continuation_token = None
    return result


@pytest.fixture
def service(mock_s3):
    return ObjectService(s3_client=mock_s3)


class TestListObjects:
    def test_invalid_bucket_raises(self, service):
        with pytest.raises(InconsistentDataError):
            service.list_objects('AB', prefix='/')

    def test_limit_zero_clamped_to_100(self, service, mock_s3):
        mock_s3.list_objects.return_value = make_list_result()
        service.list_objects('my-bucket', limit=0)
        assert mock_s3.list_objects.call_args.kwargs['limit'] == 100

    def test_limit_1001_clamped_to_100(self, service, mock_s3):
        mock_s3.list_objects.return_value = make_list_result()
        service.list_objects('my-bucket', limit=1001)
        assert mock_s3.list_objects.call_args.kwargs['limit'] == 100

    def test_valid_limit_is_not_clamped(self, service, mock_s3):
        mock_s3.list_objects.return_value = make_list_result()
        service.list_objects('my-bucket', limit=50)
        assert mock_s3.list_objects.call_args.kwargs['limit'] == 50

    def test_valid_call_delegates_and_returns_dict(self, service, mock_s3):
        mock_s3.list_objects.return_value = make_list_result()
        result = service.list_objects('my-bucket', prefix='test/', limit=10)
        mock_s3.list_objects.assert_called_once()
        assert result['bucket'] == 'my-bucket'
        assert result['prefix'] == 'test/'


class TestDeleteObject:
    def test_invalid_bucket_raises(self, service):
        with pytest.raises(InconsistentDataError):
            service.delete_object('AB', 'key')

    def test_delegates_to_s3_and_returns_message(self, service, mock_s3):
        result = service.delete_object('my-bucket', 'my-key')
        mock_s3.delete_object.assert_called_once_with('my-bucket', 'my-key')
        assert 'message' in result


class TestCopyObject:
    def test_validates_source_bucket(self, service):
        with pytest.raises(InconsistentDataError):
            service.copy_object('AB', 'key', 'my-bucket', 'dest-key')

    def test_validates_dest_bucket(self, service):
        with pytest.raises(InconsistentDataError):
            service.copy_object('my-bucket', 'key', 'AB', 'dest-key')

    def test_valid_call_delegates(self, service, mock_s3):
        result = service.copy_object('src-bucket', 'src-key', 'dst-bucket', 'dst-key')
        mock_s3.copy_object.assert_called_once_with(
            source_bucket='src-bucket',
            source_key='src-key',
            dest_bucket='dst-bucket',
            dest_key='dst-key',
        )
        assert 'message' in result


class TestMoveObject:
    def test_calls_copy_then_delete(self, service, mock_s3):
        result = service.move_object('src-bucket', 'src-key', 'dst-bucket', 'dst-key')
        mock_s3.copy_object.assert_called_once()
        mock_s3.delete_object.assert_called_once_with('src-bucket', 'src-key')
        assert 'message' in result


class TestGenerateUploadUrl:
    def test_invalid_bucket_raises(self, service):
        with pytest.raises(InconsistentDataError):
            service.generate_upload_url('AB', 'key')

    def test_expires_in_zero_clamped_to_3600(self, service, mock_s3):
        mock_s3.generate_upload_url.return_value = 'http://upload-url'
        service.generate_upload_url('my-bucket', 'key', expires_in=0)
        assert mock_s3.generate_upload_url.call_args.kwargs['expires_in'] == 3600

    def test_expires_in_too_large_clamped_to_3600(self, service, mock_s3):
        mock_s3.generate_upload_url.return_value = 'http://upload-url'
        service.generate_upload_url('my-bucket', 'key', expires_in=86401)
        assert mock_s3.generate_upload_url.call_args.kwargs['expires_in'] == 3600

    def test_valid_returns_dict_with_upload_url(self, service, mock_s3):
        mock_s3.generate_upload_url.return_value = 'http://upload-url'
        result = service.generate_upload_url('my-bucket', 'key', expires_in=1800)
        assert result['upload_url'] == 'http://upload-url'
        assert 'bucket' in result
        assert 'key' in result


class TestGenerateDownloadUrl:
    def test_invalid_bucket_raises(self, service):
        with pytest.raises(InconsistentDataError):
            service.generate_download_url('AB', 'key')

    def test_expires_in_zero_clamped_to_3600(self, service, mock_s3):
        mock_s3.generate_download_url.return_value = 'http://download-url'
        service.generate_download_url('my-bucket', 'key', expires_in=0)
        assert mock_s3.generate_download_url.call_args.kwargs['expires_in'] == 3600

    def test_expires_in_too_large_clamped_to_3600(self, service, mock_s3):
        mock_s3.generate_download_url.return_value = 'http://download-url'
        service.generate_download_url('my-bucket', 'key', expires_in=86401)
        assert mock_s3.generate_download_url.call_args.kwargs['expires_in'] == 3600

    def test_valid_returns_dict_with_download_url(self, service, mock_s3):
        mock_s3.generate_download_url.return_value = 'http://download-url'
        result = service.generate_download_url('my-bucket', 'key', expires_in=1800)
        assert result['download_url'] == 'http://download-url'
        assert 'bucket' in result


class TestDeleteObjectVersion:
    def test_empty_version_id_raises(self, service):
        with pytest.raises(InconsistentDataError):
            service.delete_object_version('my-bucket', 'key', '')

    def test_invalid_bucket_raises(self, service):
        with pytest.raises(InconsistentDataError):
            service.delete_object_version('AB', 'key', 'v1')

    def test_valid_delegates_and_returns_message(self, service, mock_s3):
        result = service.delete_object_version('my-bucket', 'key', 'v1')
        mock_s3.delete_object_version.assert_called_once()
        assert 'message' in result


class TestRestoreObjectVersion:
    def test_empty_version_id_raises(self, service):
        with pytest.raises(InconsistentDataError):
            service.restore_object_version('my-bucket', 'key', '')

    def test_invalid_bucket_raises(self, service):
        with pytest.raises(InconsistentDataError):
            service.restore_object_version('AB', 'key', 'v1')

    def test_valid_delegates_and_returns_message(self, service, mock_s3):
        result = service.restore_object_version('my-bucket', 'key', 'v1')
        mock_s3.restore_object_version.assert_called_once()
        assert 'message' in result


class TestHandleError:
    def test_no_such_bucket_raises_not_found(self, service):
        with pytest.raises(NotFoundError):
            service._handle_error(make_client_error('NoSuchBucket'), 'my-bucket')

    def test_no_such_key_raises_not_found(self, service):
        with pytest.raises(NotFoundError):
            service._handle_error(make_client_error('NoSuchKey'), 'my-bucket')

    def test_access_denied_raises_permission_denied(self, service):
        with pytest.raises(PermissionDeniedError):
            service._handle_error(make_client_error('AccessDenied'), 'my-bucket')

    def test_all_access_disabled_raises_permission_denied(self, service):
        with pytest.raises(PermissionDeniedError):
            service._handle_error(make_client_error('AllAccessDisabled'), 'my-bucket')

    def test_unknown_code_raises_unexpected(self, service):
        with pytest.raises(UnexpectedError):
            service._handle_error(make_client_error('SomethingElse'), 'my-bucket')
