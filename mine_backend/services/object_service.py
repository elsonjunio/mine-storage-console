from botocore.exceptions import ClientError
from typing import Optional

from mine_spec.ports.object_storage import ObjectStoragePort

from mine_backend.exceptions.application import (
    InconsistentDataError,
    NotFoundError,
    UnexpectedError,
    PermissionDeniedError,
)

import re


BUCKET_REGEX = re.compile(r'^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$')


class ObjectService:
    def __init__(self, s3_client: ObjectStoragePort):
        self.s3 = s3_client

    def _handle_error(self, e: ClientError, bucket: str):
        error_code = e.response['Error']['Code']

        if error_code == 'NoSuchBucket':
            raise NotFoundError(f"Bucket '{bucket}' not found.")

        if error_code == 'NoSuchKey':
            raise NotFoundError('Object not found.')

        if error_code in ['AccessDenied', 'AllAccessDisabled']:
            raise PermissionDeniedError('Access denied.')

        raise UnexpectedError(f'S3 error: {error_code}')

    def list_objects(
        self,
        bucket: str,
        prefix: Optional[str] = None,
        limit: int = 100,
        continuation_token: Optional[str] = None,
    ):

        if not BUCKET_REGEX.match(bucket):
            raise InconsistentDataError(
                'Invalid bucket name. Must follow S3 naming rules.'
            )

        if limit <= 0 or limit > 1000:
            limit = 100

        result = self.s3.list_objects(
            bucket=bucket,
            prefix=prefix,
            limit=limit,
            continuation_token=continuation_token,
        )

        return {
            'bucket': bucket,
            'prefix': prefix,
            'count': len(result.objects),
            'objects': [
                {
                    'key': obj.key,
                    'size': obj.size,
                    'last_modified': obj.last_modified,
                    'etag': obj.etag,
                    'storage_class': obj.storage_class,
                }
                for obj in result.objects
            ],
            'is_truncated': result.is_truncated,
            'next_continuation_token': result.next_continuation_token,
        }

    def delete_object(self, bucket: str, key: str):

        if not BUCKET_REGEX.match(bucket):
            raise InconsistentDataError(
                'Invalid bucket name. Must follow S3 naming rules.'
            )

        self.s3.delete_object(bucket, key)

        return {'message': f"Object '{key}' deleted"}

    def copy_object(
        self,
        source_bucket: str,
        source_key: str,
        dest_bucket: str,
        dest_key: str,
    ):

        if not BUCKET_REGEX.match(source_bucket):
            raise InconsistentDataError('Invalid source bucket name.')

        if not BUCKET_REGEX.match(dest_bucket):
            raise InconsistentDataError('Invalid destination bucket name.')

        self.s3.copy_object(
            source_bucket=source_bucket,
            source_key=source_key,
            dest_bucket=dest_bucket,
            dest_key=dest_key,
        )

        return {'message': 'Object copied successfully'}

    def move_object(
        self,
        source_bucket: str,
        source_key: str,
        dest_bucket: str,
        dest_key: str,
    ):

        try:
            self.copy_object(
                source_bucket,
                source_key,
                dest_bucket,
                dest_key,
            )

            self.delete_object(source_bucket, source_key)

            return {'message': 'Object moved successfully'}

        except ClientError as e:
            self._handle_error(e, source_bucket)

    def generate_upload_url(
        self,
        bucket: str,
        key: str,
        expires_in: int = 3600,
        content_type: str | None = None,
    ):

        if not BUCKET_REGEX.match(bucket):
            raise InconsistentDataError(
                'Invalid bucket name. Must follow S3 naming rules.'
            )

        if expires_in <= 0 or expires_in > 86400:
            expires_in = 3600

        try:
            url = self.s3.generate_upload_url(
                bucket=bucket,
                key=key,
                expires_in=expires_in,
                content_type=content_type,
            )

            return {
                'bucket': bucket,
                'key': key,
                'upload_url': url,
                'expires_in': expires_in,
            }

        except Exception as e:
            raise UnexpectedError(f'Could not generate upload URL: {str(e)}')

    def generate_download_url(
        self,
        bucket: str,
        key: str,
        expires_in: int = 3600,
        response_content_type: str | None = None,
        response_content_disposition: str | None = None,
    ):

        if not BUCKET_REGEX.match(bucket):
            raise InconsistentDataError(
                'Invalid bucket name. Must follow S3 naming rules.'
            )

        if expires_in <= 0 or expires_in > 86400:
            expires_in = 3600

        try:
            url = self.s3.generate_download_url(
                bucket=bucket,
                key=key,
                expires_in=expires_in,
                response_content_type=response_content_type,
                response_content_disposition=response_content_disposition,
            )

            return {
                'bucket': bucket,
                'key': key,
                'download_url': url,
                'expires_in': expires_in,
            }

        except Exception as e:
            raise UnexpectedError(f'Could not generate download URL: {str(e)}')

    def list_object_versions(
        self,
        bucket: str,
        key: str,
    ):

        if not BUCKET_REGEX.match(bucket):
            raise InconsistentDataError(
                'Invalid bucket name. Must follow S3 naming rules.'
            )

        try:
            versions = self.s3.list_object_versions(
                bucket=bucket,
                key=key,
            )

            return {
                'bucket': bucket,
                'key': key,
                'versions': [
                    {
                        'version_id': v.version_id,
                        'is_latest': v.is_latest,
                        'last_modified': v.last_modified,
                        'size': v.size,
                    }
                    for v in versions
                ],
            }

        except Exception as e:
            raise UnexpectedError(f'Could not list versions: {str(e)}')

    def delete_object_version(
        self,
        bucket: str,
        key: str,
        version_id: str,
    ):

        if not BUCKET_REGEX.match(bucket):
            raise InconsistentDataError(
                'Invalid bucket name. Must follow S3 naming rules.'
            )

        if not version_id:
            raise InconsistentDataError('Version ID must be provided.')

        try:
            self.s3.delete_object_version(
                bucket=bucket,
                key=key,
                version_id=version_id,
            )

            return {
                'bucket': bucket,
                'key': key,
                'version_id': version_id,
                'message': 'Object version deleted successfully',
            }

        except Exception as e:
            raise UnexpectedError(f'Could not delete object version: {str(e)}')

    def restore_object_version(
        self,
        bucket: str,
        key: str,
        version_id: str,
    ):

        if not BUCKET_REGEX.match(bucket):
            raise InconsistentDataError(
                'Invalid bucket name. Must follow S3 naming rules.'
            )

        if not version_id:
            raise InconsistentDataError('Version ID must be provided.')

        try:
            self.s3.restore_object_version(
                bucket=bucket,
                key=key,
                version_id=version_id,
            )

            return {
                'message': 'Version restored',
                'bucket': bucket,
                'key': key,
                'restored_from_version': version_id,
            }

        except Exception as e:
            raise UnexpectedError(f'Could not restore version: {str(e)}')

    def get_object_metadata(self, bucket: str, key: str):

        if not BUCKET_REGEX.match(bucket):
            raise InconsistentDataError(
                'Invalid bucket name. Must follow S3 naming rules.'
            )

        try:
            metadata = self.s3.get_object_metadata(
                bucket=bucket,
                key=key,
            )

            return {
                'bucket': bucket,
                'key': key,
                'size': metadata.size,
                'etag': metadata.etag,
                'last_modified': metadata.last_modified,
                'content_type': metadata.content_type,
                'metadata': metadata.metadata,
            }

        except Exception as e:
            raise UnexpectedError(f'Could not get object metadata: {str(e)}')

    def update_object_metadata(
        self,
        bucket: str,
        key: str,
        metadata: dict,
    ):

        if not BUCKET_REGEX.match(bucket):
            raise InconsistentDataError(
                'Invalid bucket name. Must follow S3 naming rules.'
            )

        if not isinstance(metadata, dict):
            raise InconsistentDataError('Metadata must be a dictionary.')

        self.s3.update_object_metadata(
            bucket=bucket,
            key=key,
            metadata=metadata,
        )

        return {
            'message': 'Metadata updated successfully',
            'bucket': bucket,
            'key': key,
        }

    def get_object_tags(self, bucket: str, key: str):

        if not BUCKET_REGEX.match(bucket):
            raise InconsistentDataError(
                'Invalid bucket name. Must follow S3 naming rules.'
            )

        try:
            tags = self.s3.get_object_tags(
                bucket=bucket,
                key=key,
            )

            return {
                'bucket': bucket,
                'key': key,
                'tags': tags,
            }

        except Exception as e:
            raise UnexpectedError(f'Could not get object tags: {str(e)}')

    def update_object_tags(
        self,
        bucket: str,
        key: str,
        tags: dict,
    ):

        if not BUCKET_REGEX.match(bucket):
            raise InconsistentDataError(
                'Invalid bucket name. Must follow S3 naming rules.'
            )

        if not isinstance(tags, dict):
            raise InconsistentDataError('Tags must be a dictionary.')

        self.s3.update_object_tags(
            bucket=bucket,
            key=key,
            tags=tags,
        )

        return {
            'bucket': bucket,
            'key': key,
            'tags': tags,
            'message': 'Tags updated successfully',
        }
