import tempfile
import json
from mine_spec.ports.admin import UserAdminPort
from mine_backend.exceptions.application import InconsistentDataError



class CredentialService:
    def __init__(self, storage_admin: UserAdminPort):
        self.storage_admin = storage_admin

    def list_credentials(self, username: str):
        try:
            return self.storage_admin.list_service_accounts(username)
        except RuntimeError as e:
            raise InconsistentDataError(
                str(e),
            )

    def create_credential(
        self,
        username: str,
        policy: dict | None = None,
        expiration: str | None = None,
    ):
        try:
            if policy:
                with tempfile.NamedTemporaryFile(
                    mode='w',
                    suffix='.json',
                    delete=True,
                ) as tmp:
                    json.dump(policy, tmp)
                    tmp.flush()
                    return self.storage_admin.create_service_account(
                        username,
                        tmp.name,
                        expiration,
                    )
            else:
                return self.storage_admin.create_service_account(
                    username,
                    None,
                    expiration,
                )

        except RuntimeError as e:
            raise InconsistentDataError(
                str(e),
            )

    def delete_credential(self, access_key: str):
        try:
            return self.storage_admin.delete_service_account(access_key)
        except RuntimeError as e:
            raise InconsistentDataError(
                str(e),
            )
