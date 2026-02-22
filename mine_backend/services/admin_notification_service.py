from mine_spec.ports.admin import UserAdminPort
from mine_backend.exceptions.application import (
    UnexpectedError,
    NotFoundError,
    AlreadyExistsError,
    InconsistentDataError,
    PermissionDeniedError,
)




class AdminNotificationService:
    def __init__(self, storage_admin: UserAdminPort):
        self.storage_admin = storage_admin

    # --------------------------------------------------------
    # ERROR HANDLER
    # --------------------------------------------------------

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

    def create_target(self, target_type: str, identifier: str, config: dict):
        try:
            return self.storage_admin.add_notification_target(
                target_type=target_type,
                identifier=identifier,
                config=config,
            )
        except RuntimeError as e:
            self._handle_storage_admin_error(e)

    def delete_target(self, target_type: str, identifier: str):
        try:
            return self.storage_admin.remove_notification_target(
                target_type=target_type,
                identifier=identifier,
            )
        except RuntimeError as e:
            self._handle_storage_admin_error(e)

    def list_targets(self, target_type: str | None = None):
        try:
            return self.storage_admin.list_notification_targets(target_type)
        except RuntimeError as e:
            self._handle_storage_admin_error(e)
