import httpx
import xml.etree.ElementTree as ET
from mine_backend.config import settings

from mine_backend.exceptions.application import (
    InconsistentDataError,
    UnexpectedError,
    ServiceUnavailableError,
)


async def assume_role_with_web_identity(token: str):

    url = f"http{'s' if settings.S3_SECURE else ''}://{settings.S3_ENDPOINT}"

    params = {
        'Action': 'AssumeRoleWithWebIdentity',
        'Version': '2011-06-15',
        'WebIdentityToken': token,
        'DurationSeconds': '3600',
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, params=params)

        response.raise_for_status()

    except httpx.HTTPStatusError as e:
        raise InconsistentDataError(f'STS error: {e.response.text}')
    except httpx.RequestError as e:
        raise ServiceUnavailableError(
            f'connection error: {str(e)}',
        )

    root = ET.fromstring(response.content)

    namespace = {'ns': root.tag.split('}')[0].strip('{')}

    credentials = root.find('.//ns:Credentials', namespace)

    if credentials is None:
        raise UnexpectedError('Invalid STS response')

    return {
        'access_key': credentials.find('ns:AccessKeyId', namespace).text,
        'secret_key': credentials.find('ns:SecretAccessKey', namespace).text,
        'session_token': credentials.find('ns:SessionToken', namespace).text,
        'expiration': credentials.find('ns:Expiration', namespace).text,
    }
