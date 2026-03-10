from botocore.exceptions import ClientError
from mine_spec.ports.admin import UserAdminPort
from mine_spec.ports.object_storage import ObjectStoragePort


from mine_backend.exceptions.application import (
    InconsistentDataError,
    NotFoundError,
    AlreadyExistsError,
    UnexpectedError,
    PermissionDeniedError,
)

import re


BUCKET_REGEX = re.compile(r'^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$')


class BucketService:
    def __init__(
        self,
        s3_client: ObjectStoragePort,
        storage_admin: UserAdminPort,
    ):
        self.s3 = s3_client
        self.storage_admin = storage_admin

    def _handle_s3_error(self, error: ClientError):
        error_code = error.response['Error']['Code']

        if error_code == 'InvalidBucketName':
            raise InconsistentDataError(
                'Invalid bucket name. Must follow S3 naming rules.'
            )

        if error_code in [
            'BucketAlreadyExists',
            'BucketAlreadyOwnedByYou',
        ]:
            raise AlreadyExistsError(
                'Bucket already exists.',
            )

        if error_code == 'AccessDenied':
            raise PermissionDeniedError(
                'You do not have permission to create this bucket.',
            )

        raise UnexpectedError(
            f'S3 error: {error_code}',
        )

    def _handle_storage_admin_error(self, error: RuntimeError):
        message = str(error).lower()

        if 'not found' in message:
            raise NotFoundError(str(error))

        if 'already exists' in message:
            raise AlreadyExistsError(str(error))

        if 'invalid' in message:
            raise InconsistentDataError(str(error))

        if 'denied' in message or 'forbidden' in message:
            raise PermissionDeniedError(str(error))

        raise UnexpectedError(str(error))

    # -----------------------------------------
    # Buckets
    # -----------------------------------------

    def list_buckets(self):

        buckets = self.s3.list_buckets()

        return [
            {
                'name': bucket.name,
                'creation_date': bucket.creation_date,
            }
            for bucket in buckets
        ]

    def create_bucket(self, name: str):

        if not BUCKET_REGEX.match(name):
            raise InconsistentDataError(
                'Invalid bucket name. Must follow S3 naming rules.'
            )

        self.s3.create_bucket(name)

        return {
            'message': f"Bucket '{name}' created successfully",
            'name': name,
        }

    def delete_bucket(self, name: str):

        if not BUCKET_REGEX.match(name):
            raise InconsistentDataError('Invalid bucket name.')

        self.s3.delete_bucket(name)

        return {
            'message': f"Bucket '{name}' deleted successfully",
            'name': name,
        }

    def get_versioning(self, name: str):

        if not BUCKET_REGEX.match(name):
            raise InconsistentDataError('Invalid bucket name.')

        versioning = self.s3.get_bucket_versioning_status(name)

        return {
            'bucket': name,
            'versioning': versioning,
        }

    def set_versioning(
        self,
        name: str,
        enabled: bool,
    ):

        if not BUCKET_REGEX.match(name):
            raise InconsistentDataError('Invalid bucket name.')

        self.s3.set_bucket_versioning(
            name=name,
            enabled=enabled,
        )

        return {
            'bucket': name,
            'versioning': 'enabled' if enabled else 'suspended',
        }

    def get_usage(self, name: str):

        if not BUCKET_REGEX.match(name):
            raise InconsistentDataError('Invalid bucket name.')

        usage = self.s3.get_bucket_usage(name)

        return {
            'bucket': name,
            'objects': usage.objects,
            'size_bytes': usage.size_bytes,
        }

    def set_quota(self, name: str, quota_bytes: int):

        if quota_bytes <= 0:
            raise InconsistentDataError(
                'Quota must be greater than zero.',
            )

        if not self.storage_admin:
            raise InconsistentDataError(
                'Admin client not configured.',
            )

        quota_gib = f'{quota_bytes / (1024**3):.2f}GiB'

        try:
            return self.storage_admin.set_bucket_quota(name, quota_gib)

        except RuntimeError as e:
            self._handle_storage_admin_error(e)

    def get_quota(self, name: str):

        if not self.storage_admin:
            raise InconsistentDataError(
                'Admin client not configured.',
            )

        try:
            return self.storage_admin.get_bucket_quota(name)

        except RuntimeError as e:
            self._handle_storage_admin_error(e)

    def get_quotas_overview(self) -> list[dict]:
        buckets = self.s3.list_buckets()
        result = []
        for bucket in buckets:
            name = bucket.name

            try:
                usage = self.s3.get_bucket_usage(name)
                size_bytes = usage.size_bytes
                objects = usage.objects
            except Exception:
                size_bytes = 0
                objects = 0

            quota_bytes = None
            try:
                quota_data = self.storage_admin.get_bucket_quota(name)
                if quota_data:
                    item = (
                        quota_data[0]
                        if isinstance(quota_data, list)
                        else quota_data
                    )
                    qb = getattr(item, 'quota_bytes', None)
                    if qb and qb > 0:
                        quota_bytes = int(qb)
            except Exception:
                pass

            usage_percent = None
            if quota_bytes and quota_bytes > 0:
                usage_percent = round((size_bytes / quota_bytes) * 100, 1)

            result.append(
                {
                    'name': name,
                    'size_bytes': size_bytes,
                    'objects': objects,
                    'quota_bytes': quota_bytes,
                    'usage_percent': usage_percent,
                }
            )

        return result

    def set_global_quota(self, quota_bytes: int) -> dict:
        if quota_bytes <= 0:
            raise InconsistentDataError('Quota must be greater than zero.')

        buckets = self.s3.list_buckets()
        applied = 0
        errors: list[str] = []

        for bucket in buckets:
            try:
                self.set_quota(bucket.name, quota_bytes)
                applied += 1
            except Exception:
                errors.append(bucket.name)

        return {'applied': applied, 'errors': errors}

    def remove_quota(self, name: str):
        if not self.storage_admin:
            raise InconsistentDataError('Admin client not configured.')
        try:
            return self.storage_admin.set_bucket_quota(name, '0GiB')
        except RuntimeError as e:
            self._handle_storage_admin_error(e)

    def get_bucket_policy(self, bucket: str):

        if not BUCKET_REGEX.match(bucket):
            raise InconsistentDataError('Invalid bucket name.')

        policy = self.s3.get_bucket_policy(bucket)

        return {
            'bucket': bucket,
            'policy': policy,
        }

    def put_bucket_policy(
        self,
        bucket: str,
        policy: dict,
    ):

        if not BUCKET_REGEX.match(bucket):
            raise InconsistentDataError('Invalid bucket name.')

        if not isinstance(policy, dict):
            raise InconsistentDataError('Policy must be a dictionary.')

        self.s3.put_bucket_policy(
            bucket=bucket,
            policy=policy,
        )

        return {
            'message': 'Bucket policy applied successfully',
            'bucket': bucket,
        }

    def delete_bucket_policy(
        self,
        bucket: str,
    ):

        if not BUCKET_REGEX.match(bucket):
            raise InconsistentDataError('Invalid bucket name.')

        self.s3.delete_bucket_policy(bucket)

        return {
            'message': 'Bucket policy removed',
            'bucket': bucket,
        }

    def get_bucket_lifecycle(self, bucket: str):

        if not BUCKET_REGEX.match(bucket):
            raise InconsistentDataError('Invalid bucket name.')

        lifecycle = self.s3.get_bucket_lifecycle(bucket)

        if 'Rules' in lifecycle:
            lifecycle = {'Rules' : lifecycle['Rules']}

        return {
            'bucket': bucket,
            'lifecycle': lifecycle,
        }

    def validate_policy(self, policy: dict) -> dict:

        from mine_backend.services.policy_validator import (
            validate_policy as _validate,
        )

        errors = _validate(policy)

        return {
            'valid': len(errors) == 0,
            'errors': errors,
        }

    def validate_lifecycle(self, lifecycle: dict) -> dict:

        from mine_backend.services.lifecycle_validator import (
            validate_lifecycle as _validate,
        )

        errors = _validate(lifecycle)

        return {
            'valid': len(errors) == 0,
            'errors': errors,
        }

    def put_bucket_lifecycle(
        self,
        bucket: str,
        lifecycle: dict,
    ):

        if not BUCKET_REGEX.match(bucket):
            raise InconsistentDataError('Invalid bucket name.')

        if not isinstance(lifecycle, dict):
            raise InconsistentDataError(
                'Lifecycle configuration must be a dictionary.'
            )

        self.s3.put_bucket_lifecycle(
            bucket=bucket,
            lifecycle=lifecycle,
        )

        return {
            'message': 'Lifecycle configuration applied successfully',
            'bucket': bucket,
        }

    def delete_bucket_lifecycle(
        self,
        bucket: str,
    ):

        if not BUCKET_REGEX.match(bucket):
            raise InconsistentDataError('Invalid bucket name.')

        self.s3.delete_bucket_lifecycle(bucket)

        return {
            'message': 'Lifecycle configuration removed',
            'bucket': bucket,
        }

    def get_bucket_events(
        self,
        bucket: str,
    ):

        if not BUCKET_REGEX.match(bucket):
            raise InconsistentDataError('Invalid bucket name.')

        events = self.s3.get_bucket_events(bucket)

        _notification_keys = {
            'QueueConfigurations',
            'TopicConfigurations',
            'LambdaFunctionConfigurations',
        }
        events = {k: v for k, v in events.items() if k in _notification_keys and v}

        return {
            'bucket': bucket,
            'events': events,
        }

    def put_bucket_events(
        self,
        bucket: str,
        config: dict,
    ):

        if not BUCKET_REGEX.match(bucket):
            raise InconsistentDataError('Invalid bucket name.')

        if not isinstance(config, dict):
            raise InconsistentDataError(
                'Notification configuration must be a dictionary.'
            )

        self.s3.put_bucket_events(
            bucket=bucket,
            config=config,
        )

        return {
            'message': 'Notification configuration applied',
            'bucket': bucket,
        }

    def delete_bucket_events(
        self,
        bucket: str,
    ):

        if not BUCKET_REGEX.match(bucket):
            raise InconsistentDataError('Invalid bucket name.')

        self.s3.delete_bucket_events(bucket)

        return {
            'message': 'All notification configurations removed',
            'bucket': bucket,
        }
