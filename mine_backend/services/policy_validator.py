from __future__ import annotations

from typing import Any


_VALID_VERSIONS = {'2012-10-17', '2008-10-17'}
_VALID_EFFECTS = {'Allow', 'Deny'}
_VALID_PRINCIPAL_KEYS = {'AWS', 'Service', 'Federated'}


def validate_policy(config: Any) -> list[str]:
    """Validate an S3 bucket policy dict.

    Returns a list of human-readable error strings.
    An empty list means the policy is structurally and semantically valid.
    """
    errors: list[str] = []

    if not isinstance(config, dict):
        return ['Policy must be a JSON object.']

    # Optional Version
    version = config.get('Version')
    if version is not None:
        if not isinstance(version, str):
            errors.append('"Version" must be a string.')
        elif version not in _VALID_VERSIONS:
            errors.append(
                f'"Version" must be "2012-10-17" or "2008-10-17", got "{version}".'
            )

    # Statement — required
    if 'Statement' not in config:
        errors.append('Policy must contain a "Statement" key.')
        return errors

    statements = config['Statement']

    if not isinstance(statements, list):
        errors.append('"Statement" must be a list.')
        return errors

    if len(statements) == 0:
        errors.append('"Statement" must contain at least one statement.')
        return errors

    for i, stmt in enumerate(statements):
        label = f'Statement[{i}]'

        if not isinstance(stmt, dict):
            errors.append(f'{label}: must be a JSON object.')
            continue

        # Sid — optional, string
        sid = stmt.get('Sid')
        if sid is not None:
            if not isinstance(sid, str):
                errors.append(f'{label}: "Sid" must be a string.')
            else:
                label = f'Statement "{sid}"'

        # Effect — required
        effect = stmt.get('Effect')
        if effect is None:
            errors.append(f'{label}: "Effect" is required.')
        elif effect not in _VALID_EFFECTS:
            errors.append(
                f'{label}: "Effect" must be "Allow" or "Deny", got "{effect}".'
            )

        # Principal / NotPrincipal — at least one required for bucket policies
        has_principal = 'Principal' in stmt
        has_not_principal = 'NotPrincipal' in stmt
        if not has_principal and not has_not_principal:
            errors.append(f'{label}: "Principal" or "NotPrincipal" is required.')
        if has_principal:
            _validate_principal(stmt['Principal'], label, 'Principal', errors)
        if has_not_principal:
            _validate_principal(stmt['NotPrincipal'], label, 'NotPrincipal', errors)

        # Action / NotAction — at least one required
        has_action = 'Action' in stmt
        has_not_action = 'NotAction' in stmt
        if not has_action and not has_not_action:
            errors.append(f'{label}: "Action" or "NotAction" is required.')
        if has_action:
            _validate_string_or_list(stmt['Action'], label, 'Action', errors)
        if has_not_action:
            _validate_string_or_list(stmt['NotAction'], label, 'NotAction', errors)

        # Resource / NotResource — at least one required
        has_resource = 'Resource' in stmt
        has_not_resource = 'NotResource' in stmt
        if not has_resource and not has_not_resource:
            errors.append(f'{label}: "Resource" or "NotResource" is required.')
        if has_resource:
            _validate_string_or_list(stmt['Resource'], label, 'Resource', errors)
        if has_not_resource:
            _validate_string_or_list(stmt['NotResource'], label, 'NotResource', errors)

        # Condition — optional, must be a dict if present
        condition = stmt.get('Condition')
        if condition is not None and not isinstance(condition, dict):
            errors.append(f'{label}: "Condition" must be a JSON object.')

    return errors


def _validate_principal(
    value: Any, label: str, key: str, errors: list[str]
) -> None:
    if isinstance(value, str):
        return  # e.g. "*" or an ARN string
    if isinstance(value, list):
        for item in value:
            if not isinstance(item, str):
                errors.append(f'{label}: "{key}" list items must be strings.')
        return
    if isinstance(value, dict):
        for k, v in value.items():
            if k not in _VALID_PRINCIPAL_KEYS:
                errors.append(
                    f'{label}: "{key}" object key "{k}" is not recognized '
                    '(expected AWS, Service, or Federated).'
                )
            if not isinstance(v, (str, list)):
                errors.append(f'{label}: "{key}.{k}" must be a string or list.')
        return
    errors.append(f'{label}: "{key}" must be "*", a string, a list, or an object.')


def _validate_string_or_list(
    value: Any, label: str, key: str, errors: list[str]
) -> None:
    if isinstance(value, str):
        return
    if isinstance(value, list):
        for item in value:
            if not isinstance(item, str):
                errors.append(f'{label}: "{key}" list items must be strings.')
        return
    errors.append(f'{label}: "{key}" must be a string or list of strings.')
