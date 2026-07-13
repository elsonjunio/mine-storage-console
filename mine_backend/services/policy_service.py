import tempfile
import json

from mine_spec.ports.admin import UserAdminPort

from mine_backend.exceptions.application import (
    InconsistentDataError,
    NotFoundError,
    AlreadyExistsError,
    UnexpectedError,
    PermissionDeniedError,
)


class PolicyService:
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

    def list_policies(self):
        try:
            return self.storage_admin.list_policies()
        except RuntimeError as e:
            self._handle_storage_admin_error(e)

    def get_policy(self, name: str):
        try:
            return self.storage_admin.get_policy(name)
        except RuntimeError as e:
            self._handle_storage_admin_error(e)

    def create_policy(self, name: str, document: dict):
        try:
            with tempfile.NamedTemporaryFile(
                mode='w',
                suffix='.json',
                delete=True,
            ) as tmp:
                json.dump(document, tmp)
                tmp.flush()
                return self.storage_admin.create_policy(name, tmp.name)

        except RuntimeError as e:
            self._handle_storage_admin_error(e)

    def delete_policy(self, name: str):
        try:
            return self.storage_admin.delete_policy(name)
        except RuntimeError as e:
            self._handle_storage_admin_error(e)

    def attach_policy(self, policy: str, username: str):
        try:
            return self.storage_admin.attach_policy(policy, username)
        except RuntimeError as e:
            self._handle_storage_admin_error(e)

    def detach_policy(self, policy: str, username: str):
        try:
            return self.storage_admin.detach_policy(policy, username)
        except RuntimeError as e:
            self._handle_storage_admin_error(e)

    def get_groups_by_policy(self, policy_name: str) -> list[str]:
        try:
            groups_data = self.storage_admin.list_groups()
            if not groups_data:
                return []

            first = (
                groups_data[0]
                if isinstance(groups_data, list)
                else groups_data
            )
            all_group_names: list[str] = getattr(first, 'groups', None) or []

            attached: list[str] = []
            for group_name in all_group_names:
                try:
                    policy_data = self.storage_admin.get_policy_from_group(
                        group_name
                    )
                    if not policy_data:
                        continue
                    item = (
                        policy_data[0]
                        if isinstance(policy_data, list)
                        else policy_data
                    )
                    result = getattr(item, 'result', None)
                    if not result:
                        continue
                    for mapping in (
                        getattr(result, 'group_mappings', None) or []
                    ):
                        if getattr(
                            mapping, 'group', None
                        ) == group_name and policy_name in (
                            getattr(mapping, 'policies', None) or []
                        ):
                            attached.append(group_name)
                            break
                except Exception:
                    continue

            return attached
        except RuntimeError as e:
            self._handle_storage_admin_error(e)

    def get_users_by_policy(self, policy_name: str) -> list[str]:
        try:
            users_data = self.storage_admin.list_users()
            if not users_data:
                return []

            first = (
                users_data[0]
                if isinstance(users_data, list)
                else users_data
            )
            all_users: list[str] = getattr(first, 'users', None) or []
            if not all_users:
                all_users = [
                    getattr(u, 'access_key', None) or ''
                    for u in (users_data if isinstance(users_data, list) else [users_data])
                ]
                all_users = [u for u in all_users if u]

            attached: list[str] = []
            for username in all_users:
                try:
                    policy_data = self.storage_admin.get_policy_from_user(
                        username
                    )
                    if not policy_data:
                        continue
                    item = (
                        policy_data[0]
                        if isinstance(policy_data, list)
                        else policy_data
                    )
                    result = getattr(item, 'result', None)
                    if not result:
                        continue
                    for mapping in (
                        getattr(result, 'user_mappings', None) or []
                    ):
                        if getattr(
                            mapping, 'user', None
                        ) == username and policy_name in (
                            getattr(mapping, 'policies', None) or []
                        ):
                            attached.append(username)
                            break
                except Exception:
                    continue

            return attached
        except RuntimeError as e:
            self._handle_storage_admin_error(e)
