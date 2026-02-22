from mine_spec.ports.admin import UserAdminPort

from mine_backend.exceptions.application import (
    InconsistentDataError,
    NotFoundError,
    AlreadyExistsError,
    UnexpectedError,
    PermissionDeniedError,
)


class UserService:
    def __init__(self, storage_admin: UserAdminPort):
        self.storage_admin = storage_admin

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

    def list_users(self):
        try:
            return self.storage_admin.list_users()
        except RuntimeError as e:
            self._handle_storage_admin_error(e)

    def get_user(self, username: str):
        try:
            return self.storage_admin.get_user(username)
        except RuntimeError as e:
            self._handle_storage_admin_error(e)

    def create_user(self, username: str, password: str):
        try:
            return self.storage_admin.create_user(username, password)
        except RuntimeError as e:
            self._handle_storage_admin_error(e)

    def delete_user(self, username: str):
        try:
            return self.storage_admin.delete_user(username)
        except RuntimeError as e:
            self._handle_storage_admin_error(e)

    def enable_user(self, username: str):
        try:
            return self.storage_admin.enable_user(username)
        except RuntimeError as e:
            self._handle_storage_admin_error(e)

    def disable_user(self, username: str):
        try:
            return self.storage_admin.disable_user(username)
        except RuntimeError as e:
            self._handle_storage_admin_error(e)
