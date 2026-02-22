from mine_spec.ports.admin import UserAdminPort
from mine_backend.exceptions.application import (
    UnexpectedError,
    NotFoundError,
    AlreadyExistsError,
    InconsistentDataError,
    PermissionDeniedError,
)




class GroupService:
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

    def list_groups(self):
        try:
            return self.storage_admin.list_groups()
        except RuntimeError as e:
            self._handle_storage_admin_error(e)

    def get_group(self, name: str):
        try:
            return self.storage_admin.group_info(name)
        except RuntimeError as e:
            self._handle_storage_admin_error(e)

    def create_group(self, name: str, users: list[str]):
        try:
            return self.storage_admin.create_group(name, users)
        except RuntimeError as e:
            self._handle_storage_admin_error(e)

    def delete_group(self, name: str):
        try:
            return self.storage_admin.remove_group(name)
        except RuntimeError as e:
            self._handle_storage_admin_error(e)

    def add_users(self, name: str, users: list[str]):
        try:
            return self.storage_admin.add_users_to_group(name, users)
        except RuntimeError as e:
            self._handle_storage_admin_error(e)

    def remove_users(self, name: str, users: list[str]):
        try:
            return self.storage_admin.remove_users_from_group(name, users)
        except RuntimeError as e:
            self._handle_storage_admin_error(e)

    def enable_group(self, name: str):
        try:
            return self.storage_admin.enable_group(name)
        except RuntimeError as e:
            self._handle_storage_admin_error(e)

    def disable_group(self, name: str):
        try:
            return self.storage_admin.disable_group(name)
        except RuntimeError as e:
            self._handle_storage_admin_error(e)

    def attach_policy(self, group: str, policy: str):
        try:
            return self.storage_admin.attach_policy_to_group(policy, group)
        except RuntimeError as e:
            self._handle_storage_admin_error(e)

    def detach_policy(self, group: str, policy: str):
        try:
            return self.storage_admin.detach_policy_from_group(policy, group)
        except RuntimeError as e:
            self._handle_storage_admin_error(e)

    def get_attach_policy(self, group: str):
        try:
            return self.storage_admin.get_policy_from_group(group)
        except RuntimeError as e:
            self._handle_storage_admin_error(e)
