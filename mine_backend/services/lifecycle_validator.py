from __future__ import annotations

from typing import Any


_VALID_STATUSES = {'Enabled', 'Disabled'}

_VALID_STORAGE_CLASSES = {
    'STANDARD',
    'REDUCED_REDUNDANCY',
    'STANDARD_IA',
    'ONEZONE_IA',
    'INTELLIGENT_TIERING',
    'GLACIER',
    'DEEP_ARCHIVE',
    'GLACIER_IR',
}

_ACTION_KEYS = {
    'Expiration',
    'NoncurrentVersionExpiration',
    'AbortIncompleteMultipartUpload',
    'Transitions',
    'NoncurrentVersionTransitions',
}


def validate_lifecycle(config: Any) -> list[str]:
    """Validate an S3 lifecycle configuration dict.

    Returns a list of human-readable error strings.
    An empty list means the configuration is valid.
    """
    errors: list[str] = []

    if not isinstance(config, dict):
        return ['Configuration must be a JSON object.']

    if 'Rules' not in config:
        return ['Configuration must contain a "Rules" key.']

    rules = config['Rules']

    if not isinstance(rules, list):
        return ['"Rules" must be a list.']

    if len(rules) == 0:
        return ['"Rules" must contain at least one rule.']

    seen_ids: set[str] = set()

    for i, rule in enumerate(rules):
        label = f'Rule[{i}]'

        if not isinstance(rule, dict):
            errors.append(f'{label}: must be a JSON object.')
            continue

        # ID — optional, but must be a unique non-empty string if present
        rule_id = rule.get('ID')
        if rule_id is not None:
            if not isinstance(rule_id, str) or not rule_id.strip():
                errors.append(f'{label}: "ID" must be a non-empty string.')
            elif rule_id in seen_ids:
                errors.append(f'{label}: Duplicate rule ID "{rule_id}".')
            else:
                seen_ids.add(rule_id)
                label = f'Rule "{rule_id}"'

        # Status — required
        status = rule.get('Status')
        if status is None:
            errors.append(f'{label}: "Status" is required.')
        elif status not in _VALID_STATUSES:
            errors.append(
                f'{label}: "Status" must be "Enabled" or "Disabled", got "{status}".'
            )

        # Filter — required (use {} for no filter)
        if 'Filter' not in rule:
            errors.append(f'{label}: "Filter" is required (use {{}} for no filter).')
        elif not isinstance(rule['Filter'], dict):
            errors.append(f'{label}: "Filter" must be a JSON object.')

        # At least one action required
        if not any(k in rule for k in _ACTION_KEYS):
            errors.append(
                f'{label}: at least one action is required '
                '(Expiration, NoncurrentVersionExpiration, '
                'AbortIncompleteMultipartUpload, Transitions, or '
                'NoncurrentVersionTransitions).'
            )

        # ── Expiration ────────────────────────────────────────────────────────
        if 'Expiration' in rule:
            exp = rule['Expiration']
            if not isinstance(exp, dict):
                errors.append(f'{label}: "Expiration" must be a JSON object.')
            else:
                if not any(
                    k in exp for k in ('Days', 'Date', 'ExpiredObjectDeleteMarker')
                ):
                    errors.append(
                        f'{label}: "Expiration" must specify "Days", "Date", '
                        'or "ExpiredObjectDeleteMarker".'
                    )
                days = exp.get('Days')
                if days is not None and (not isinstance(days, int) or days <= 0):
                    errors.append(
                        f'{label}: "Expiration.Days" must be a positive integer.'
                    )

        # ── NoncurrentVersionExpiration ───────────────────────────────────────
        if 'NoncurrentVersionExpiration' in rule:
            nve = rule['NoncurrentVersionExpiration']
            if not isinstance(nve, dict):
                errors.append(
                    f'{label}: "NoncurrentVersionExpiration" must be a JSON object.'
                )
            else:
                if (
                    'NoncurrentDays' not in nve
                    and 'NewerNoncurrentVersions' not in nve
                ):
                    errors.append(
                        f'{label}: "NoncurrentVersionExpiration" must have '
                        '"NoncurrentDays" or "NewerNoncurrentVersions".'
                    )
                ncd = nve.get('NoncurrentDays')
                if ncd is not None and (not isinstance(ncd, int) or ncd <= 0):
                    errors.append(
                        f'{label}: "NoncurrentVersionExpiration.NoncurrentDays" '
                        'must be a positive integer.'
                    )

        # ── AbortIncompleteMultipartUpload ────────────────────────────────────
        if 'AbortIncompleteMultipartUpload' in rule:
            aimu = rule['AbortIncompleteMultipartUpload']
            if not isinstance(aimu, dict):
                errors.append(
                    f'{label}: "AbortIncompleteMultipartUpload" must be a JSON object.'
                )
            elif 'DaysAfterInitiation' not in aimu:
                errors.append(
                    f'{label}: "AbortIncompleteMultipartUpload" must have '
                    '"DaysAfterInitiation".'
                )
            else:
                dai = aimu['DaysAfterInitiation']
                if not isinstance(dai, int) or dai <= 0:
                    errors.append(
                        f'{label}: "AbortIncompleteMultipartUpload.DaysAfterInitiation" '
                        'must be a positive integer.'
                    )

        # ── Transitions ───────────────────────────────────────────────────────
        if 'Transitions' in rule:
            transitions = rule['Transitions']
            if not isinstance(transitions, list):
                errors.append(f'{label}: "Transitions" must be a list.')
            else:
                for j, t in enumerate(transitions):
                    tp = f'{label}.Transitions[{j}]'
                    if not isinstance(t, dict):
                        errors.append(f'{tp}: must be a JSON object.')
                        continue
                    if 'Days' not in t and 'Date' not in t:
                        errors.append(f'{tp}: must specify "Days" or "Date".')
                    days = t.get('Days')
                    if days is not None and (not isinstance(days, int) or days < 0):
                        errors.append(f'{tp}: "Days" must be a non-negative integer.')
                    if 'StorageClass' not in t:
                        errors.append(f'{tp}: "StorageClass" is required.')
                    elif t['StorageClass'] not in _VALID_STORAGE_CLASSES:
                        errors.append(
                            f'{tp}: "StorageClass" "{t["StorageClass"]}" is not recognized.'
                        )

        # ── NoncurrentVersionTransitions ──────────────────────────────────────
        if 'NoncurrentVersionTransitions' in rule:
            nvt = rule['NoncurrentVersionTransitions']
            if not isinstance(nvt, list):
                errors.append(
                    f'{label}: "NoncurrentVersionTransitions" must be a list.'
                )
            else:
                for j, t in enumerate(nvt):
                    tp = f'{label}.NoncurrentVersionTransitions[{j}]'
                    if not isinstance(t, dict):
                        errors.append(f'{tp}: must be a JSON object.')
                        continue
                    ncd = t.get('NoncurrentDays')
                    if ncd is None:
                        errors.append(f'{tp}: "NoncurrentDays" is required.')
                    elif not isinstance(ncd, int) or ncd < 0:
                        errors.append(
                            f'{tp}: "NoncurrentDays" must be a non-negative integer.'
                        )
                    if 'StorageClass' not in t:
                        errors.append(f'{tp}: "StorageClass" is required.')
                    elif t['StorageClass'] not in _VALID_STORAGE_CLASSES:
                        errors.append(
                            f'{tp}: "StorageClass" "{t["StorageClass"]}" is not recognized.'
                        )

    return errors
